// Tests der Spiellogik (ohne Browser): node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/data.js');
require('../src/sim.js');
require('../src/ai.js');
const { data: D, sim, ai } = globalThis.EK;

const STEP = 1 / 60;

function run(s, seconds, ais) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n && !s.over; i++) {
    if (ais) for (const a of ais) ai.updateAI(a, s, STEP);
    sim.update(s, STEP);
    s.events.length = 0;
  }
}

test('Einheiten werden gekauft, ausgebildet und laufen auf den Gegner zu', () => {
  const s = sim.createGame({ seed: 1 });
  const def = D.unitDef(0, 0);
  const gold = s.players[0].gold;
  assert.ok(sim.command(s, 0, 'unit0'));
  assert.equal(s.players[0].gold, gold - def.cost);
  run(s, def.train + 0.1);
  assert.equal(s.units.length, 1);
  const x0 = s.units[0].x;
  run(s, 1);
  assert.ok(s.units[0].x > x0, 'Einheit von Spieler 1 läuft nach rechts');
});

test('Warteschlange ist begrenzt und Gold wird geprüft', () => {
  const s = sim.createGame({ seed: 1 });
  s.players[0].gold = 1e6;
  for (let i = 0; i < D.RULES.queueMax; i++) assert.ok(sim.command(s, 0, 'unit0'));
  assert.equal(sim.command(s, 0, 'unit0'), false);
  s.players[1].gold = 0;
  assert.equal(sim.command(s, 1, 'unit2'), false);
  assert.ok(s.events.some((e) => e.type === 'deny' && e.team === 1));
});

test('Türme: kaufen, Plätze erweitern, ältesten verkaufen', () => {
  const s = sim.createGame({ seed: 1 });
  const p = s.players[0];
  p.gold = 1e6;
  assert.ok(sim.command(s, 0, 'turret'));
  assert.equal(sim.command(s, 0, 'turret'), false, 'nur ein Platz zu Beginn');
  assert.ok(sim.command(s, 0, 'slot'));
  assert.ok(sim.command(s, 0, 'slot'));
  assert.equal(sim.command(s, 0, 'slot'), false, 'maximal drei Plätze');
  p.age = 2;
  assert.ok(sim.command(s, 0, 'turret'));
  const before = p.gold;
  assert.ok(sim.command(s, 0, 'sell'));
  assert.equal(p.gold - before, Math.floor(D.turretDef(0).cost * D.RULES.sellRefund), 'der älteste Turm wird verkauft');
  assert.equal(p.turrets[0], null);
});

test('Turm schießt auf Gegner in Reichweite', () => {
  const s = sim.createGame({ seed: 3 });
  s.players[0].gold = 1e6;
  sim.command(s, 0, 'turret');
  sim.command(s, 1, 'unit0');
  let fired = false;
  for (let i = 0; i < 60 * 30 && !fired; i++) {
    sim.update(s, STEP);
    fired = s.events.some((e) => e.type === 'fire' && e.team === 0);
    s.events.length = 0;
  }
  assert.ok(fired);
});

test('Zeitalter-Aufstieg braucht XP und repariert die Basis teilweise', () => {
  const s = sim.createGame({ seed: 1 });
  const p = s.players[0];
  assert.equal(sim.command(s, 0, 'evolve'), false);
  p.xp = D.AGES[0].xpNext;
  p.baseHp = p.baseMaxHp / 2;
  assert.ok(sim.command(s, 0, 'evolve'));
  assert.equal(p.age, 1);
  assert.equal(p.baseMaxHp, D.AGES[1].baseHp);
  assert.equal(p.baseHp, Math.round(p.baseMaxHp * 0.75));
  assert.equal(D.unitDef(1, 0).name, sim.actionInfo(s, 0, 'unit0').label);
});

test('Im letzten Zeitalter gibt es Elite-Stufen statt Aufstieg', () => {
  const s = sim.createGame({ seed: 1 });
  const p = s.players[0];
  p.age = D.AGES.length - 1;
  p.xp = D.AGES[p.age].xpElite;
  assert.ok(sim.command(s, 0, 'evolve'));
  assert.equal(p.elite, 1);
  p.gold = 1e9;
  sim.command(s, 0, 'unit0');
  run(s, 1);
  const u = s.units.find((x) => x.team === 0);
  assert.ok(Math.abs(u.maxHp - D.unitDef(p.age, 0).hp * (1 + D.RULES.eliteBonus)) < 1e-6);
});

test('Jeder Spezialangriff trifft Gegner und endet wieder', () => {
  for (let age = 0; age < D.AGES.length; age++) {
    const s = sim.createGame({ seed: 7 + age });
    for (const p of s.players) {
      p.age = age;
      p.gold = 1e9;
    }
    for (let i = 0; i < 5; i++) sim.command(s, 1, 'unit0');
    run(s, 6);
    const hpBefore = s.units.filter((u) => u.team === 1).reduce((a, u) => a + u.hp, 0);
    const countBefore = s.units.filter((u) => u.team === 1).length;
    s.players[0].specialCd = 0;
    assert.ok(sim.command(s, 0, 'special'), `Spezial in Zeitalter ${age}`);
    run(s, 8);
    assert.equal(s.effects.length, 0, `Effekt ${D.AGES[age].special.kind} beendet`);
    const after = s.units.filter((u) => u.team === 1 && u.born < 6);
    const hpAfter = after.reduce((a, u) => a + u.hp, 0);
    assert.ok(countBefore > 0);
    assert.ok(hpAfter < hpBefore || after.length < countBefore, `Spezial ${D.AGES[age].special.kind} richtet Schaden an`);
  }
});

test('Simulation ist deterministisch bei gleichem Seed', () => {
  const play = () => {
    const s = sim.createGame({ seed: 42 });
    const ais = [ai.createAI(0, 'normal', 1), ai.createAI(1, 'normal', 2)];
    run(s, 180, ais);
    return JSON.stringify(s.players.map((p) => [Math.round(p.gold), Math.round(p.xp), p.age, p.baseHp, p.stats]));
  };
  assert.equal(play(), play());
});

test('KI gegen KI: keine ungültigen Werte, stärkere KI gewinnt', () => {
  let wins = 0;
  for (let g = 0; g < 3; g++) {
    const s = sim.createGame({ seed: 100 + g, bonus: [ai.LEVELS.normal.bonus, ai.LEVELS.leicht.bonus] });
    const ais = [ai.createAI(0, 'normal', g), ai.createAI(1, 'leicht', g + 10)];
    for (let t = 0; t < 30 * 60 && !s.over; t += 10) {
      run(s, 10, ais);
      for (const p of s.players) {
        assert.ok(Number.isFinite(p.gold) && Number.isFinite(p.xp) && Number.isFinite(p.baseHp));
        assert.ok(p.gold >= 0);
      }
      for (const u of s.units) {
        assert.ok(Number.isFinite(u.x) && Number.isFinite(u.hp));
        assert.ok(u.x > 0 && u.x < D.W, 'Einheiten bleiben auf dem Spielfeld');
      }
      assert.ok(s.units.filter((u) => u.team === 0).length <= D.RULES.fieldCap);
    }
    assert.ok(s.over, 'Partie endet innerhalb von 30 Minuten');
    if (s.winner === 0) wins++;
  }
  assert.ok(wins >= 2, `Normal gewinnt gegen Leicht (${wins}/3)`);
});

test('Spielstand lässt sich speichern und läuft danach identisch weiter', () => {
  for (let age = 0; age < D.AGES.length; age++) {
    const s = sim.createGame({ seed: 50 + age });
    for (const p of s.players) {
      p.age = age;
      p.gold = 1e9;
      sim.command(s, p.team, 'turret');
      for (let i = 0; i < 4; i++) sim.command(s, p.team, 'unit' + (i % 3));
    }
    run(s, 9);
    s.players[0].specialCd = 0;
    sim.command(s, 0, 'special');
    run(s, 0.4);
    assert.ok(s.effects.length > 0 || s.projectiles.length > 0, 'Effekte/Geschosse laufen beim Speichern');
    const copy = sim.deserialize(sim.serialize(s));
    run(s, 6);
    run(copy, 6);
    assert.equal(sim.serialize(copy), sim.serialize(s), `Zeitalter ${age}`);
  }
});

test('Ungültiger Spielstand wird abgelehnt', () => {
  assert.throws(() => sim.deserialize('{"players":[]}'));
  assert.throws(() => sim.deserialize('kein json'));
});
