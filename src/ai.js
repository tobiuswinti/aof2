// Einfache Computer-Gegner-Logik. Benutzt ausschließlich EK.sim.command,
// spielt also nach denselben Regeln wie ein menschlicher Spieler.
(function (EK) {
  'use strict';

  const D = EK.data;
  const R = D.RULES;

  // bonus = Wirtschaftsfaktor, den die Simulation für den KI-Spieler verwendet.
  const LEVELS = {
    leicht: { interval: 1.6, maxQueue: 1, specialMin: 6, heavyBias: 0.15, bonus: 0.8 },
    normal: { interval: 0.9, maxQueue: 2, specialMin: 4, heavyBias: 0.3, bonus: 1 },
    schwer: { interval: 0.45, maxQueue: 3, specialMin: 3, heavyBias: 0.4, bonus: 1.25 },
  };

  function createAI(team, level, seed) {
    return {
      team,
      cfg: LEVELS[level] || LEVELS.normal,
      t: 1 + team * 0.3,
      rand: EK.sim.mulberry32(seed != null ? seed : 1234 + team),
    };
  }

  function threat(s, team) {
    const front = D.baseFront(team);
    let near = 0;
    let count = 0;
    let value = 0;
    for (const u of s.units) {
      if (u.team === team || u.dead) continue;
      count++;
      value += u.def.cost;
      if (Math.abs(u.x - front) < 420) near++;
    }
    return { near, count, value };
  }

  function think(ai, s) {
    const team = ai.team;
    const p = s.players[team];
    const cfg = ai.cfg;
    const cmd = (a) => EK.sim.command(s, team, a);
    const info = (a) => EK.sim.actionInfo(s, team, a);

    if (info('evolve').enabled) return cmd('evolve');

    const th = threat(s, team);
    if (p.specialCd <= 0 && (th.count >= cfg.specialMin || th.near >= 3)) return cmd('special');

    const tur = info('turret');
    const unitCost = D.unitDef(p.age, 0).cost;
    if (!tur.full && p.gold >= tur.cost + unitCost * 2) return cmd('turret');
    if (tur.full) {
      const outdated = p.turrets.some((t) => t && t.age < p.age);
      if (outdated && p.gold >= tur.cost * 1.4) return cmd('sell');
      const slot = info('slot');
      if (!slot.max && p.age >= 1 && p.gold >= slot.cost * 2) return cmd('slot');
    }

    const heavy = D.unitDef(p.age, 2);
    const ranged = D.unitDef(p.age, 1);
    const rich = p.gold >= heavy.cost * 3;
    if (p.queue.length >= (rich ? R.queueMax : cfg.maxQueue)) return false;
    let pick;
    if (rich && ai.rand() < 0.6) pick = 2;
    else if (th.near >= 2) pick = 0;
    else if (p.gold >= heavy.cost * 1.3 && ai.rand() < cfg.heavyBias + 0.2) pick = 2;
    else if (p.gold >= ranged.cost && ai.rand() < 0.4) pick = 1;
    else pick = 0;
    if (p.gold < D.unitDef(p.age, pick).cost) pick = 0;
    if (p.gold < D.unitDef(p.age, pick).cost) return false;
    return cmd('unit' + pick);
  }

  function updateAI(ai, s, dt) {
    if (s.over) return;
    ai.t -= dt;
    if (ai.t > 0) return;
    ai.t = ai.cfg.interval * (0.7 + ai.rand() * 0.6);
    // Nach einer erfolgreichen Aktion gleich die nächste prüfen (z. B. Turm + Einheit).
    for (let i = 0; i < 3 && think(ai, s); i++);
  }

  EK.ai = { createAI, updateAI, LEVELS };
})((globalThis.EK = globalThis.EK || {}));
