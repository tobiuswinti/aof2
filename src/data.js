// Spieldaten: Zeitalter, Einheiten, Türme, Spezialangriffe und Balancing-Konstanten.
// Reine Daten ohne DOM-Zugriff, damit die Simulation auch in Node (Tests) läuft.
(function (EK) {
  'use strict';

  const W = 1280;
  const H = 720;
  const GROUND_Y = 610;
  const BASE_W = 112;

  // Multiplikatoren je Zeitalter: Werte (LP/Schaden) wachsen schneller als Kosten,
  // dadurch ist ein Vorsprung im Zeitalter spielentscheidend.
  const STAT = [1, 3, 9, 27, 80, 240];
  const COST = [1, 2, 4.2, 8.8, 18.5, 39];

  const ROLE = {
    melee: { cost: 15, hp: 60, dmg: 11, rate: 1.0, range: 6, speed: 44, train: 0.6, w: 22 },
    ranged: { cost: 25, hp: 40, dmg: 8, rate: 1.4, range: 150, speed: 42, train: 0.9, w: 20 },
    heavy: { cost: 100, hp: 230, dmg: 30, rate: 1.5, range: 8, speed: 50, train: 2.1, w: 52 },
  };

  // Flugbahnen der Geschosse: speed in px/s, arc = Bogenhöhe relativ zur Distanz.
  const PROJ = {
    stone: { speed: 380, arc: 0.22 },
    rock: { speed: 340, arc: 0.3 },
    arrow: { speed: 520, arc: 0.12 },
    bolt: { speed: 720, arc: 0.04 },
    firepot: { speed: 360, arc: 0.3 },
    bullet: { speed: 1800, arc: 0 },
    cannonball: { speed: 480, arc: 0.15 },
    shell: { speed: 900, arc: 0.03 },
    rocket: { speed: 600, arc: 0.02 },
    plasma: { speed: 820, arc: 0 },
    laser: { speed: 6000, arc: 0 },
  };

  const AGES = [
    {
      name: 'Steinzeit',
      xpNext: 1000,
      income: 1.5,
      passiveXp: 3,
      units: [
        { role: 'melee', name: 'Keulenkrieger', look: { body: 'fur', head: 'hair', weapon: 'club' } },
        { role: 'ranged', name: 'Schleuderer', proj: 'stone', look: { body: 'fur', head: 'band', weapon: 'sling' } },
        { role: 'heavy', name: 'Säbelzahnreiter', mount: 'sabertooth', look: { body: 'fur', head: 'hair', weapon: 'club' } },
      ],
      turret: { name: 'Steinschleuder', kind: 'catapult', proj: 'rock', rate: 1.6, range: 340, cost: 110 },
      special: { name: 'Felslawine', kind: 'boulders' },
    },
    {
      name: 'Antike',
      xpNext: 3200,
      income: 3,
      passiveXp: 6,
      units: [
        { role: 'melee', name: 'Hoplit', mods: { hpMul: 1.1 }, look: { body: 'tunic', head: 'crest', weapon: 'spear', shield: 'round' } },
        { role: 'ranged', name: 'Bogenschütze', proj: 'arrow', mods: { range: 165 }, look: { body: 'tunic', head: 'band', weapon: 'bow' } },
        { role: 'heavy', name: 'Streitwagen', mount: 'chariot', mods: { speed: 62, hpMul: 0.95 }, look: { body: 'tunic', head: 'crest', weapon: 'spear' } },
      ],
      turret: { name: 'Balliste', kind: 'ballista', proj: 'bolt', rate: 1.8, range: 370, cost: 240 },
      special: { name: 'Zorn der Götter', kind: 'lightning' },
    },
    {
      name: 'Mittelalter',
      xpNext: 8500,
      income: 6,
      passiveXp: 12,
      units: [
        { role: 'melee', name: 'Ritter', look: { body: 'armor', head: 'knight', weapon: 'sword', shield: 'kite' } },
        { role: 'ranged', name: 'Armbrustschütze', proj: 'bolt', mods: { range: 160, dmgMul: 1.15, rate: 1.6 }, look: { body: 'gambeson', head: 'kettle', weapon: 'crossbow' } },
        { role: 'heavy', name: 'Lanzenreiter', mount: 'horse', mods: { hpMul: 1.1 }, look: { body: 'armor', head: 'knight', weapon: 'lance' } },
      ],
      turret: { name: 'Feuerkatapult', kind: 'trebuchet', proj: 'firepot', rate: 2.6, range: 390, cost: 520, splash: 36 },
      special: { name: 'Pfeilsturm', kind: 'arrows' },
    },
    {
      name: 'Schießpulver',
      xpNext: 21000,
      income: 12.5,
      passiveXp: 25,
      units: [
        { role: 'melee', name: 'Säbelfechter', look: { body: 'coat', head: 'tricorn', weapon: 'sabre' } },
        { role: 'ranged', name: 'Musketier', proj: 'bullet', mods: { range: 175, rate: 1.9, dmgMul: 1.35 }, look: { body: 'coat', head: 'tricorn', weapon: 'musket' } },
        { role: 'heavy', name: 'Feldkanone', mount: 'cannon', proj: 'cannonball', mods: { range: 230, splash: 40, speed: 30, rate: 2.4, hpMul: 0.8, dmgMul: 1.2 }, look: { body: 'coat', head: 'tricorn', weapon: 'none' } },
      ],
      turret: { name: 'Bastionskanone', kind: 'cannon', proj: 'cannonball', rate: 2.6, range: 410, cost: 1100, splash: 42 },
      special: { name: 'Breitseite', kind: 'cannonade' },
    },
    {
      name: 'Moderne',
      xpNext: 52000,
      income: 26,
      passiveXp: 50,
      units: [
        { role: 'melee', name: 'Sturmsoldat', proj: 'bullet', mods: { range: 45, rate: 0.8, dmgMul: 0.85 }, look: { body: 'uniform', head: 'helmet', weapon: 'rifle' } },
        { role: 'ranged', name: 'Raketenschütze', proj: 'rocket', mods: { range: 185, rate: 2.2, dmgMul: 1.4, splash: 24 }, look: { body: 'uniform', head: 'helmet', weapon: 'bazooka' } },
        { role: 'heavy', name: 'Panzer', mount: 'tank', proj: 'shell', mods: { range: 210, splash: 42, speed: 36, rate: 2.2, hpMul: 1.3 }, look: { body: 'uniform', head: 'helmet', weapon: 'none' } },
      ],
      turret: { name: 'MG-Stellung', kind: 'mg', proj: 'bullet', rate: 0.2, range: 400, cost: 2300 },
      special: { name: 'Luftschlag', kind: 'airstrike' },
    },
    {
      name: 'Zukunft',
      xpNext: null,
      // Im letzten Zeitalter wird XP in Elite-Stufen umgewandelt.
      xpElite: 90000,
      income: 55,
      passiveXp: 25,
      units: [
        { role: 'melee', name: 'Cyborg', look: { body: 'suit', head: 'visor', weapon: 'blade' } },
        { role: 'ranged', name: 'Plasmaschütze', proj: 'plasma', mods: { range: 190 }, look: { body: 'suit', head: 'visor', weapon: 'plasma' } },
        { role: 'heavy', name: 'Kampfmech', mount: 'mech', proj: 'laser', mods: { range: 150, rate: 1.0, hpMul: 1.25, dmgMul: 0.8 }, look: { body: 'suit', head: 'visor', weapon: 'none' } },
      ],
      turret: { name: 'Ionenturm', kind: 'ion', proj: 'laser', rate: 0.9, range: 440, cost: 4900 },
      special: { name: 'Orbitallaser', kind: 'orbital' },
    },
  ];

  // Spezialangriffe: Schaden pro Treffer (Basiswert, wird mit STAT des Zeitalters skaliert).
  const SPECIAL = {
    boulders: { count: 3, dmg: 42, speed: 330, radius: 18 },
    lightning: { count: 9, dmg: 70, splash: 30, interval: 0.22 },
    arrows: { count: 42, dmg: 24, splash: 16, duration: 1.8 },
    cannonade: { count: 11, dmg: 62, splash: 40, interval: 0.18 },
    airstrike: { dmg: 62, splash: 34, spacing: 56, speed: 520 },
    orbital: { dmg: 130, speed: 460, width: 46 },
  };

  const RULES = {
    startGold: 175,
    queueMax: 5,
    fieldCap: 24,
    allyGap: 5,
    specialCd: 55,
    specialFirstCd: 30,
    slotCost: [0, 400, 1600],
    maxSlots: 3,
    sellRefund: 0.5,
    killGold: 0.8,
    killXp: 1.0,
    baseDmgXp: 0.3,
    turretDps: 11,
    baseHp: 900,
    eliteMax: 5,
    eliteBonus: 0.12,
  };

  for (let i = 0; i < AGES.length; i++) AGES[i].baseHp = Math.round(RULES.baseHp * STAT[i]);

  const unitCache = new Map();

  function unitDef(age, idx) {
    const key = age * 10 + idx;
    let def = unitCache.get(key);
    if (def) return def;
    const src = AGES[age].units[idx];
    const r = ROLE[src.role];
    const m = src.mods || {};
    def = {
      key,
      age,
      idx,
      role: src.role,
      name: src.name,
      look: src.look,
      mount: src.mount || null,
      proj: src.proj || null,
      cost: Math.round(r.cost * COST[age]),
      hp: Math.round(r.hp * STAT[age] * (m.hpMul || 1)),
      dmg: Math.round(r.dmg * STAT[age] * (m.dmgMul || 1)),
      rate: m.rate || r.rate,
      range: m.range || r.range,
      speed: m.speed || r.speed,
      train: r.train,
      w: r.w,
      splash: m.splash || 0,
    };
    unitCache.set(key, def);
    return def;
  }

  function turretDef(age) {
    const t = AGES[age].turret;
    const splash = t.splash || 0;
    return {
      age,
      name: t.name,
      kind: t.kind,
      proj: t.proj,
      rate: t.rate,
      range: t.range,
      cost: t.cost,
      splash,
      dmg: Math.round(RULES.turretDps * STAT[age] * t.rate * (splash ? 0.8 : 1)),
    };
  }

  function specialDef(age) {
    const s = AGES[age].special;
    return { age, name: s.name, kind: s.kind, ...SPECIAL[s.kind], dmg: Math.round(SPECIAL[s.kind].dmg * STAT[age]) };
  }

  function baseFront(team) {
    return team === 0 ? BASE_W : W - BASE_W;
  }

  // Position der Turm-Plattformen an der Basis (Index 0 = unterste).
  function turretPos(team, slot) {
    const x = 82;
    const y = GROUND_Y - 122 - slot * 46;
    return { x: team === 0 ? x : W - x, y };
  }

  EK.data = {
    W,
    H,
    GROUND_Y,
    BASE_W,
    STAT,
    COST,
    ROLE,
    PROJ,
    AGES,
    SPECIAL,
    RULES,
    unitDef,
    turretDef,
    specialDef,
    baseFront,
    turretPos,
  };
})((globalThis.EK = globalThis.EK || {}));
