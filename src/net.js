// Online-Duell per deterministischem Lockstep.
//
// Beide Geräte rechnen dieselbe Partie (gleicher Seed, fester Zeitschritt). Übertragen
// werden nur Befehle mit dem Tick, an dem sie gelten – eingeplant mit Vorlauf (delay),
// damit sie den Gegner rechtzeitig erreichen. Ein Tick T wird erst ausgeführt, wenn der
// Gegner bestätigt hat, dass seine Befehle bis T feststehen (upto ≥ T).
//
// Der Austausch läuft über ein absolutes Zustandsobjekt pro Spieler (die „Presence“ des
// room-Fähigkeit): Es enthält immer alle noch nicht sicher angekommenen Befehle, deshalb
// schaden verlorene oder zusammengefasste Aktualisierungen nicht.
//
// Prüfsummen alle SUM_EVERY Ticks erkennen Abweichungen. Dann – oder wenn eine Seite nach
// einem Neuladen keinen Spielstand mehr hat – überträgt die andere Seite ihren Stand in
// Teilen (Snapshot). Bei einer Abweichung gilt der Stand des Gastgebers.
//
// Ohne DOM: läuft im Browser und in Node (Tests).
(function (EK) {
  'use strict';

  const STEP = 1 / 60;
  const SUM_EVERY = 30;
  const CHUNK = 1800; // Zeichen je Snapshot-Teil (in zwei Strings ≤ 900 aufgeteilt)
  const ACT = EK.sim.ACTIONS.concat(['resign']);

  // ------------------------------------------------------------ Prüfsumme

  // FNV-1a über alle spielrelevanten Werte (Zahlen auf 1/16 gerundet). Rein optische
  // Werte wie der Turmwinkel (atan2, je nach Engine im letzten Bit verschieden) fehlen.
  function checksum(s) {
    let h = 0x811c9dc5 | 0;
    const mix = (v) => {
      const x = Math.round(v * 16) | 0;
      h = Math.imul(h ^ (x & 0xffff), 16777619);
      h = Math.imul(h ^ (x >>> 16), 16777619);
    };
    mix(s.rng);
    mix(s.nextId);
    mix(s.over ? 1 : 0);
    mix(s.winner);
    for (const p of s.players) {
      mix(p.gold);
      mix(p.xp);
      mix(p.baseHp);
      mix(p.age);
      mix(p.elite);
      mix(p.specialCd);
      mix(p.queue.length);
      for (const q of p.queue) {
        mix(q.def.key);
        mix(q.t);
      }
      for (const t of p.turrets) {
        mix(t ? t.age + 1 : 0);
        if (t) mix(t.cd);
      }
    }
    mix(s.units.length);
    for (const u of s.units) {
      mix(u.id);
      mix(u.def.key);
      mix(u.x);
      mix(u.hp);
      mix(u.cd);
    }
    mix(s.projectiles.length);
    for (const pr of s.projectiles) {
      mix(pr.t);
      mix(pr.tx);
      mix(pr.dmg);
    }
    mix(s.effects.length);
    for (const fx of s.effects) mix(fx.t);
    return h >>> 0;
  }

  // ------------------------------------------------------------ Snapshot-Kodierung

  function toB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Komprimiert (deflate + Base64), wo der Browser das kann; sonst Klartext.
  async function pack(str) {
    if (typeof CompressionStream === 'function' && typeof Blob === 'function' && typeof Response === 'function') {
      try {
        const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        return 'z' + toB64(new Uint8Array(await new Response(stream).arrayBuffer()));
      } catch (e) {
        /* Klartext */
      }
    }
    return 'j' + str;
  }

  async function unpack(data) {
    if (data[0] === 'z') {
      const stream = new Blob([fromB64(data.slice(1))]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    if (data[0] === 'j') return data.slice(1);
    throw new Error('Unbekanntes Snapshot-Format');
  }

  function split(str, size) {
    const out = [];
    for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
    return out.length ? out : [''];
  }

  const validCmd = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v)) && c[1] >= 0 && c[1] < ACT.length && c[0] >= 0 && c[2] > 0;

  // ------------------------------------------------------------ Lockstep

  class Lockstep {
    // o: { team, seed, round, delay?, need? }  need = true: Spielstand vom Gegner anfordern
    constructor(o) {
      this.team = o.team;
      this.opp = 1 - o.team;
      this.seed = o.seed >>> 0;
      this.round = o.round || 1;
      this.delay = o.delay || 15;
      this.s = EK.sim.createGame({ seed: this.seed, bonus: [1, 1] });
      this.tick = 0;
      this.seq = 0; // letzte eigene Befehlsnummer
      this.oppSeq = 0; // höchste übernommene Befehlsnummer des Gegners
      this.cmds = []; // eigene Befehle [tick, act, seq], bis der Gegner sie sicher hat
      this.plan = new Map(); // tick -> [{ team, act, seq }]
      this.oppUpto = -1;
      this.oppTick = -1;
      this.oppPaused = false;
      this.paused = false;
      this.sums = new Map();
      this.oppSums = new Map();
      this.lastSum = null;
      this.desyncs = 0;
      this.need = 0; // ≠ 0: wir warten auf einen Spielstand (Anfrage-Nummer)
      this.recv = null; // eingehender Snapshot { id, n, parts }
      this.out = null; // ausgehender Snapshot { id, parts, i }
      this.bothNeed = false;
      this.err = null;
      if (o.need) this.requestState();
    }

    // Eigener Befehl: gilt ab tick + delay. false, wenn gerade nicht möglich.
    local(action) {
      if (this.need || this.s.over) return false;
      const act = ACT.indexOf(action);
      if (act < 0) return false;
      const c = [this.tick + this.delay, act, ++this.seq];
      this.cmds.push(c);
      this.addPlan(this.team, c);
      return true;
    }

    addPlan(team, c) {
      let list = this.plan.get(c[0]);
      if (!list) this.plan.set(c[0], (list = []));
      list.push({ team, act: c[1], seq: c[2] });
    }

    // Felder für die eigene Presence – immer absoluter Zustand.
    presence() {
      const p = {
        t: this.need ? -1 : this.tick,
        u: this.need ? -1 : this.tick + this.delay - 1,
        c: this.cmds.slice(-40),
        h: this.lastSum,
        p: this.paused ? 1 : 0,
        nd: this.need || 0,
        sn: null,
        sa: null,
      };
      if (this.out && this.out.parts) {
        const i = Math.min(this.out.i, this.out.parts.length - 1);
        const part = this.out.parts[i];
        p.sn = { id: this.out.id, i, n: this.out.parts.length, d: [part.slice(0, 900), part.slice(900)] };
      }
      if (this.recv) p.sa = { id: this.recv.id, i: this.recv.have - 1 };
      return p;
    }

    // Presence des Gegners verarbeiten (null = nicht da).
    receive(o) {
      if (!o || typeof o !== 'object') return;
      this.oppPaused = o.p === 1;
      this.bothNeed = !!(this.need && o.nd);

      // Der Gegner braucht einen Spielstand: liefern (sofern wir selbst einen haben).
      if (o.nd && !this.need) {
        if (!this.out || this.out.id !== o.nd) this.serve(o.nd);
      } else if (!o.nd && this.out) {
        this.out = null;
      }
      if (this.out && this.out.parts && o.sa && o.sa.id === this.out.id && Number.isInteger(o.sa.i)) {
        this.out.i = Math.max(this.out.i, o.sa.i + 1);
        if (this.out.i >= this.out.parts.length) this.out = null; // vollständig angekommen
      }

      // Wir warten auf einen Spielstand: Teile einsammeln.
      if (this.need) {
        const sn = o.sn;
        if (sn && sn.id === this.need && Number.isInteger(sn.i) && Number.isInteger(sn.n) && sn.n > 0 && sn.n < 400 && Array.isArray(sn.d)) {
          if (!this.recv || this.recv.id !== sn.id || this.recv.n !== sn.n) this.recv = { id: sn.id, n: sn.n, parts: [], have: 0 };
          if (sn.i === this.recv.have) {
            this.recv.parts[sn.i] = sn.d.join('');
            this.recv.have++;
            if (this.recv.have === this.recv.n && !this.recv.busy) this.finish();
          }
        }
        return;
      }

      // Befehle des Gegners übernehmen (nur neue, in Reihenfolge).
      if (Array.isArray(o.c)) {
        const fresh = o.c.filter((c) => validCmd(c) && c[2] > this.oppSeq).sort((a, b) => a[2] - b[2]);
        for (const c of fresh) {
          if (c[0] < this.tick) {
            // Kam zu spät – darf nicht passieren; Stände würden auseinanderlaufen.
            this.onDesync();
            break;
          }
          this.addPlan(this.opp, c);
          this.oppSeq = c[2];
        }
      }
      if (Number.isInteger(o.u)) this.oppUpto = o.u;
      if (Number.isInteger(o.t)) {
        this.oppTick = o.t;
        // Was der Gegner schon ausgeführt hat, muss nicht mehr mitgeschickt werden.
        if (o.t >= 0) this.cmds = this.cmds.filter((c) => c[0] >= o.t);
      }
      if (Array.isArray(o.h) && Number.isInteger(o.h[0]) && Number.isInteger(o.h[1])) {
        const [T, h] = o.h;
        const mine = this.sums.get(T);
        if (mine !== undefined) {
          if (mine !== h) this.onDesync();
        } else if (T >= this.tick) {
          this.oppSums.set(T, h);
        }
      }
    }

    onDesync() {
      this.desyncs++;
      // Der Stand des Gastgebers (Team 0) gilt: der Gast fordert ihn an.
      if (this.team === 1) this.requestState();
    }

    requestState() {
      if (this.need) return;
      this.need = 1 + Math.floor(Math.random() * 1e9);
      this.recv = null;
      this.out = null;
    }

    // Spielstand für den Gegner verpacken. Bis er angekommen ist, rechnen wir nicht weiter.
    serve(id) {
      const out = { id, parts: null, i: 0 };
      this.out = out;
      const plan = [];
      for (const [t, list] of this.plan) if (t >= this.tick) for (const c of list) plan.push([t, c.team, c.act, c.seq]);
      const payload = JSON.stringify({
        v: 1,
        tick: this.tick,
        round: this.round,
        seed: this.seed,
        state: EK.sim.serialize(this.s),
        plan,
        seqOf: [this.team === 0 ? this.seq : this.oppSeq, this.team === 1 ? this.seq : this.oppSeq],
      });
      pack(payload).then((data) => {
        if (this.out === out) out.parts = split(data, CHUNK);
      });
    }

    async finish() {
      const recv = this.recv;
      recv.busy = true;
      try {
        const p = JSON.parse(await unpack(recv.parts.join('')));
        if (!p || p.v !== 1 || !Number.isInteger(p.tick)) throw new Error('Snapshot ungültig');
        const s = EK.sim.deserialize(p.state);
        if (this.recv !== recv) return; // inzwischen neue Anfrage
        this.s = s;
        this.tick = p.tick;
        this.round = p.round;
        this.seed = p.seed >>> 0;
        this.plan = new Map();
        for (const [t, team, act, seq] of p.plan) this.addPlan(team, [t, act, seq]);
        // Eigene Nummern weiterzählen, wo der Gegner aufgehört hat – sonst ignoriert er neue Befehle.
        this.seq = Math.max(this.seq, p.seqOf[this.team]);
        this.oppSeq = p.seqOf[this.opp];
        this.cmds = [];
        this.sums.clear();
        this.oppSums.clear();
        this.lastSum = null;
        this.oppUpto = -1;
        this.need = 0;
        this.recv = null;
      } catch (e) {
        this.err = e;
        // Erneut anfordern
        this.need = 0;
        this.recv = null;
        this.requestState();
      }
    }

    // Darf der nächste Tick laufen?
    canRun() {
      return !this.need && !this.out && !this.paused && !this.s.over && this.tick <= this.oppUpto;
    }

    // Wartet die Partie gerade auf den Gegner?
    stalled() {
      return !this.s.over && !this.paused && (this.need !== 0 || !!this.out || this.tick > this.oppUpto);
    }

    // Bis zu max Ticks ausführen; liefert die Anzahl.
    step(max) {
      let n = 0;
      while (n < max && this.canRun()) {
        this.runTick();
        n++;
      }
      return n;
    }

    runTick() {
      const T = this.tick;
      const list = this.plan.get(T);
      if (list) {
        list.sort((a, b) => a.team - b.team || a.seq - b.seq);
        for (const c of list) {
          const action = ACT[c.act];
          if (action === 'resign') EK.sim.resign(this.s, c.team);
          else EK.sim.command(this.s, c.team, action);
        }
        this.plan.delete(T);
      }
      EK.sim.update(this.s, STEP);
      this.tick = T + 1;
      if (this.tick % SUM_EVERY === 0) {
        const h = checksum(this.s);
        this.sums.set(this.tick, h);
        if (this.sums.size > 12) this.sums.delete(this.sums.keys().next().value);
        this.lastSum = [this.tick, h];
        const o = this.oppSums.get(this.tick);
        if (o !== undefined) {
          this.oppSums.delete(this.tick);
          if (o !== h) this.onDesync();
        }
        for (const t of this.oppSums.keys()) if (t < this.tick) this.oppSums.delete(t);
      }
    }

    // Für Live-Updates der Seite: alles Nötige, um die Partie nach dem Neuladen fortzusetzen.
    save() {
      const plan = [];
      for (const [t, list] of this.plan) for (const c of list) plan.push([t, c.team, c.act, c.seq]);
      return { team: this.team, seed: this.seed, round: this.round, delay: this.delay, tick: this.tick, seq: this.seq, oppSeq: this.oppSeq, cmds: this.cmds, plan, state: EK.sim.serialize(this.s) };
    }

    static load(d) {
      const ls = new Lockstep({ team: d.team, seed: d.seed, round: d.round, delay: d.delay });
      ls.s = EK.sim.deserialize(d.state);
      ls.tick = d.tick;
      ls.seq = d.seq;
      ls.oppSeq = d.oppSeq;
      ls.cmds = d.cmds.filter(validCmd);
      for (const [t, team, act, seq] of d.plan) ls.addPlan(team, [t, act, seq]);
      return ls;
    }
  }

  EK.net = { Lockstep, checksum, pack, unpack, ACT, SUM_EVERY };
})((globalThis.EK = globalThis.EK || {}));
