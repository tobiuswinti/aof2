// Balancing-Hilfe: lässt KI gegen KI spielen und gibt Kennzahlen aus.
// Aufruf: node tools/balance.js [Anzahl Partien] [Stufe Spieler 1] [Stufe Spieler 2]
'use strict';
require('../src/data.js');
require('../src/sim.js');
require('../src/ai.js');
const EK = globalThis.EK;

const games = +(process.argv[2] || 6);
const levels = [process.argv[3] || 'normal', process.argv[4] || process.argv[3] || 'normal'];
const STEP = 1 / 60;
for (let g = 0; g < games; g++) {
  const s = EK.sim.createGame({ seed: 100 + g, bonus: levels.map((l) => EK.ai.LEVELS[l].bonus) });
  const ais = [EK.ai.createAI(0, levels[0], 7 + g), EK.ai.createAI(1, levels[1], 99 + g)];
  const ageTimes = [[0], [0]];
  let maxUnits = 0;
  while (!s.over && s.time < 60 * 30) {
    for (const ai of ais) EK.ai.updateAI(ai, s, STEP);
    EK.sim.update(s, STEP);
    s.events.length = 0;
    maxUnits = Math.max(maxUnits, s.units.length);
    for (const p of s.players) if (ageTimes[p.team].length - 1 < p.age) ageTimes[p.team].push(Math.round(s.time));
  }
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  console.log(
    `Partie ${g + 1}: Dauer ${fmt(s.time)}, Sieger ${s.winner + 1}, max Einheiten ${maxUnits}, ` +
      s.players
        .map((p) => `S${p.team + 1}: Zeitalter ${p.age} Elite ${p.elite} [${ageTimes[p.team].map(fmt).join(' ')}] Kills ${p.stats.kills} Gold ${Math.round(p.gold)}`)
        .join(' | ')
  );
}
