// Tests der Online-Lockstep-Engine mit simuliertem Netz: node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/data.js');
require('../src/sim.js');
require('../src/net.js');
const { sim, net } = globalThis.EK;

const ACTIONS = sim.ACTIONS;
const tick = () => new Promise((r) => setImmediate(r));

// Zwei Geräte, verbunden über einen „Presence“-Kanal: Es gilt immer nur der neueste
// Stand, Zustellung mit Verzögerung, Zwischenstände dürfen verloren gehen.
function makeNet(opts) {
  const o = Object.assign({ latency: 80, jitter: 40, drop: 0, fps: [60, 60], seed: 7 }, opts);
  let r = o.seed;
  const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const sides = [0, 1].map((team) => ({
    team,
    ls: new net.Lockstep({ team, seed: 4242, round: 1 }),
    inbox: [], // { at, sent, data }
    latest: null,
    acc: 0,
    nextFrame: 0,
    sums: new Map(),
  }));
  let now = 0;
  function publish(from) {
    if (rand() < o.drop) return;
    const to = sides[1 - from.team];
    to.inbox.push({ at: now + o.latency + rand() * o.jitter, sent: now, data: JSON.parse(JSON.stringify(from.ls.presence())) });
  }
  function deliver(side) {
    side.inbox.sort((a, b) => a.at - b.at);
    while (side.inbox.length && side.inbox[0].at <= now) {
      const m = side.inbox.shift();
      if (!side.latest || m.sent >= side.latest.sent) side.latest = m;
    }
    if (side.latest) side.ls.receive(side.latest.data);
  }
  function frame(side, cmdRate) {
    deliver(side);
    if (cmdRate && !side.ls.s.over && rand() < cmdRate) {
      side.ls.local(ACTIONS[Math.floor(rand() * 8)]);
    }
    side.acc += 1 / o.fps[side.team];
    const due = Math.floor(side.acc * 60);
    const ran = side.ls.step(Math.min(8, due));
    side.acc = Math.max(0, side.acc - ran / 60);
    if (side.acc > 0.25) side.acc = 0.25;
    if (side.ls.lastSum) side.sums.set(side.ls.lastSum[0], side.ls.lastSum[1]);
    publish(side);
  }
  // ms simulieren; cmdRate = Wahrscheinlichkeit eines Befehls pro Frame
  async function run(ms, cmdRate, hook) {
    const end = now + ms;
    while (now < end) {
      now += 1000 / 240;
      for (const side of sides) {
        if (now >= side.nextFrame) {
          side.nextFrame = now + 1000 / o.fps[side.team] / (0.85 + rand() * 0.3);
          frame(side, cmdRate);
        }
      }
      if (hook) hook(now);
      await tick();
    }
  }
  function agree() {
    let compared = 0;
    for (const [t, h] of sides[0].sums) {
      if (sides[1].sums.has(t)) {
        compared++;
        if (sides[1].sums.get(t) !== h) return { ok: false, t, compared };
      }
    }
    return { ok: true, compared };
  }
  return { sides, run, agree, rand };
}

test('Beide Geräte rechnen trotz Latenz, Schwankung und verlorenen Updates identisch', async () => {
  const n = makeNet({ latency: 90, jitter: 60, drop: 0.3, fps: [60, 45] });
  await n.run(60000, 0.08);
  const [a, b] = n.sides;
  assert.ok(a.ls.tick > 2500 && b.ls.tick > 2500, `Partie läuft (Ticks ${a.ls.tick}/${b.ls.tick})`);
  assert.ok(Math.abs(a.ls.tick - b.ls.tick) <= a.ls.delay + 2, 'Geräte bleiben dicht beieinander');
  const ag = n.agree();
  assert.ok(ag.ok, `Prüfsummen stimmen überein (Abweichung bei Tick ${ag.t})`);
  assert.ok(ag.compared > 50, 'genug Prüfpunkte verglichen');
  assert.equal(a.ls.desyncs + b.ls.desyncs, 0);
  const cmds = a.ls.seq + b.ls.seq;
  assert.ok(cmds > 100, 'es wurden reichlich Befehle ausgetauscht: ' + cmds);
});

test('Abweichung wird erkannt und mit dem Stand des Gastgebers behoben', async () => {
  const n = makeNet({ latency: 60, jitter: 30 });
  await n.run(8000, 0.05);
  const [a, b] = n.sides;
  b.ls.s.players[1].gold += 37; // Gast weicht ab
  const before = b.ls.desyncs;
  await n.run(8000, 0.05);
  assert.ok(b.ls.desyncs > before, 'Abweichung erkannt');
  b.sums.clear();
  a.sums.clear();
  await n.run(8000, 0.05);
  const ag = n.agree();
  assert.ok(ag.ok && ag.compared > 5, 'nach dem Abgleich wieder synchron');
  assert.equal(b.ls.need, 0, 'kein offener Abgleich');
});

test('Wiedereinstieg nach Neuladen: Spielstand wird in Teilen übertragen', async () => {
  const n = makeNet({ latency: 70, jitter: 40, drop: 0.2 });
  await n.run(20000, 0.08);
  const [a, b] = n.sides;
  const tickBefore = a.ls.tick;
  // Gast lädt neu: alles weg, Spielstand muss vom Gastgeber kommen
  b.ls = new net.Lockstep({ team: 1, seed: 4242, round: 1, need: true });
  b.sums.clear();
  a.sums.clear();
  await n.run(15000, 0.08);
  assert.equal(b.ls.need, 0, 'Spielstand angekommen');
  assert.ok(b.ls.tick > tickBefore, 'Gast setzt bei fortgeschrittenem Stand fort');
  const ag = n.agree();
  assert.ok(ag.ok && ag.compared > 5, 'danach synchron');
  // Neue Befehle des Gasts müssen beim Gastgeber ankommen (Nummern zählen weiter)
  const before = a.ls.oppSeq;
  b.ls.local('unit0');
  await n.run(2000, 0);
  assert.ok(a.ls.oppSeq > before, 'Befehl nach Wiedereinstieg angekommen');
});

test('Pause einer Seite hält beide an, Weiter setzt beide fort', async () => {
  const n = makeNet({});
  await n.run(3000, 0.05);
  const [a, b] = n.sides;
  a.ls.paused = true;
  await n.run(2000, 0);
  const ta = a.ls.tick;
  const tb = b.ls.tick;
  await n.run(2000, 0);
  assert.equal(a.ls.tick, ta, 'pausierte Seite steht');
  assert.equal(b.ls.tick, tb, 'Gegenseite wartet');
  assert.ok(b.ls.oppPaused && b.ls.stalled(), 'Gegenseite weiß von der Pause');
  a.ls.paused = false;
  await n.run(2000, 0);
  assert.ok(a.ls.tick > ta + 60 && b.ls.tick > tb + 60, 'beide laufen weiter');
});

test('Aufgeben beendet die Partie auf beiden Geräten zum selben Tick', async () => {
  const n = makeNet({});
  await n.run(3000, 0.05);
  const [a, b] = n.sides;
  b.ls.local('resign');
  await n.run(2000, 0);
  for (const side of n.sides) {
    assert.ok(side.ls.s.over, 'Partie vorbei');
    assert.equal(side.ls.s.winner, 0, 'Gastgeber gewinnt');
  }
  assert.equal(net.checksum(a.ls.s), net.checksum(b.ls.s));
});

test('Speichern/Laden für Live-Updates erhält den Lockstep-Zustand', async () => {
  const n = makeNet({});
  await n.run(5000, 0.08);
  const [a] = n.sides;
  const copy = net.Lockstep.load(JSON.parse(JSON.stringify(a.ls.save())));
  assert.equal(net.checksum(copy.s), net.checksum(a.ls.s));
  assert.equal(copy.tick, a.ls.tick);
  assert.equal(copy.seq, a.ls.seq);
});

test('Ungültige Befehle des Gegners werden ignoriert', () => {
  const ls = new net.Lockstep({ team: 0, seed: 1 });
  ls.receive({ t: 0, u: 100, c: [[5, 99, 1], ['x', 1, 2], [5, 1], null, [5, 2, 0]], h: null, p: 0, nd: 0 });
  assert.equal(ls.oppSeq, 0);
  assert.equal(ls.plan.size, 0);
  ls.receive(null);
  ls.receive('kaputt');
  assert.equal(ls.step(10), 10);
});
