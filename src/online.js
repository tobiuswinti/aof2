// Online-Lobby und -Partie über die room-Fähigkeit des claude.ai-Viewers.
//
// Lobby = der gemeinsame Raum aller, die die Seite gerade offen haben. Wer ein Spiel
// eröffnet, zeigt das in seiner Presence (st: 'host', g: Code); andere sehen es und
// treten bei. Gespielt wird in einem eigenen Raum „ek-<code>“ (Fallback: die Lobby
// selbst). Übertragen wird ausschließlich Presence – die darf jeder Eingeladene setzen,
// auch ohne Bearbeitungsrechte. Die Partie selbst rechnet EK.net.Lockstep.
(function (EK) {
  'use strict';

  const APP = 'ek1';
  const SAVE_KEY = 'ek-online';

  function code6() {
    const a = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  // Gesichert wird pro Tab (sessionStorage übersteht das Neuladen) und zusätzlich in
  // localStorage für den Fall, dass das Handy die App ganz beendet. Beim Laden hat der
  // Tab-Speicher Vorrang – sonst würden zwei Tabs im selben Browser ihre Rollen tauschen.
  function storages() {
    const out = [];
    for (const name of ['sessionStorage', 'localStorage']) {
      try {
        if (window[name]) out.push(window[name]);
      } catch (e) {
        /* Speicher nicht verfügbar */
      }
    }
    return out;
  }

  function store(val) {
    for (const st of storages()) {
      try {
        if (val) st.setItem(SAVE_KEY, JSON.stringify(val));
        else st.removeItem(SAVE_KEY);
      } catch (e) {
        /* ignorieren */
      }
    }
  }

  function loadSave() {
    for (const st of storages()) {
      try {
        const d = JSON.parse(st.getItem(SAVE_KEY));
        // Nur frische Partien (≤ 20 min) mit plausiblen Werten
        if (d && typeof d.code === 'string' && /^[a-z0-9]{6}$/.test(d.code) && (d.role === 'host' || d.role === 'guest') && Number.isInteger(d.round) && Number.isInteger(d.seed) && Date.now() - d.at < 20 * 60 * 1000) return d;
      } catch (e) {
        /* nächster Speicher */
      }
    }
    return null;
  }

  class Online {
    constructor() {
      // idle | connecting | unavailable | lobby | hosting | joining | play
      this.state = 'idle';
      this.room = null;
      this.user = null;
      this.ch = null;
      this.chUnsub = null;
      this.lobbyPeers = [];
      this.game = null; // { code, role, team, round, seed }
      this.ls = null;
      this.opp = null;
      this.oppPresence = null;
      this.oppGoneSince = 0;
      this.rematch = false;
      this.names = new Map();
      this.connected = false;
      this.joinedAt = Date.now();
      this.lastPub = 0;
      this.bothNeedSince = 0;
      this.onStart = null; // Rückruf: neue Partie (oder neue Runde) beginnt
    }

    static available() {
      return !!(typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function');
    }

    savedGame() {
      return loadSave();
    }

    async init() {
      if (this.room || this.state === 'connecting') return;
      if (!Online.available()) {
        this.state = 'unavailable';
        return;
      }
      this.state = 'connecting';
      let room = null;
      try {
        room = await window.claude.use('room');
      } catch (e) {
        room = null;
      }
      if (!room) {
        this.state = 'unavailable';
        return;
      }
      this.room = room;
      try {
        this.user = await window.claude.use('user');
      } catch (e) {
        this.user = null;
      }
      room.onPeers(
        (c) => {
          this.lobbyPeers = c.peers;
          this.resolveNames(c.peers);
        },
        () => {
          this.state = 'unavailable';
        }
      );
      room.onConnection(
        (c) => (this.connected = c),
        () => {}
      );
      this.lobbyPeers = room.peers();
      this.connected = room.connected();
      if (this.state === 'connecting') this.state = 'lobby';
      this.setLobby({ app: APP, st: 'lobby', g: null });
    }

    setLobby(patch) {
      if (!this.room) return;
      this.room.presence(patch).catch(() => {});
    }

    resolveNames(peers) {
      if (!this.user || typeof this.user.profiles !== 'function') return;
      const ids = peers.map((p) => p.by).filter((id) => id && !this.names.has(id));
      if (!ids.length) return;
      for (const id of ids) this.names.set(id, '');
      Promise.resolve(this.user.profiles(ids))
        .then((ps) => {
          for (const id of ids) {
            const p = ps && ps[id];
            this.names.set(id, (p && p.name) || '');
          }
        })
        .catch(() => {});
    }

    nameOf(peer) {
      const n = peer && peer.by ? this.names.get(peer.by) : '';
      return (n || 'Spieler').slice(0, 20);
    }

    // Andere Anwesende in der Lobby (ohne diesen Tab)
    others() {
      return this.lobbyPeers.filter((p) => !p.sameTab && p.kind === 'viewer');
    }

    // Offene Spiele anderer Anwesender
    openGames() {
      return this.others().filter((p) => p.presence && p.presence.app === APP && p.presence.st === 'host' && typeof p.presence.g === 'string' && /^[a-z0-9]{6}$/.test(p.presence.g));
    }

    async host() {
      if (!this.room) return;
      const g = { code: code6(), role: 'host', team: 0, round: 1, seed: Math.floor(Math.random() * 2147483647) };
      this.game = g;
      this.rematch = false;
      this.state = 'hosting';
      await this.openChannel(g.code);
      this.setLobby({ st: 'host', g: g.code });
    }

    async join(peer) {
      if (!this.room || !peer || !peer.presence) return;
      const g = { code: peer.presence.g, role: 'guest', team: 1, round: 0, seed: 0 };
      this.game = g;
      this.rematch = false;
      this.state = 'joining';
      await this.openChannel(g.code);
      this.setLobby({ st: 'play', g: g.code });
    }

    // Nach einem Neuladen derselben Partie wieder beitreten; den Stand liefert der Gegner.
    async resume(saved) {
      await this.init();
      if (!this.room || !saved) return false;
      this.game = { code: saved.code, role: saved.role, team: saved.role === 'host' ? 0 : 1, round: saved.round, seed: saved.seed };
      this.ls = new EK.net.Lockstep({ team: this.game.team, seed: saved.seed, round: saved.round, need: true });
      this.state = 'play';
      await this.openChannel(saved.code);
      this.setLobby({ st: 'play', g: saved.code });
      if (this.onStart) this.onStart(this.ls, true);
      return true;
    }

    // Live-Update der Seite: laufende Partie inklusive Lockstep-Zustand übernehmen.
    async restore(d) {
      await this.init();
      if (!this.room || !d || !d.game || !d.ls) return false;
      this.game = d.game;
      this.ls = EK.net.Lockstep.load(d.ls);
      this.state = 'play';
      await this.openChannel(d.game.code);
      this.setLobby({ st: 'play', g: d.game.code });
      if (this.onStart) this.onStart(this.ls, true);
      return true;
    }

    snapshot() {
      if (this.state !== 'play' || !this.ls || !this.game) return null;
      return { game: this.game, ls: this.ls.save() };
    }

    async openChannel(code) {
      if (this.chUnsub) this.chUnsub();
      let ch = null;
      try {
        ch = await this.room.join('ek-' + code);
      } catch (e) {
        ch = null;
      }
      this.ch = ch || this.room; // Fallback: in der Lobby spielen
      this.chUnsub = this.ch.onPeers(
        (c) => this.onGamePeers(c.peers),
        () => {}
      );
      this.joinedAt = Date.now();
      this.onGamePeers(this.ch.peers());
      this.publish(true);
    }

    onGamePeers(peers) {
      const g = this.game;
      if (!g) return;
      const want = g.role === 'host' ? 'guest' : 'host';
      const cands = peers.filter((p) => !p.sameTab && p.presence && p.presence.app === APP && p.presence.g === g.code && p.presence.r === want);
      cands.sort((a, b) => (Number(b.presence.j) || 0) - (Number(a.presence.j) || 0));
      this.opp = cands[0] || null;
      this.resolveNames(cands);
    }

    oppName() {
      return this.opp ? this.nameOf(this.opp) : 'Gegner';
    }

    // Wie lange der Gegner schon fehlt (ms), 0 = da
    oppMissing() {
      if (this.opp) {
        this.oppGoneSince = 0;
        return 0;
      }
      if (!this.oppGoneSince) this.oppGoneSince = performance.now();
      return performance.now() - this.oppGoneSince;
    }

    startRound(round, seed) {
      const g = this.game;
      g.round = round;
      g.seed = seed;
      this.rematch = false;
      this.ls = new EK.net.Lockstep({ team: g.team, seed, round });
      this.state = 'play';
      store({ code: g.code, role: g.role, round, seed, at: Date.now() });
      if (this.onStart) this.onStart(this.ls, false);
    }

    requestRematch() {
      this.rematch = true;
      this.publish(true);
    }

    resign() {
      if (this.ls && !this.ls.s.over) this.ls.local('resign');
    }

    // Jeden Frame: Runden starten, Gegner-Presence verarbeiten, eigene veröffentlichen.
    update() {
      const g = this.game;
      if (!g || !this.ch) return;
      const op = this.opp ? this.opp.presence : null;
      if (g.role === 'host') {
        if (this.state === 'hosting' && op) this.startRound(1, g.seed);
        // Revanche: beide wollen → neue Runde mit neuem Seed
        if (this.ls && this.ls.s.over && this.rematch && op && op.rm === g.round) this.startRound(g.round + 1, Math.floor(Math.random() * 2147483647));
        // Beide haben ihren Stand verloren (z. B. beide neu geladen): neue Runde
        if (this.ls && this.ls.bothNeed) {
          if (!this.bothNeedSince) this.bothNeedSince = performance.now();
          else if (performance.now() - this.bothNeedSince > 1500) {
            this.bothNeedSince = 0;
            this.startRound(g.round + 1, Math.floor(Math.random() * 2147483647));
          }
        } else this.bothNeedSince = 0;
      } else if (op && Number.isInteger(op.rd) && op.rd >= 1 && Number.isInteger(op.sd)) {
        // Gast folgt der Runde des Gastgebers
        if (!this.ls || op.rd > this.ls.round) this.startRound(op.rd, op.sd);
      }
      if (this.ls && op && op !== this.oppPresence) {
        this.oppPresence = op;
        if (op.rd === this.ls.round && op.ls) this.ls.receive(op.ls);
      }
      this.publish(false);
    }

    publish(force) {
      const g = this.game;
      if (!g || !this.ch) return;
      const now = performance.now();
      if (!force && now - this.lastPub < 32) return; // ~30 pro Sekunde reicht
      this.lastPub = now;
      const patch = {
        app: APP,
        g: g.code,
        r: g.role,
        rd: this.ls ? this.ls.round : g.round,
        sd: g.role === 'host' ? g.seed : null,
        rm: this.rematch ? g.round : 0,
        j: this.joinedAt,
        ls: this.ls ? this.ls.presence() : null,
      };
      this.ch.presence(patch).catch(() => {});
    }

    async leave() {
      store(null);
      const ch = this.ch;
      if (this.chUnsub) this.chUnsub();
      this.chUnsub = null;
      this.ch = null;
      this.game = null;
      this.ls = null;
      this.opp = null;
      this.oppPresence = null;
      this.rematch = false;
      if (ch && ch !== this.room) await ch.leave().catch(() => {});
      else if (ch) ch.presence({ g: null, r: null, rd: null, sd: null, rm: null, j: null, ls: null }).catch(() => {});
      this.state = this.room ? 'lobby' : 'idle';
      this.setLobby({ app: APP, st: 'lobby', g: null });
    }
  }

  EK.Online = Online;
})((globalThis.EK = globalThis.EK || {}));
