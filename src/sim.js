// Spielsimulation: deterministisch, ohne DOM. Wird mit festem Zeitschritt aktualisiert.
// Darstellung und Ton lesen nur den Zustand und die Ereignisliste (state.events).
(function (EK) {
  'use strict';

  const D = EK.data;
  const R = D.RULES;

  const ACTIONS = ['unit0', 'unit1', 'unit2', 'special', 'turret', 'slot', 'sell', 'evolve'];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makePlayer(team, bonus) {
    return {
      team,
      // Wirtschaftsfaktor (Handicap): skaliert Einkommen, Kopfgeld und XP.
      bonus: bonus || 1,
      elite: 0,
      dir: team === 0 ? 1 : -1,
      age: 0,
      gold: R.startGold,
      xp: 0,
      baseHp: D.AGES[0].baseHp,
      baseMaxHp: D.AGES[0].baseHp,
      baseHurt: 0,
      queue: [],
      turrets: [null],
      specialCd: R.specialFirstCd,
      evolveFlash: 0,
      stats: { kills: 0, lost: 0, goldEarned: 0, unitsTrained: 0 },
    };
  }

  // Nächste Zufallszahl aus dem im Zustand gespeicherten Mulberry32-Zähler.
  function attachRand(s) {
    s.rand = () => {
      s.rng = (s.rng + 0x6d2b79f5) >>> 0;
      let t = s.rng;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return s;
  }

  function createGame(opts) {
    opts = opts || {};
    return attachRand({
      time: 0,
      over: false,
      winner: -1,
      nextId: 1,
      players: [makePlayer(0, opts.bonus && opts.bonus[0]), makePlayer(1, opts.bonus && opts.bonus[1])],
      bases: [
        { isBase: true, team: 0 },
        { isBase: true, team: 1 },
      ],
      units: [],
      projectiles: [],
      effects: [],
      events: [],
      // Zufallszustand liegt im Spielzustand, damit er sich speichern lässt.
      rng: (opts.seed != null ? opts.seed : Date.now() & 0xffffffff) >>> 0,
      rand: null,
    });
  }

  // ---------------------------------------------------------------- Speichern

  // Spielzustand als JSON: Definitionen werden als Schlüssel abgelegt, Sets als Arrays.
  function serialize(s) {
    return JSON.stringify(s, function (k, v) {
      if (k === 'rand' || k === 'events') return undefined;
      if (k === 'def' && v && typeof v === 'object') {
        if (v.look) return { unitKey: v.key };
        if (v.kind) return { specialAge: v.age };
      }
      if (v instanceof Set) return { setOf: Array.from(v) };
      return v;
    });
  }

  function deserialize(json) {
    const s = JSON.parse(json, function (k, v) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (Array.isArray(v.setOf)) return new Set(v.setOf);
        if (k === 'def' && v.unitKey != null) return D.unitDef(Math.floor(v.unitKey / 10), v.unitKey % 10);
        if (k === 'def' && v.specialAge != null) return D.specialDef(v.specialAge);
      }
      return v;
    });
    validate(s);
    s.events = [];
    return attachRand(s);
  }

  // Strukturprüfung eines geladenen Stands – ein inkonsistenter Stand würde sonst erst
  // beim Zeichnen (z. B. Siegbildschirm ohne Sieger) scheitern.
  function validate(s) {
    const fail = (why) => {
      throw new Error('Ungültiger Spielstand: ' + why);
    };
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    const last = D.AGES.length - 1;
    if (!s || typeof s !== 'object' || !Array.isArray(s.players) || s.players.length !== 2) fail('Spieler');
    if (!Array.isArray(s.units) || !Array.isArray(s.projectiles) || !Array.isArray(s.effects)) fail('Listen');
    if (typeof s.over !== 'boolean' || !num(s.time) || !num(s.rng)) fail('Kopf');
    if (s.over ? !int(s.winner, 0, 1) : s.winner !== -1) fail('Sieger');
    s.players.forEach((p, i) => {
      if (!p || p.team !== i || !int(p.age, 0, last) || !int(p.elite, 0, R.eliteMax)) fail('Spieler ' + i);
      if (![p.gold, p.xp, p.baseHp, p.baseMaxHp, p.specialCd, p.bonus].every(num) || p.baseMaxHp <= 0) fail('Werte ' + i);
      if (!Array.isArray(p.turrets) || p.turrets.length < 1 || p.turrets.length > R.maxSlots) fail('Türme ' + i);
      for (const t of p.turrets) if (t !== null && (!t || !int(t.age, 0, p.age) || !num(t.cd))) fail('Turm ' + i);
      if (!Array.isArray(p.queue) || p.queue.length > R.queueMax) fail('Warteschlange ' + i);
      for (const q of p.queue) if (!q || !q.def || !q.def.look || !num(q.t)) fail('Auftrag ' + i);
    });
    for (const u of s.units) {
      if (!u || !u.def || !u.def.look || (u.team !== 0 && u.team !== 1) || ![u.x, u.hp, u.maxHp].every(num)) fail('Einheit');
    }
  }

  function emit(s, ev) {
    s.events.push(ev);
  }

  // ---------------------------------------------------------------- Befehle

  function actionInfo(s, team, action) {
    const p = s.players[team];
    const info = { enabled: false, cost: 0, label: '', progress: 0, ready: false };
    switch (action) {
      case 'unit0':
      case 'unit1':
      case 'unit2': {
        const def = D.unitDef(p.age, +action[4]);
        info.cost = def.cost;
        info.label = def.name;
        info.def = def;
        info.enabled = p.gold >= def.cost && p.queue.length < R.queueMax;
        break;
      }
      case 'special': {
        const sp = D.specialDef(p.age);
        info.label = sp.name;
        info.kind = sp.kind;
        info.progress = 1 - p.specialCd / R.specialCd;
        info.enabled = p.specialCd <= 0;
        info.ready = info.enabled;
        info.cooldown = Math.max(0, p.specialCd);
        break;
      }
      case 'turret': {
        const td = D.turretDef(p.age);
        info.cost = td.cost;
        info.label = td.name;
        info.def = td;
        info.enabled = p.gold >= td.cost && p.turrets.indexOf(null) !== -1;
        info.full = p.turrets.indexOf(null) === -1;
        break;
      }
      case 'slot': {
        const n = p.turrets.length;
        info.label = 'Turmplatz';
        info.max = n >= R.maxSlots;
        info.cost = info.max ? 0 : R.slotCost[n];
        info.enabled = !info.max && p.gold >= info.cost;
        break;
      }
      case 'sell': {
        const i = sellIndex(p);
        info.label = 'Turm verkaufen';
        info.enabled = i !== -1;
        info.cost = i === -1 ? 0 : refund(p.turrets[i]);
        break;
      }
      case 'evolve': {
        const need = evolveNeed(p);
        const last = !D.AGES[p.age].xpNext;
        info.elite = last;
        if (!last) info.label = 'Nächstes Zeitalter: ' + D.AGES[p.age + 1].name;
        else info.label = need ? 'Elite-Ausbildung ' + (p.elite + 1) + '/' + R.eliteMax : 'Elite-Stufe maximal';
        info.max = !need;
        info.progress = need ? Math.min(1, p.xp / need) : 1;
        info.enabled = !!need && p.xp >= need;
        info.ready = info.enabled;
        break;
      }
    }
    return info;
  }

  function command(s, team, action) {
    if (s.over) return false;
    const p = s.players[team];
    let ok = false;
    switch (action) {
      case 'unit0':
      case 'unit1':
      case 'unit2':
        ok = orderUnit(s, p, +action[4]);
        break;
      case 'special':
        ok = useSpecial(s, p);
        break;
      case 'turret':
        ok = buyTurret(s, p);
        break;
      case 'slot':
        ok = buySlot(s, p);
        break;
      case 'sell':
        ok = sellTurret(s, p);
        break;
      case 'evolve':
        ok = evolve(s, p);
        break;
    }
    if (!ok) emit(s, { type: 'deny', team });
    return ok;
  }

  function orderUnit(s, p, idx) {
    const def = D.unitDef(p.age, idx);
    if (p.queue.length >= R.queueMax || p.gold < def.cost) return false;
    p.gold -= def.cost;
    p.queue.push({ def, t: 0 });
    emit(s, { type: 'order', team: p.team });
    return true;
  }

  function buyTurret(s, p) {
    const slot = p.turrets.indexOf(null);
    const td = D.turretDef(p.age);
    if (slot === -1 || p.gold < td.cost) return false;
    p.gold -= td.cost;
    p.turrets[slot] = { age: p.age, cd: 0.6, angle: p.team === 0 ? -0.15 : Math.PI + 0.15, fire: 0 };
    emit(s, { type: 'build', team: p.team, slot });
    return true;
  }

  function buySlot(s, p) {
    const n = p.turrets.length;
    if (n >= R.maxSlots || p.gold < R.slotCost[n]) return false;
    p.gold -= R.slotCost[n];
    p.turrets.push(null);
    emit(s, { type: 'build', team: p.team, slot: n });
    return true;
  }

  // Verkauft den ältesten Turm (bei Gleichstand den obersten).
  function sellIndex(p) {
    let best = -1;
    for (let i = 0; i < p.turrets.length; i++) {
      const t = p.turrets[i];
      if (t && (best === -1 || t.age <= p.turrets[best].age)) best = i;
    }
    return best;
  }

  function refund(t) {
    return Math.floor(D.turretDef(t.age).cost * R.sellRefund);
  }

  function sellTurret(s, p) {
    const i = sellIndex(p);
    if (i === -1) return false;
    const r = refund(p.turrets[i]);
    p.gold += r;
    p.turrets[i] = null;
    const pos = D.turretPos(p.team, i);
    emit(s, { type: 'sell', team: p.team, slot: i, amount: r, x: pos.x, y: pos.y });
    return true;
  }

  // XP-Bedarf für den nächsten Aufstieg bzw. (im letzten Zeitalter) die nächste Elite-Stufe.
  function evolveNeed(p) {
    const age = D.AGES[p.age];
    if (age.xpNext) return age.xpNext;
    return p.elite < R.eliteMax ? age.xpElite : 0;
  }

  function evolve(s, p) {
    const need = evolveNeed(p);
    if (!need || p.xp < need) return false;
    p.xp -= need;
    if (!D.AGES[p.age].xpNext) {
      p.elite += 1;
      p.evolveFlash = 1.2;
      emit(s, { type: 'elite', team: p.team, level: p.elite });
      return true;
    }
    p.age += 1;
    const ratio = p.baseHp / p.baseMaxHp;
    p.baseMaxHp = D.AGES[p.age].baseHp;
    // Beim Aufstieg wird die Basis um ein Viertel repariert.
    p.baseHp = Math.min(p.baseMaxHp, Math.round(p.baseMaxHp * Math.min(1, ratio + 0.25)));
    p.evolveFlash = 1.6;
    emit(s, { type: 'evolve', team: p.team, age: p.age });
    return true;
  }

  function useSpecial(s, p) {
    if (p.specialCd > 0) return false;
    p.specialCd = R.specialCd;
    const sp = D.specialDef(p.age);
    const fx = { kind: sp.kind, team: p.team, dir: p.dir, def: sp, t: 0, done: false };
    const front = D.baseFront(p.team);
    const enemyFront = D.baseFront(1 - p.team);
    switch (sp.kind) {
      case 'boulders':
        fx.items = [];
        for (let i = 0; i < sp.count; i++) {
          fx.items.push({ x: front - p.dir * 30, delay: i * 0.45, hit: new Set(), rot: 0, r: sp.radius - i * 2 });
        }
        break;
      case 'lightning':
        fx.strikes = [];
        fx.next = 0;
        fx.fired = 0;
        break;
      case 'arrows':
        fx.items = [];
        fx.spawned = 0;
        break;
      case 'cannonade':
        fx.balls = [];
        fx.next = 0.3;
        fx.fired = 0;
        break;
      case 'airstrike':
        fx.planeX = front - p.dir * 220;
        fx.nextDrop = front + p.dir * 40;
        fx.bombs = [];
        fx.end = enemyFront;
        break;
      case 'orbital':
        fx.beamX = front + p.dir * 30;
        fx.end = enemyFront;
        fx.hit = new Set();
        fx.warm = 0.5;
        break;
    }
    s.effects.push(fx);
    emit(s, { type: 'special', team: p.team, kind: sp.kind });
    return true;
  }

  // ---------------------------------------------------------------- Kampf

  function edgeGap(a, b) {
    return Math.abs(a.x - b.x) - (a.def.w + b.def.w) / 2;
  }

  function baseGap(u, enemyTeam) {
    const f = D.baseFront(enemyTeam);
    return enemyTeam === 1 ? f - (u.x + u.def.w / 2) : u.x - u.def.w / 2 - f;
  }

  function damage(s, target, dmg, team) {
    if (s.over) return;
    const attacker = s.players[team];
    if (target.isBase) {
      const p = s.players[target.team];
      p.baseHp -= dmg;
      p.baseHurt = 0.25;
      attacker.xp += dmg * R.baseDmgXp * attacker.bonus;
      if (p.baseHp <= 0) {
        p.baseHp = 0;
        s.over = true;
        s.winner = team;
        emit(s, { type: 'win', team });
      }
      return;
    }
    if (target.dead) return;
    target.hp -= dmg;
    target.hurt = 0.18;
    if (target.hp <= 0) {
      target.dead = true;
      const gold = Math.round(target.def.cost * R.killGold * attacker.bonus);
      attacker.gold += gold;
      attacker.xp += target.def.cost * R.killXp * attacker.bonus;
      attacker.stats.kills += 1;
      attacker.stats.goldEarned += gold;
      s.players[target.team].stats.lost += 1;
      emit(s, { type: 'death', unit: target, killer: team, gold });
    }
  }

  function frontAlive(list) {
    for (let i = 0; i < list.length; i++) if (!list[i].dead) return list[i];
    return null;
  }

  function launch(s, opts) {
    const pt = D.PROJ[opts.type];
    const dx = opts.tx - opts.sx;
    const dist = Math.hypot(dx, opts.ty - opts.sy);
    const T = Math.max(opts.type === 'laser' ? 0.07 : 0.05, dist / pt.speed);
    s.projectiles.push({
      type: opts.type,
      team: opts.team,
      sx: opts.sx,
      sy: opts.sy,
      tx: opts.tx,
      ty: opts.ty,
      t: 0,
      T,
      arc: pt.arc * Math.abs(dx),
      dmg: opts.dmg,
      splash: opts.splash || 0,
      targetId: opts.targetId,
      isBase: !!opts.isBase,
    });
    emit(s, { type: 'fire', proj: opts.type, team: opts.team, x: opts.sx, y: opts.sy, dir: Math.sign(dx) || 1 });
  }

  function aimAt(target, flight, enemyTeam) {
    if (target.isBase) {
      const f = D.baseFront(enemyTeam);
      return { x: f + (enemyTeam === 0 ? -26 : 26), y: D.GROUND_Y - 70 };
    }
    const lead = target.state === 'walk' ? target.def.speed * target.dir * flight : 0;
    const h = target.def.mount ? 32 : 24;
    return { x: target.x + lead, y: D.GROUND_Y - h };
  }

  function unitAttack(s, u, target) {
    u.cd = u.def.rate;
    u.atk = 0.35;
    const dmg = u.def.dmg * u.mul;
    if (u.def.proj) {
      const sx = u.x + u.dir * (u.def.w / 2);
      const sy = D.GROUND_Y - (u.def.mount ? 34 : 30);
      const enemyTeam = 1 - u.team;
      const guess = aimAt(target, 0, enemyTeam);
      const flight = Math.abs(guess.x - sx) / D.PROJ[u.def.proj].speed;
      const aim = aimAt(target, flight, enemyTeam);
      launch(s, {
        type: u.def.proj,
        team: u.team,
        sx,
        sy,
        tx: aim.x,
        ty: aim.y,
        dmg,
        splash: u.def.splash,
        targetId: target.isBase ? 0 : target.id,
        isBase: target.isBase,
      });
    } else {
      damage(s, target, dmg, u.team);
      const hx = target.isBase ? D.baseFront(target.team) : target.x - u.dir * (target.def.w / 2);
      emit(s, { type: 'melee', team: u.team, x: hx, y: D.GROUND_Y - 26, weapon: u.def.look.weapon, mount: u.def.mount });
    }
  }

  function updateUnits(s, dt) {
    const lists = [[], []];
    for (const u of s.units) if (!u.dead) lists[u.team].push(u);
    lists[0].sort((a, b) => b.x - a.x);
    lists[1].sort((a, b) => a.x - b.x);

    for (let team = 0; team < 2; team++) {
      const own = lists[team];
      const foes = lists[1 - team];
      const enemyTeam = 1 - team;
      for (let i = 0; i < own.length; i++) {
        const u = own[i];
        if (u.dead) continue;
        u.cd -= dt;
        u.atk = Math.max(0, u.atk - dt);
        u.hurt = Math.max(0, u.hurt - dt);

        let ahead = null;
        for (let j = i - 1; j >= 0; j--) {
          if (!own[j].dead) {
            ahead = own[j];
            break;
          }
        }
        const enemy = frontAlive(foes);
        const gapEnemy = enemy ? edgeGap(u, enemy) : Infinity;
        const gapBase = baseGap(u, enemyTeam);

        let target = null;
        if (enemy && gapEnemy <= u.def.range) target = enemy;
        else if (gapBase <= u.def.range) target = s.bases[enemyTeam];

        if (target) {
          u.state = 'fight';
          if (u.cd <= 0) unitAttack(s, u, target);
          continue;
        }
        let move = u.def.speed * dt;
        if (ahead) move = Math.min(move, edgeGap(u, ahead) - R.allyGap);
        move = Math.min(move, gapEnemy, gapBase);
        if (move > 0.01) {
          u.x += u.dir * move;
          u.walk += move;
          u.state = 'walk';
        } else {
          u.state = 'wait';
        }
      }
    }
  }

  function spawnUnits(s) {
    for (const p of s.players) {
      if (!p.queue.length) continue;
      const q = p.queue[0];
      if (q.t < q.def.train) continue;
      let count = 0;
      const x = D.baseFront(p.team) + p.dir * (q.def.w / 2 + 6);
      let blocked = false;
      for (const u of s.units) {
        if (u.dead || u.team !== p.team) continue;
        count++;
        if (Math.abs(u.x - x) < (u.def.w + q.def.w) / 2 + R.allyGap) blocked = true;
      }
      if (blocked || count >= R.fieldCap) continue;
      p.queue.shift();
      const mul = 1 + p.elite * R.eliteBonus;
      const u = {
        id: s.nextId++,
        team: p.team,
        dir: p.dir,
        def: q.def,
        x,
        hp: q.def.hp * mul,
        maxHp: q.def.hp * mul,
        mul,
        elite: p.elite,
        cd: 0.3,
        atk: 0,
        hurt: 0,
        walk: s.rand() * 20,
        lane: (s.nextId * 7) % 5,
        state: 'walk',
        dead: false,
        born: s.time,
      };
      s.units.push(u);
      p.stats.unitsTrained += 1;
      emit(s, { type: 'spawn', team: p.team, x });
    }
  }

  function updateTurrets(s, dt) {
    for (const p of s.players) {
      const enemyTeam = 1 - p.team;
      const front = D.baseFront(p.team);
      // Vorderster Gegner = am nächsten an der eigenen Basis.
      let target = null;
      let best = Infinity;
      for (const u of s.units) {
        if (u.dead || u.team !== enemyTeam) continue;
        const d = Math.abs(u.x - front) - u.def.w / 2;
        if (d < best) {
          best = d;
          target = u;
        }
      }
      for (let i = 0; i < p.turrets.length; i++) {
        const t = p.turrets[i];
        if (!t) continue;
        const td = D.turretDef(t.age);
        t.cd -= dt;
        t.fire = Math.max(0, t.fire - dt);
        if (!target || best > td.range) continue;
        const pos = D.turretPos(p.team, i);
        const want = Math.atan2(D.GROUND_Y - 24 - pos.y, target.x - pos.x);
        t.angle += (want - t.angle) * Math.min(1, dt * 8);
        if (t.cd > 0) continue;
        t.cd = td.rate;
        t.fire = 0.25;
        const sx = pos.x + p.dir * 22;
        const flight = Math.abs(target.x - sx) / D.PROJ[td.proj].speed;
        const aim = aimAt(target, flight, enemyTeam);
        launch(s, {
          type: td.proj,
          team: p.team,
          sx,
          sy: pos.y - 6,
          tx: aim.x,
          ty: aim.y,
          dmg: td.dmg,
          splash: td.splash,
          targetId: target.id,
        });
      }
    }
  }

  function findUnit(s, id) {
    for (const u of s.units) if (u.id === id) return u;
    return null;
  }

  function nearestEnemy(s, team, x, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const u of s.units) {
      if (u.dead || u.team === team) continue;
      const d = Math.abs(u.x - x) - u.def.w / 2;
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  function splashDamage(s, team, x, radius, dmg, hitBase) {
    for (const u of s.units) {
      if (u.dead || u.team === team) continue;
      if (Math.abs(u.x - x) <= radius + u.def.w / 2) damage(s, u, dmg, team);
    }
    if (hitBase) {
      const enemyTeam = 1 - team;
      const f = D.baseFront(enemyTeam);
      const inside = enemyTeam === 0 ? x <= f + radius : x >= f - radius;
      if (inside) damage(s, s.bases[enemyTeam], dmg, team);
    }
  }

  function updateProjectiles(s, dt) {
    const keep = [];
    for (const pr of s.projectiles) {
      pr.t += dt;
      if (pr.t < pr.T) {
        keep.push(pr);
        continue;
      }
      if (pr.splash > 0) {
        splashDamage(s, pr.team, pr.tx, pr.splash, pr.dmg, true);
        if (pr.isBase) {
          const f = D.baseFront(1 - pr.team);
          const inside = pr.team === 0 ? pr.tx >= f - pr.splash : pr.tx <= f + pr.splash;
          if (!inside) damage(s, s.bases[1 - pr.team], pr.dmg, pr.team);
        }
      } else if (pr.isBase) {
        damage(s, s.bases[1 - pr.team], pr.dmg, pr.team);
      } else {
        let t = findUnit(s, pr.targetId);
        if (!t || t.dead || Math.abs(t.x - pr.tx) > t.def.w / 2 + 26) t = nearestEnemy(s, pr.team, pr.tx, 26);
        if (t) damage(s, t, pr.dmg, pr.team);
      }
      emit(s, { type: 'impact', proj: pr.type, team: pr.team, x: pr.tx, y: pr.ty, splash: pr.splash });
    }
    s.projectiles = keep;
  }

  function enemySpan(s, team) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const u of s.units) {
      if (u.dead || u.team === team) continue;
      lo = Math.min(lo, u.x);
      hi = Math.max(hi, u.x);
    }
    return lo === Infinity ? null : { lo, hi };
  }

  function randomEnemy(s, team) {
    const list = s.units.filter((u) => !u.dead && u.team !== team);
    if (!list.length) return null;
    return list[Math.floor(s.rand() * list.length)];
  }

  function updateEffects(s, dt) {
    for (const fx of s.effects) {
      fx.t += dt;
      const sp = fx.def;
      switch (fx.kind) {
        case 'boulders': {
          let alive = 0;
          for (const b of fx.items) {
            if (fx.t < b.delay) {
              alive++;
              continue;
            }
            b.x += fx.dir * sp.speed * dt;
            b.rot += (sp.speed * dt) / b.r;
            const past = fx.dir === 1 ? b.x > D.baseFront(1) + 10 : b.x < D.baseFront(0) - 10;
            if (past) continue;
            alive++;
            for (const u of s.units) {
              if (u.dead || u.team === fx.team || b.hit.has(u.id)) continue;
              if (Math.abs(u.x - b.x) < u.def.w / 2 + b.r) {
                b.hit.add(u.id);
                damage(s, u, sp.dmg, fx.team);
                emit(s, { type: 'crush', x: u.x, y: D.GROUND_Y - 14 });
              }
            }
          }
          if (!alive) fx.done = true;
          break;
        }
        case 'lightning': {
          fx.next -= dt;
          while (fx.next <= 0 && fx.fired < sp.count) {
            fx.next += sp.interval;
            fx.fired++;
            const u = randomEnemy(s, fx.team);
            const x = u ? u.x : D.W / 2 + (s.rand() - 0.5) * 500;
            fx.strikes.push({ x, t: 0, seed: Math.floor(s.rand() * 1e6) });
            splashDamage(s, fx.team, x, sp.splash, sp.dmg, false);
            emit(s, { type: 'strike', kind: 'lightning', x, y: D.GROUND_Y });
          }
          for (const st of fx.strikes) st.t += dt;
          if (fx.fired >= sp.count && fx.t > sp.count * sp.interval + 0.5) fx.done = true;
          break;
        }
        case 'arrows': {
          const due = Math.min(sp.count, Math.floor((fx.t / sp.duration) * sp.count));
          const span = enemySpan(s, fx.team);
          while (fx.spawned < due) {
            fx.spawned++;
            const lo = span ? span.lo - 40 : D.W * 0.3;
            const hi = span ? span.hi + 40 : D.W * 0.7;
            const tx = lo + s.rand() * (hi - lo);
            fx.items.push({ tx, t: 0, T: 0.55 + s.rand() * 0.25, sx: tx - fx.dir * (180 + s.rand() * 60) });
          }
          for (const a of fx.items) {
            if (a.landed) {
              a.t += dt;
              continue;
            }
            a.t += dt;
            if (a.t >= a.T) {
              a.landed = true;
              a.t = 0;
              splashDamage(s, fx.team, a.tx, sp.splash, sp.dmg, false);
              emit(s, { type: 'strike', kind: 'arrow', x: a.tx, y: D.GROUND_Y });
            }
          }
          if (fx.spawned >= sp.count && fx.items.every((a) => a.landed && a.t > 0.6)) fx.done = true;
          break;
        }
        case 'cannonade': {
          fx.next -= dt;
          while (fx.next <= 0 && fx.fired < sp.count) {
            fx.next += sp.interval;
            fx.fired++;
            const u = randomEnemy(s, fx.team);
            const tx = u ? u.x + (s.rand() - 0.5) * 30 : D.W / 2 + (s.rand() - 0.5) * 600;
            const sx = fx.dir === 1 ? -40 : D.W + 40;
            fx.balls.push({ sx, sy: 180, tx, t: 0, T: 0.7 + s.rand() * 0.2 });
            emit(s, { type: 'fire', proj: 'cannonball', team: fx.team, x: fx.dir === 1 ? 0 : D.W, y: 200, dir: fx.dir });
          }
          for (const b of fx.balls) {
            if (b.landed) continue;
            b.t += dt;
            if (b.t >= b.T) {
              b.landed = true;
              splashDamage(s, fx.team, b.tx, sp.splash, sp.dmg, false);
              emit(s, { type: 'impact', proj: 'cannonball', team: fx.team, x: b.tx, y: D.GROUND_Y - 8, splash: sp.splash });
            }
          }
          if (fx.fired >= sp.count && fx.balls.every((b) => b.landed)) fx.done = true;
          break;
        }
        case 'airstrike': {
          fx.planeX += fx.dir * sp.speed * dt;
          const passed = fx.dir === 1 ? fx.planeX >= fx.nextDrop : fx.planeX <= fx.nextDrop;
          const before = fx.dir === 1 ? fx.nextDrop < fx.end : fx.nextDrop > fx.end;
          if (passed && before) {
            fx.bombs.push({ x: fx.nextDrop, y: 322, vy: 0, vx: fx.dir * sp.speed * 0.6 });
            fx.nextDrop += fx.dir * sp.spacing;
          }
          for (const b of fx.bombs) {
            if (b.landed) continue;
            b.vy += 900 * dt;
            b.y += b.vy * dt;
            b.x += b.vx * dt;
            b.vx *= 1 - dt * 1.5;
            if (b.y >= D.GROUND_Y - 6) {
              b.landed = true;
              splashDamage(s, fx.team, b.x, sp.splash, sp.dmg, false);
              emit(s, { type: 'impact', proj: 'bomb', team: fx.team, x: b.x, y: D.GROUND_Y - 6, splash: sp.splash });
            }
          }
          const gone = fx.dir === 1 ? fx.planeX > D.W + 300 : fx.planeX < -300;
          if (gone && fx.bombs.every((b) => b.landed)) fx.done = true;
          break;
        }
        case 'orbital': {
          if (fx.t < fx.warm) break;
          fx.beamX += fx.dir * sp.speed * dt;
          for (const u of s.units) {
            if (u.dead || u.team === fx.team || fx.hit.has(u.id)) continue;
            if (Math.abs(u.x - fx.beamX) < sp.width / 2 + u.def.w / 2) {
              fx.hit.add(u.id);
              damage(s, u, sp.dmg, fx.team);
              emit(s, { type: 'strike', kind: 'laser', x: u.x, y: D.GROUND_Y - 20 });
            }
          }
          const past = fx.dir === 1 ? fx.beamX > fx.end : fx.beamX < fx.end;
          if (past) fx.done = true;
          break;
        }
      }
    }
    s.effects = s.effects.filter((fx) => !fx.done);
  }

  function update(s, dt) {
    s.time += dt;
    if (s.over) {
      // Effekte und Geschosse dürfen noch ausklingen, sonst friert alles ein.
      for (const pr of s.projectiles) pr.t = Math.min(pr.t + dt, pr.T);
      return;
    }
    for (const p of s.players) {
      const age = D.AGES[p.age];
      p.gold += age.income * p.bonus * dt;
      p.xp += age.passiveXp * p.bonus * dt;
      p.specialCd = Math.max(0, p.specialCd - dt);
      p.baseHurt = Math.max(0, p.baseHurt - dt);
      p.evolveFlash = Math.max(0, p.evolveFlash - dt);
      if (p.queue.length) p.queue[0].t += dt;
    }
    spawnUnits(s);
    updateUnits(s, dt);
    updateTurrets(s, dt);
    updateProjectiles(s, dt);
    updateEffects(s, dt);
    if (s.units.some((u) => u.dead)) s.units = s.units.filter((u) => !u.dead);
  }

  EK.sim = {
    ACTIONS,
    createGame,
    update,
    command,
    actionInfo,
    serialize,
    deserialize,
    mulberry32,
  };
})((globalThis.EK = globalThis.EK || {}));
