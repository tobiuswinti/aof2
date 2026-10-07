// Prozedurale Vektorgrafik: Einheiten, Reittiere/Fahrzeuge, Basen und Türme.
// Alles wird zur Laufzeit mit Canvas-2D gezeichnet – es gibt keine Bilddateien.
// Konvention: Figuren schauen nach rechts, Ursprung = Bodenmitte (y nach oben negativ).
(function (EK) {
  'use strict';

  const OUT = '#1c1a22';
  const SKIN = '#e9b48c';
  const TAU = Math.PI * 2;

  const TEAM = [
    { main: '#3b82f6', dark: '#1d4ea6', light: '#9cc4ff', glow: '#5fb0ff', name: 'Blau' },
    { main: '#e5484d', dark: '#9e1f25', light: '#ffa4a6', glow: '#ff6b6f', name: 'Rot' },
  ];

  const shadeCache = new Map();
  function shade(hex, amt) {
    const key = hex + amt;
    let v = shadeCache.get(key);
    if (v) return v;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    if (amt >= 0) {
      r += (255 - r) * amt;
      g += (255 - g) * amt;
      b += (255 - b) * amt;
    } else {
      r *= 1 + amt;
      g *= 1 + amt;
      b *= 1 + amt;
    }
    v = '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
    shadeCache.set(key, v);
    return v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Dicke Linie mit dunklem Rand (Cartoon-Look).
  function limb(ctx, x1, y1, x2, y2, w, col) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = w + 2.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function fillStroke(ctx, fill, lw) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw || 1.6;
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }

  function circle(ctx, x, y, r, fill, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    fillStroke(ctx, fill, lw);
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ------------------------------------------------------------ Körperstile

  function bodyColors(look, T) {
    switch (look.body) {
      case 'fur':
        return { torso: '#8a5a2e', legs: SKIN, arms: SKIN, accent: T.main, trim: '#5d3a1b' };
      case 'tunic':
        return { torso: T.main, legs: SKIN, arms: SKIN, accent: '#c69a4c', trim: '#6b4a2a' };
      case 'armor':
        return { torso: '#a3acb7', legs: '#7d8794', arms: '#a3acb7', accent: T.main, trim: '#5a626d' };
      case 'gambeson':
        return { torso: '#cdb68b', legs: '#6b4f33', arms: '#cdb68b', accent: T.main, trim: '#8a744f' };
      case 'coat':
        return { torso: T.main, legs: '#f1ede2', arms: T.main, accent: '#f5f1e6', trim: T.dark, boots: '#22201f' };
      case 'uniform':
        return { torso: '#5c6b3c', legs: '#4f5c33', arms: '#5c6b3c', accent: T.main, trim: '#3a4425', boots: '#2b2620' };
      case 'suit':
        return { torso: '#2d3240', legs: '#252a35', arms: '#323848', accent: T.glow, trim: '#151821', boots: '#151821' };
      default:
        return { torso: T.main, legs: SKIN, arms: SKIN, accent: T.light, trim: T.dark };
    }
  }

  function drawTorso(ctx, look, C, T, bob) {
    const y0 = -16 + bob;
    const y1 = -34 + bob;
    ctx.beginPath();
    ctx.moveTo(-5, y0);
    ctx.lineTo(-6.5, y1 + 2);
    ctx.quadraticCurveTo(-6, y1, -3, y1);
    ctx.lineTo(4, y1);
    ctx.quadraticCurveTo(7, y1, 7, y1 + 3);
    ctx.lineTo(5.5, y0);
    ctx.closePath();
    fillStroke(ctx, C.torso);
    ctx.save();
    ctx.clip();
    switch (look.body) {
      case 'fur':
        ctx.fillStyle = C.trim;
        for (let i = -6; i < 8; i += 3) {
          ctx.beginPath();
          ctx.moveTo(i, y0 + 1);
          ctx.lineTo(i + 1.5, y0 - 4);
          ctx.lineTo(i + 3, y0 + 1);
          ctx.fill();
        }
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-6, y1 + 2);
        ctx.lineTo(6, y0 - 3);
        ctx.stroke();
        break;
      case 'tunic':
        ctx.fillStyle = shade(C.torso, -0.25);
        ctx.fillRect(-8, y0 - 5, 16, 5);
        ctx.fillStyle = C.trim;
        ctx.fillRect(-8, y0 - 7, 16, 2.4);
        break;
      case 'armor':
        ctx.fillStyle = C.accent;
        ctx.fillRect(-3.5, y1, 8, 20);
        ctx.fillStyle = shade(C.accent, 0.35);
        ctx.fillRect(-0.5, y1 + 4, 2, 9);
        ctx.fillRect(-3, y1 + 7.5, 7, 2);
        break;
      case 'gambeson':
        ctx.strokeStyle = C.trim;
        ctx.lineWidth = 1;
        for (let y = y1 + 4; y < y0; y += 4) {
          ctx.beginPath();
          ctx.moveTo(-7, y);
          ctx.lineTo(7, y);
          ctx.stroke();
        }
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(6, y1);
        ctx.lineTo(-6, y0);
        ctx.stroke();
        break;
      case 'coat':
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, y1);
        ctx.lineTo(6, y0);
        ctx.moveTo(6, y1);
        ctx.lineTo(-6, y0);
        ctx.stroke();
        ctx.fillStyle = '#e7c35a';
        ctx.fillRect(4, y1 + 4, 2, 2);
        ctx.fillRect(4, y1 + 9, 2, 2);
        break;
      case 'uniform':
        ctx.fillStyle = C.trim;
        ctx.fillRect(-8, y0 - 4, 16, 2.5);
        ctx.fillStyle = shade(C.torso, -0.2);
        ctx.fillRect(1, y1 + 4, 5, 4);
        break;
      case 'suit':
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-4, y1 + 3);
        ctx.lineTo(-1, y1 + 10);
        ctx.lineTo(4, y1 + 10);
        ctx.moveTo(-1, y1 + 10);
        ctx.lineTo(-2, y0);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  function drawHead(ctx, look, T, bob) {
    const hx = 1;
    const hy = -41 + bob;
    const suitHead = look.head === 'visor' || look.head === 'knight';
    circle(ctx, hx, hy, 6.4, suitHead ? '#3a3f4d' : SKIN);
    if (!suitHead) {
      ctx.fillStyle = OUT;
      ctx.fillRect(hx + 3, hy - 1.6, 1.6, 1.8);
    }
    switch (look.head) {
      case 'hair':
      case 'band': {
        ctx.beginPath();
        ctx.moveTo(hx - 7, hy + 2);
        ctx.quadraticCurveTo(hx - 8, hy - 8, hx, hy - 7.5);
        ctx.quadraticCurveTo(hx + 7, hy - 8, hx + 6.5, hy - 2);
        ctx.lineTo(hx + 2, hy - 4);
        ctx.lineTo(hx - 2, hy - 2);
        ctx.lineTo(hx - 3, hy + 3);
        ctx.closePath();
        fillStroke(ctx, '#4a2f1c', 1.3);
        if (look.head === 'band') {
          ctx.fillStyle = T.main;
          ctx.fillRect(hx - 6.5, hy - 4.5, 13, 2.6);
          ctx.fillRect(hx - 9.5, hy - 4, 3.5, 5);
        } else {
          ctx.beginPath();
          ctx.moveTo(hx + 1, hy + 3);
          ctx.quadraticCurveTo(hx + 4, hy + 8, hx + 6, hy + 3);
          fillStroke(ctx, '#4a2f1c', 1.1);
        }
        break;
      }
      case 'crest': {
        ctx.beginPath();
        ctx.arc(hx, hy - 0.5, 7.2, Math.PI * 1.02, Math.PI * 2.05);
        ctx.lineTo(hx + 7, hy + 3);
        ctx.lineTo(hx + 3, hy + 1);
        ctx.lineTo(hx + 3, hy + 5);
        ctx.lineTo(hx - 6.5, hy + 5);
        ctx.closePath();
        fillStroke(ctx, '#c4903f', 1.4);
        ctx.fillStyle = OUT;
        ctx.fillRect(hx + 2.2, hy - 2.5, 4.5, 1.8);
        ctx.beginPath();
        ctx.moveTo(hx - 8, hy - 3);
        ctx.quadraticCurveTo(hx - 4, hy - 16, hx + 6, hy - 9);
        ctx.quadraticCurveTo(hx - 1, hy - 11, hx - 4, hy - 4);
        ctx.closePath();
        fillStroke(ctx, T.main, 1.2);
        break;
      }
      case 'knight': {
        rrect(ctx, hx - 6.5, hy - 7.5, 13.5, 14, 3);
        fillStroke(ctx, '#b7bec8', 1.4);
        ctx.fillStyle = OUT;
        ctx.fillRect(hx + 1, hy - 2.2, 6, 1.8);
        ctx.fillStyle = shade('#b7bec8', -0.25);
        ctx.fillRect(hx + 3, hy + 1, 1.2, 4);
        ctx.beginPath();
        ctx.moveTo(hx - 2, hy - 7);
        ctx.quadraticCurveTo(hx - 6, hy - 18, hx - 13, hy - 12);
        ctx.quadraticCurveTo(hx - 6, hy - 12, hx - 5, hy - 6);
        ctx.closePath();
        fillStroke(ctx, T.main, 1.1);
        break;
      }
      case 'kettle': {
        ctx.beginPath();
        ctx.moveTo(hx - 10, hy - 2);
        ctx.lineTo(hx + 10, hy - 2);
        ctx.lineTo(hx + 7, hy - 4);
        ctx.quadraticCurveTo(hx, hy - 13, hx - 7, hy - 4);
        ctx.closePath();
        fillStroke(ctx, '#9aa2ad', 1.3);
        break;
      }
      case 'tricorn': {
        ctx.beginPath();
        ctx.moveTo(hx - 9, hy - 3);
        ctx.quadraticCurveTo(hx - 4, hy - 6, hx - 5, hy - 10);
        ctx.quadraticCurveTo(hx, hy - 7, hx + 5, hy - 10);
        ctx.quadraticCurveTo(hx + 5, hy - 5, hx + 10, hy - 4);
        ctx.quadraticCurveTo(hx, hy - 1, hx - 9, hy - 3);
        fillStroke(ctx, '#23211f', 1.2);
        ctx.strokeStyle = T.light;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx - 8, hy - 3.6);
        ctx.quadraticCurveTo(hx, hy - 1.8, hx + 9, hy - 4.4);
        ctx.stroke();
        break;
      }
      case 'helmet': {
        ctx.beginPath();
        ctx.moveTo(hx - 8.5, hy - 0.5);
        ctx.quadraticCurveTo(hx - 8, hy - 10.5, hx + 1, hy - 10.5);
        ctx.quadraticCurveTo(hx + 9, hy - 10, hx + 9, hy - 0.5);
        ctx.closePath();
        fillStroke(ctx, '#56643a', 1.3);
        ctx.fillStyle = T.main;
        ctx.fillRect(hx - 6, hy - 5, 3, 3);
        break;
      }
      case 'visor': {
        ctx.beginPath();
        ctx.arc(hx, hy, 7, Math.PI * 0.9, Math.PI * 2.15);
        ctx.closePath();
        fillStroke(ctx, '#3d4352', 1.3);
        ctx.fillStyle = T.glow;
        ctx.shadowColor = T.glow;
        ctx.shadowBlur = 6;
        ctx.fillRect(hx - 0.5, hy - 2.6, 7.5, 3);
        ctx.shadowBlur = 0;
        break;
      }
    }
  }

  // ------------------------------------------------------------ Waffen

  function drawWeapon(ctx, weapon, T, a, atkP) {
    // Lokales System: Ursprung = Hand, +x = Waffenrichtung.
    switch (weapon) {
      case 'club':
        ctx.beginPath();
        ctx.moveTo(-3, -1.3);
        ctx.lineTo(17, -3.8);
        ctx.quadraticCurveTo(21, 0, 17, 3.8);
        ctx.lineTo(-3, 1.3);
        ctx.closePath();
        fillStroke(ctx, '#7a4b22', 1.3);
        ctx.fillStyle = '#5a3416';
        ctx.fillRect(12, -1.5, 2, 2);
        ctx.fillRect(8, 0.5, 2, 1.5);
        break;
      case 'sling':
        ctx.strokeStyle = '#6e5232';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(6, 6, 10, 2);
        ctx.stroke();
        if (atkP < 0.5) circle(ctx, 10, 2, 2.4, '#9b968c', 1);
        break;
      case 'spear':
        limb(ctx, -14, 0, 26, 0, 1.8, '#8a6136');
        ctx.beginPath();
        ctx.moveTo(25, -3);
        ctx.lineTo(34, 0);
        ctx.lineTo(25, 3);
        ctx.closePath();
        fillStroke(ctx, '#cf9a4a', 1.1);
        break;
      case 'lance':
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(44, -0.8);
        ctx.lineTo(44, 0.8);
        ctx.lineTo(-10, 2);
        ctx.closePath();
        fillStroke(ctx, '#e8e2d2', 1.2);
        ctx.fillStyle = T.main;
        ctx.fillRect(4, -2, 4, 4);
        ctx.fillRect(16, -1.6, 4, 3.2);
        ctx.beginPath();
        ctx.moveTo(-2, -4.5);
        ctx.lineTo(4, -2);
        ctx.lineTo(4, 2);
        ctx.lineTo(-2, 4.5);
        ctx.closePath();
        fillStroke(ctx, '#8d96a2', 1.1);
        break;
      case 'sword':
      case 'sabre': {
        limb(ctx, -3, 0, 1, 0, 2.6, '#5a3a1e');
        ctx.fillStyle = '#c7a54a';
        ctx.fillRect(0.5, -4, 2.4, 8);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, -4, 2.4, 8);
        ctx.beginPath();
        if (weapon === 'sword') {
          ctx.moveTo(3, -1.8);
          ctx.lineTo(20, -1.4);
          ctx.lineTo(23, 0);
          ctx.lineTo(20, 1.4);
          ctx.lineTo(3, 1.8);
        } else {
          ctx.moveTo(3, -1.6);
          ctx.quadraticCurveTo(14, -3.5, 22, -5.5);
          ctx.quadraticCurveTo(15, 0, 3, 1.6);
        }
        ctx.closePath();
        fillStroke(ctx, '#dfe5ec', 1.1);
        break;
      }
      case 'blade': {
        limb(ctx, -3, 0, 2, 0, 2.6, '#444b5c');
        ctx.save();
        ctx.shadowColor = T.glow;
        ctx.shadowBlur = 10;
        ctx.fillStyle = T.light;
        ctx.beginPath();
        ctx.moveTo(2, -1.8);
        ctx.lineTo(24, -1.2);
        ctx.lineTo(26, 0);
        ctx.lineTo(24, 1.2);
        ctx.lineTo(2, 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(3, -0.6, 20, 1.2);
        ctx.restore();
        break;
      }
      case 'bow': {
        const pull = atkP > 0 && atkP < 0.45 ? 5 : 0;
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-2, -14);
        ctx.quadraticCurveTo(9, 0, -2, 14);
        ctx.stroke();
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = '#ece6d6';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-2, -14);
        ctx.lineTo(-2 - pull * 1.6, 0);
        ctx.lineTo(-2, 14);
        ctx.stroke();
        if (pull) limb(ctx, -10, 0, 8, 0, 0.8, '#ece6d6');
        break;
      }
      case 'crossbow':
        limb(ctx, -10, 1, 14, 0, 3, '#7a522d');
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10, -9);
        ctx.quadraticCurveTo(15, 0, 10, 9);
        ctx.stroke();
        ctx.strokeStyle = '#9aa1ab';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.strokeStyle = '#ece6d6';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(10, -9);
        ctx.lineTo(4, 0);
        ctx.lineTo(10, 9);
        ctx.stroke();
        break;
      case 'musket':
        ctx.beginPath();
        ctx.moveTo(-11, -0.5);
        ctx.lineTo(-4, -1.8);
        ctx.lineTo(28, -1.4);
        ctx.lineTo(28, 0.6);
        ctx.lineTo(-2, 1.5);
        ctx.lineTo(-11, 4.5);
        ctx.closePath();
        fillStroke(ctx, '#6b4423', 1.1);
        limb(ctx, 2, -1.3, 30, -1.3, 1.2, '#3b3f45');
        ctx.fillStyle = '#d8d8d8';
        ctx.fillRect(28, -3.2, 1.2, 1.6);
        break;
      case 'rifle':
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(-3, -2);
        ctx.lineTo(20, -2);
        ctx.lineTo(20, 0.6);
        ctx.lineTo(2, 1.2);
        ctx.lineTo(0, 4);
        ctx.lineTo(-2, 4);
        ctx.lineTo(-2, 1.5);
        ctx.lineTo(-9, 3.5);
        ctx.closePath();
        fillStroke(ctx, '#3a3530', 1.1);
        ctx.fillStyle = '#5b4632';
        ctx.fillRect(-8, 0, 5, 2.5);
        break;
      case 'bazooka':
        rrect(ctx, -14, -4, 34, 6.5, 2);
        fillStroke(ctx, '#55603a', 1.2);
        ctx.fillStyle = T.main;
        ctx.fillRect(4, -4, 3, 6.5);
        ctx.fillStyle = OUT;
        ctx.fillRect(18, -3, 2, 4.5);
        break;
      case 'plasma':
        rrect(ctx, -8, -3.4, 26, 6.4, 2.5);
        fillStroke(ctx, '#4a5163', 1.2);
        ctx.save();
        ctx.shadowColor = T.glow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = T.glow;
        ctx.fillRect(0, -1.6, 12, 3.2);
        ctx.beginPath();
        ctx.arc(19, -0.2, 2.2, 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
    }
  }

  const SWING = { club: 1, sword: 1, sabre: 1, blade: 1 };
  const GUN = { crossbow: 1, musket: 1, rifle: 1, plasma: 1 };

  // Zeichnet eine menschliche Figur. pose: { phase, moving, atk (0..1, 0 = keine), seated, standingIn }
  function drawHumanoid(ctx, look, team, pose) {
    const T = TEAM[team];
    const C = bodyColors(look, T);
    const ph = pose.phase || 0;
    const moving = pose.moving;
    const atkP = pose.atk || 0;
    const bob = moving && !pose.seated ? -Math.abs(Math.sin(ph)) * 1.4 : 0;
    const legCol = C.legs;

    // Beine
    if (pose.seated) {
      limb(ctx, 0, -17, 8, -14, 4.6, legCol);
      limb(ctx, 8, -14, 7, -4, 4.2, legCol);
      if (C.boots) limb(ctx, 7, -6, 8, -3, 4.6, C.boots);
    } else if (!pose.noLegs) {
      const sw = moving ? Math.sin(ph) * 0.55 : 0;
      for (let k = 0; k < 2; k++) {
        const a = k === 0 ? -sw : sw;
        const col = k === 0 ? shade(legCol, -0.18) : legCol;
        const kx = Math.sin(a) * 9;
        const fx = kx + Math.sin(a + (moving ? 0.25 : 0)) * 9;
        limb(ctx, 0, -17 + bob, kx, -8.5 + bob * 0.5, 4.4, col);
        limb(ctx, kx, -8.5 + bob * 0.5, fx, -1, 4.1, col);
        const boot = C.boots || (look.body === 'fur' || look.body === 'tunic' ? '#6b4a2a' : shade(legCol, -0.35));
        limb(ctx, fx - 0.5, -1.2, fx + 3, -1.2, 3.2, boot);
      }
    }

    const shX = 0;
    const shY = -31.5 + bob;
    const w = look.weapon;

    // Armwinkel (0 = hängt nach unten, PI/2 = nach vorn, PI = nach oben)
    let front = 0.5;
    let back = moving ? -0.35 * Math.sin(ph) : -0.15;
    let wOff = -1.3;
    let recoil = 0;
    if (SWING[w]) {
      front = moving ? 0.9 + Math.sin(ph) * 0.15 : 1.0;
      if (atkP > 0) front = atkP < 0.35 ? lerp(1.0, 2.75, atkP / 0.35) : lerp(2.75, 0.6, Math.min(1, (atkP - 0.35) / 0.35));
    } else if (w === 'spear' || w === 'lance') {
      front = 1.35;
      wOff = 0;
      if (atkP > 0) front = atkP < 0.3 ? lerp(1.35, 1.05, atkP / 0.3) : lerp(1.05, 1.7, Math.min(1, (atkP - 0.3) / 0.3));
      if (w === 'lance') front -= 0.1;
    } else if (w === 'bow') {
      front = 1.6;
      back = 1.45;
      wOff = 0;
    } else if (GUN[w]) {
      front = 1.55;
      back = 1.25;
      wOff = 0;
      recoil = atkP > 0 && atkP < 0.4 ? (0.4 - atkP) * 6 : 0;
    } else if (w === 'bazooka') {
      front = 1.7;
      back = 1.3;
      wOff = 0;
    } else if (w === 'sling') {
      front = atkP > 0 ? 1.2 + atkP * TAU * 1.5 : 0.35;
      wOff = 0.2;
    }

    const armLen = 13;
    const armPos = (ang, len) => ({ x: shX + Math.sin(ang) * len, y: shY + Math.cos(ang) * len });

    // hinterer Arm
    const bh = armPos(back, GUN[w] || w === 'bow' || w === 'bazooka' ? 11 : armLen);
    limb(ctx, shX - 1, shY, bh.x - 1 - recoil, bh.y, 3.8, shade(C.arms, -0.18));

    drawTorso(ctx, look, C, T, bob);

    if (look.shield === 'round') {
      circle(ctx, 7, -23 + bob, 8.5, '#c4903f', 1.6);
      circle(ctx, 7, -23 + bob, 5, T.main, 1.1);
    } else if (look.shield === 'kite') {
      ctx.beginPath();
      ctx.moveTo(2, -31 + bob);
      ctx.lineTo(13, -31 + bob);
      ctx.quadraticCurveTo(13, -17 + bob, 7.5, -11 + bob);
      ctx.quadraticCurveTo(2, -17 + bob, 2, -31 + bob);
      fillStroke(ctx, T.main, 1.6);
      ctx.fillStyle = '#f2efe6';
      ctx.fillRect(6.6, -30 + bob, 2, 14);
    }

    drawHead(ctx, look, T, bob);

    // vorderer Arm + Waffe
    const fh = armPos(front, armLen);
    const hx = fh.x - recoil;
    const hy = fh.y;
    if (w === 'bazooka') {
      ctx.save();
      ctx.translate(2 - recoil, shY - 3);
      drawWeapon(ctx, w, T, 0, atkP);
      ctx.restore();
    }
    limb(ctx, shX + 1, shY, hx, hy, 3.8, C.arms);
    if (w && w !== 'none' && w !== 'bazooka') {
      const armAngle = Math.PI / 2 - front;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(GUN[w] || w === 'bow' ? 0 : armAngle + wOff);
      drawWeapon(ctx, w, T, front, atkP);
      ctx.restore();
    }
    circle(ctx, hx, hy, 2.2, look.body === 'armor' ? '#8d96a2' : look.body === 'suit' ? '#3a4050' : SKIN, 1);
  }

  // ------------------------------------------------------------ Reittiere & Fahrzeuge

  function legPair(ctx, x, top, len, ph, col, off) {
    for (let k = 0; k < 2; k++) {
      const a = Math.sin(ph + off + k * Math.PI) * 0.5;
      const kx = x + Math.sin(a) * len * 0.5;
      const ky = top + len * 0.5;
      limb(ctx, x, top, kx, ky, 4.4, k ? col : shade(col, -0.2));
      limb(ctx, kx, ky, kx + Math.sin(a * 0.6) * len * 0.5 - 1, 0, 3.6, k ? col : shade(col, -0.2));
    }
  }

  function drawSabertooth(ctx, look, team, ph, moving, atkP) {
    const fur = '#c98a3e';
    const lph = moving ? ph * 1.3 : 0;
    legPair(ctx, -15, -20, 20, lph, fur, 0);
    legPair(ctx, 15, -20, 20, lph, fur, Math.PI / 2);
    // Schwanz
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-22, -27);
    ctx.quadraticCurveTo(-34, -30, -32, -42 + Math.sin(ph) * 3);
    ctx.stroke();
    ctx.strokeStyle = fur;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -27, 25, 11.5, 0, 0, TAU);
    fillStroke(ctx, fur, 1.8);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#8e5a22';
    for (let i = -18; i < 22; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, -40);
      ctx.lineTo(i + 3, -40);
      ctx.lineTo(i + 1, -28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#efd2a4';
    ctx.beginPath();
    ctx.ellipse(2, -18, 20, 5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Kopf
    const bite = atkP > 0 ? Math.sin(atkP * Math.PI) * 4 : 0;
    ctx.save();
    ctx.translate(26, -32);
    ctx.rotate(bite * 0.04);
    circle(ctx, -6, -8, 3.5, fur, 1.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 9, 0, 0, TAU);
    fillStroke(ctx, fur, 1.6);
    ctx.beginPath();
    ctx.ellipse(7, 3, 6, 4.5, 0, 0, TAU);
    fillStroke(ctx, '#efd2a4', 1.2);
    ctx.fillStyle = OUT;
    ctx.fillRect(3, -4, 2.6, 2.6);
    ctx.fillRect(11, 0.5, 2.2, 2);
    // Säbelzähne
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(7.5, 14 + bite);
    ctx.lineTo(9, 6);
    ctx.closePath();
    fillStroke(ctx, '#fbf6e9', 1);
    ctx.restore();
    // Halsband in Teamfarbe
    ctx.fillStyle = TEAM[team].main;
    ctx.fillRect(14, -36, 4, 14);
    drawRider(ctx, look, team, -2, -30, ph, atkP);
  }

  function drawRider(ctx, look, team, x, y, ph, atkP) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.92, 0.92);
    drawHumanoid(ctx, look, team, { phase: ph, moving: false, atk: atkP, seated: true });
    ctx.restore();
  }

  function drawHorse(ctx, team, ph, moving, caparison) {
    const coat = '#7b5a40';
    const lph = moving ? ph * 1.4 : 0;
    legPair(ctx, -14, -24, 24, lph, coat, 0);
    legPair(ctx, 14, -24, 24, lph, coat, 1.2);
    // Schweif
    ctx.beginPath();
    ctx.moveTo(-22, -32);
    ctx.quadraticCurveTo(-34, -28, -30, -12 + Math.sin(ph) * 2);
    ctx.quadraticCurveTo(-26, -24, -21, -27);
    fillStroke(ctx, '#3a2a1e', 1.2);
    ctx.beginPath();
    ctx.ellipse(0, -31, 23, 10.5, 0, 0, TAU);
    fillStroke(ctx, coat, 1.8);
    // Hals + Kopf
    ctx.beginPath();
    ctx.moveTo(14, -38);
    ctx.lineTo(24, -54);
    ctx.lineTo(34, -48);
    ctx.lineTo(35, -43);
    ctx.lineTo(27, -42);
    ctx.lineTo(22, -30);
    ctx.closePath();
    fillStroke(ctx, coat, 1.6);
    ctx.beginPath();
    ctx.moveTo(16, -40);
    ctx.lineTo(23, -55);
    ctx.lineTo(20, -55);
    ctx.lineTo(13, -42);
    ctx.closePath();
    fillStroke(ctx, '#3a2a1e', 1.1);
    ctx.fillStyle = OUT;
    ctx.fillRect(27, -50, 2, 2);
    if (caparison) {
      ctx.beginPath();
      ctx.moveTo(-22, -36);
      ctx.lineTo(18, -36);
      ctx.lineTo(20, -20);
      ctx.lineTo(10, -15);
      ctx.lineTo(0, -19);
      ctx.lineTo(-10, -15);
      ctx.lineTo(-22, -20);
      ctx.closePath();
      fillStroke(ctx, TEAM[team].main, 1.5);
      ctx.fillStyle = '#f0e6c8';
      ctx.fillRect(-22, -24, 42, 2);
      ctx.beginPath();
      ctx.moveTo(14, -40);
      ctx.lineTo(25, -54);
      ctx.lineTo(29, -51);
      ctx.lineTo(20, -36);
      ctx.closePath();
      fillStroke(ctx, '#a3acb7', 1.1);
    }
  }

  function drawChariot(ctx, look, team, ph, moving, atkP, dist) {
    const T = TEAM[team];
    ctx.save();
    ctx.translate(12, 0);
    ctx.scale(0.82, 0.82);
    drawHorse(ctx, team, ph, moving, false);
    ctx.restore();
    // Deichsel
    limb(ctx, -10, -18, 6, -24, 2.4, '#6b4a2a');
    // Wagenkasten
    ctx.beginPath();
    ctx.moveTo(-26, -34);
    ctx.lineTo(-10, -34);
    ctx.lineTo(-6, -14);
    ctx.lineTo(-26, -14);
    ctx.closePath();
    fillStroke(ctx, T.main, 1.6);
    ctx.fillStyle = '#d6a64d';
    ctx.fillRect(-26, -24, 20, 3);
    // Fahrer
    ctx.save();
    ctx.translate(-17, -16);
    ctx.scale(0.88, 0.88);
    drawHumanoid(ctx, look, team, { phase: 0, moving: false, atk: atkP, noLegs: true });
    ctx.restore();
    // Rad
    const rot = dist / 11;
    circle(ctx, -16, -11, 11, '#8a6136', 1.8);
    circle(ctx, -16, -11, 8, '#6b4a2a', 1.2);
    ctx.strokeStyle = '#d6a64d';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(-16, -11);
      ctx.lineTo(-16 + Math.cos(a) * 8, -11 + Math.sin(a) * 8);
      ctx.stroke();
    }
    circle(ctx, -16, -11, 2.2, '#d6a64d', 1);
  }

  function drawKnightRider(ctx, look, team, ph, moving, atkP) {
    drawHorse(ctx, team, ph, moving, true);
    drawRider(ctx, look, team, -4, -33, ph, atkP);
  }

  function drawCannon(ctx, look, team, ph, moving, atkP, dist) {
    const T = TEAM[team];
    const rec = atkP > 0 && atkP < 0.5 ? (0.5 - atkP) * 10 : 0;
    // Kanonier
    ctx.save();
    ctx.translate(-24, 0);
    ctx.scale(0.9, 0.9);
    drawHumanoid(ctx, look, team, { phase: ph, moving, atk: 0 });
    ctx.restore();
    // Lafette
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.lineTo(8, -20);
    ctx.lineTo(12, -16);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    fillStroke(ctx, '#6f4b2b', 1.4);
    // Rohr
    ctx.save();
    ctx.translate(4 - rec, -22);
    ctx.rotate(-0.12);
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(26, -4);
    ctx.lineTo(26, 4);
    ctx.lineTo(-12, 6);
    ctx.quadraticCurveTo(-17, 0, -12, -6);
    fillStroke(ctx, '#3c3f45', 1.6);
    ctx.fillStyle = T.main;
    ctx.fillRect(-4, -5.6, 3, 11.2);
    ctx.fillStyle = '#5c6068';
    ctx.fillRect(22, -5, 4, 10);
    ctx.restore();
    // Rad
    const rot = dist / 12;
    circle(ctx, 2, -12, 12, '#7c5530', 1.8);
    ctx.strokeStyle = '#4d321b';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(2, -12);
      ctx.lineTo(2 + Math.cos(a) * 11, -12 + Math.sin(a) * 11);
      ctx.stroke();
    }
    circle(ctx, 2, -12, 2.6, '#3c3f45', 1);
  }

  function drawTank(ctx, look, team, ph, moving, atkP, dist) {
    const T = TEAM[team];
    const rec = atkP > 0 && atkP < 0.4 ? (0.4 - atkP) * 12 : 0;
    const body = '#56643a';
    // Ketten
    rrect(ctx, -30, -13, 60, 13, 6.5);
    fillStroke(ctx, '#2b2c2a', 1.8);
    for (let i = 0; i < 6; i++) circle(ctx, -22 + i * 8.8, -6.5, 4, '#4a4c47', 1.1);
    ctx.fillStyle = '#5e605a';
    const off = (dist * 0.6) % 6;
    for (let x = -28 + off; x < 28; x += 6) ctx.fillRect(x, -13, 2.4, 2);
    // Wanne
    ctx.beginPath();
    ctx.moveTo(-29, -13);
    ctx.lineTo(-26, -24);
    ctx.lineTo(24, -24);
    ctx.lineTo(31, -15);
    ctx.lineTo(29, -13);
    ctx.closePath();
    fillStroke(ctx, body, 1.8);
    ctx.fillStyle = T.main;
    ctx.fillRect(-24, -20, 46, 3);
    // Turm
    ctx.save();
    ctx.translate(-3 - rec * 0.3, -24);
    limb(ctx, 8, -7, 36 - rec, -7, 3.6, '#46522e');
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-11, -12);
    ctx.lineTo(8, -13);
    ctx.lineTo(14, -4);
    ctx.lineTo(14, 0);
    ctx.closePath();
    fillStroke(ctx, shade(body, 0.08), 1.6);
    circle(ctx, -3, -13, 3, shade(body, -0.15), 1.2);
    ctx.fillStyle = T.light;
    ctx.beginPath();
    ctx.arc(2, -6, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMech(ctx, look, team, ph, moving, atkP) {
    const T = TEAM[team];
    const metal = '#5b6274';
    const p = moving ? ph * 1.1 : 0;
    // Beine (Vogelbein-Gelenk)
    for (let k = 0; k < 2; k++) {
      const a = Math.sin(p + k * Math.PI) * 0.45;
      const col = k ? metal : shade(metal, -0.25);
      const hipX = k ? 4 : -4;
      const kneeX = hipX + 8 + Math.sin(a) * 8;
      const kneeY = -22 - Math.max(0, Math.cos(p + k * Math.PI)) * 3;
      const footX = hipX + Math.sin(a) * 12;
      limb(ctx, hipX, -38, kneeX, kneeY, 6, col);
      limb(ctx, kneeX, kneeY, footX, -3, 5, col);
      rrect(ctx, footX - 7, -4.5, 15, 4.5, 2);
      fillStroke(ctx, shade(col, -0.2), 1.2);
    }
    // Rumpf
    const bob = moving ? Math.abs(Math.sin(p)) * 2 : 0;
    ctx.save();
    ctx.translate(0, -bob);
    rrect(ctx, -20, -64, 36, 26, 6);
    fillStroke(ctx, metal, 1.8);
    ctx.fillStyle = shade(metal, -0.3);
    ctx.fillRect(-20, -46, 36, 4);
    ctx.save();
    ctx.shadowColor = T.glow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = T.glow;
    rrect(ctx, 2, -59, 12, 8, 3);
    ctx.fill();
    ctx.fillRect(-16, -43, 28, 1.6);
    ctx.restore();
    // Waffenarm
    const rec = atkP > 0 && atkP < 0.4 ? (0.4 - atkP) * 6 : 0;
    rrect(ctx, 4 - rec, -44, 30, 7, 3);
    fillStroke(ctx, shade(metal, 0.1), 1.5);
    circle(ctx, 33 - rec, -40.5, 3, T.glow, 1);
    // Antenne
    limb(ctx, -14, -64, -18, -74, 1.4, '#9aa3b5');
    circle(ctx, -18, -75, 2, T.glow, 0.8);
    ctx.restore();
  }

  // ------------------------------------------------------------ Einheit (Weltkoordinaten)

  function drawUnitBody(ctx, def, team, ph, moving, atkP, dist) {
    switch (def.mount) {
      case 'sabertooth':
        return drawSabertooth(ctx, def.look, team, ph, moving, atkP);
      case 'chariot':
        return drawChariot(ctx, def.look, team, ph, moving, atkP, dist);
      case 'horse':
        return drawKnightRider(ctx, def.look, team, ph, moving, atkP);
      case 'cannon':
        return drawCannon(ctx, def.look, team, ph, moving, atkP, dist);
      case 'tank':
        return drawTank(ctx, def.look, team, ph, moving, atkP, dist);
      case 'mech':
        return drawMech(ctx, def.look, team, ph, moving, atkP);
      default:
        return drawHumanoid(ctx, def.look, team, { phase: ph, moving, atk: atkP });
    }
  }

  function drawUnit(ctx, u, x, y, opts) {
    const def = u.def;
    const atkP = u.atk > 0 ? 1 - u.atk / 0.35 : 0;
    const moving = u.state === 'walk';
    const ph = u.walk * (def.mount ? 0.13 : 0.2);
    ctx.save();
    ctx.translate(x, y);
    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, def.w * 0.55, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.scale(u.dir, 1);
    if (opts && opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts && opts.rot) ctx.rotate(opts.rot);
    // Treffer: kurzer Rückstoß nach hinten (ctx.filter wäre pro Zeichenbefehl zu teuer)
    if (u.hurt > 0) ctx.translate(-u.hurt * 14, 0);
    drawUnitBody(ctx, def, u.team, ph, moving, atkP, u.walk);
    ctx.restore();
  }

  function drawUnitIcon(ctx, def, team, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawUnitBody(ctx, def, team, 0.6, false, 0, 0);
    ctx.restore();
  }

  // ------------------------------------------------------------ Türme

  function drawTurret(ctx, kind, team, angle, fire, age) {
    // Ursprung = Plattform-Mittelpunkt, lokal nach rechts gerichtet.
    const T = TEAM[team];
    const a = Math.max(-1.0, Math.min(0.7, angle));
    const kick = fire > 0 ? fire * 10 : 0;
    switch (kind) {
      case 'catapult': {
        rrect(ctx, -14, -8, 26, 8, 2);
        fillStroke(ctx, '#7a5230', 1.4);
        limb(ctx, -8, -8, 0, -20, 3, '#6b4a2a');
        limb(ctx, 8, -8, 0, -20, 3, '#6b4a2a');
        const arm = fire > 0 ? -0.2 : -1.9;
        ctx.save();
        ctx.translate(0, -18);
        ctx.rotate(arm);
        limb(ctx, 0, 0, 22, 0, 3, '#8a6136');
        circle(ctx, 22, 0, 4, '#8f8a80', 1.2);
        ctx.restore();
        ctx.fillStyle = T.main;
        ctx.fillRect(-12, -6, 6, 4);
        break;
      }
      case 'ballista': {
        limb(ctx, -6, 0, 0, -12, 3, '#6b4a2a');
        limb(ctx, 6, 0, 0, -12, 3, '#6b4a2a');
        ctx.save();
        ctx.translate(0, -14);
        ctx.rotate(a);
        limb(ctx, -14 + kick * 0.3, 0, 22, 0, 4, '#8a6136');
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(14, -14);
        ctx.quadraticCurveTo(22, 0, 14, 14);
        ctx.stroke();
        ctx.strokeStyle = '#a07a46';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(14, -14);
        ctx.lineTo(fire > 0 ? 12 : 2, 0);
        ctx.lineTo(14, 14);
        ctx.stroke();
        ctx.fillStyle = T.main;
        ctx.fillRect(-12, -3, 5, 6);
        ctx.restore();
        break;
      }
      case 'trebuchet': {
        rrect(ctx, -16, -6, 30, 6, 2);
        fillStroke(ctx, '#6b4a2a', 1.4);
        limb(ctx, -10, -6, -2, -26, 3, '#7a5230');
        limb(ctx, 6, -6, -2, -26, 3, '#7a5230');
        const arm = fire > 0 ? 0.4 : -2.3;
        ctx.save();
        ctx.translate(-2, -26);
        ctx.rotate(arm);
        limb(ctx, -10, 0, 26, 0, 3, '#8a6136');
        rrect(ctx, -16, -5, 9, 10, 2);
        fillStroke(ctx, '#55595f', 1.2);
        if (fire <= 0) {
          circle(ctx, 26, 0, 4.5, '#b3541e', 1.2);
          ctx.fillStyle = '#ffcf4a';
          ctx.beginPath();
          ctx.arc(26, -3, 2.4, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = T.main;
        ctx.fillRect(-14, -5, 6, 4);
        break;
      }
      case 'cannon': {
        ctx.save();
        ctx.translate(-2, -12);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-12 - kick * 0.4, -6);
        ctx.lineTo(26 - kick * 0.4, -4.5);
        ctx.lineTo(26 - kick * 0.4, 4.5);
        ctx.lineTo(-12 - kick * 0.4, 6);
        ctx.quadraticCurveTo(-18 - kick * 0.4, 0, -12 - kick * 0.4, -6);
        fillStroke(ctx, '#33363b', 1.6);
        ctx.fillStyle = T.main;
        ctx.fillRect(-4 - kick * 0.4, -5.6, 3, 11.2);
        ctx.restore();
        rrect(ctx, -14, -8, 24, 8, 2);
        fillStroke(ctx, '#6f4b2b', 1.4);
        circle(ctx, -6, -2, 5, '#4d321b', 1.2);
        circle(ctx, 4, -2, 5, '#4d321b', 1.2);
        break;
      }
      case 'mg': {
        rrect(ctx, -16, -9, 30, 9, 4);
        fillStroke(ctx, '#bfae7c', 1.4);
        ctx.strokeStyle = '#8f8160';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, -9);
        ctx.lineTo(-6, 0);
        ctx.moveTo(4, -9);
        ctx.lineTo(4, 0);
        ctx.stroke();
        ctx.save();
        ctx.translate(-2, -13);
        ctx.rotate(a);
        rrect(ctx, -10 - kick * 0.15, -4, 18, 8, 2);
        fillStroke(ctx, '#3a3d36', 1.4);
        limb(ctx, 6 - kick * 0.15, 0, 26 - kick * 0.15, 0, 2.4, '#26282a');
        ctx.fillStyle = T.main;
        ctx.fillRect(-8, -4, 4, 8);
        ctx.restore();
        break;
      }
      case 'ion': {
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-9, -12);
        ctx.lineTo(9, -12);
        ctx.lineTo(14, 0);
        ctx.closePath();
        fillStroke(ctx, '#3d4352', 1.5);
        ctx.save();
        ctx.translate(0, -18);
        ctx.rotate(a);
        rrect(ctx, -8, -7, 20, 14, 5);
        fillStroke(ctx, '#596178', 1.5);
        limb(ctx, 10, 0, 26, 0, 3, '#7a839c');
        ctx.shadowColor = T.glow;
        ctx.shadowBlur = 12 + fire * 30;
        ctx.fillStyle = fire > 0 ? '#ffffff' : T.glow;
        ctx.beginPath();
        ctx.arc(1, 0, 4 + fire * 6, 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }

  // Halterung für einen Turmplatz – im Stil des Zeitalters der Basis.
  function drawMount(ctx, age, team) {
    const T = TEAM[team];
    const wood = age <= 2;
    const col = wood ? '#7a5230' : age === 3 ? '#8d8a82' : age === 4 ? '#7f8478' : '#4a5163';
    // Dreieckige Konsole, die an der Wand der Basis hängt
    limb(ctx, -16, 6, -16, 24, 3, shade(col, -0.2));
    limb(ctx, -16, 24, 8, 6, 3, shade(col, -0.2));
    rrect(ctx, -20, 0, 40, 7, 2);
    fillStroke(ctx, col, 1.4);
    if (age === 5) {
      ctx.save();
      ctx.shadowColor = T.glow;
      ctx.shadowBlur = 6;
      ctx.fillStyle = T.glow;
      ctx.fillRect(-18, 3, 36, 1.5);
      ctx.restore();
    } else {
      ctx.fillStyle = T.main;
      ctx.fillRect(-18, 2, 6, 3);
    }
  }

  // ------------------------------------------------------------ Basen

  function flag(ctx, x, y, h, T, t, glow) {
    limb(ctx, x, y, x, y - h, 2, '#5b4a3a');
    const wv = Math.sin(t * 4) * 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y - h);
    ctx.quadraticCurveTo(x + 12, y - h - 3 + wv, x + 24, y - h + 1 + wv);
    ctx.lineTo(x + 24, y - h + 13 + wv);
    ctx.quadraticCurveTo(x + 12, y - h + 10 - wv, x + 1, y - h + 13);
    ctx.closePath();
    if (glow) {
      ctx.save();
      ctx.shadowColor = T.glow;
      ctx.shadowBlur = 10;
      fillStroke(ctx, T.main, 1.3);
      ctx.restore();
    } else fillStroke(ctx, T.main, 1.3);
  }

  function stones(ctx, x0, y0, x1, y1, col, seed) {
    let s = seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    ctx.strokeStyle = shade(col, -0.25);
    ctx.lineWidth = 1;
    for (let y = y0 + 8; y < y1; y += 12) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      const off = rnd() * 16;
      for (let x = x0 + off; x < x1; x += 18 + rnd() * 6) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 12);
        ctx.stroke();
      }
    }
  }

  // Basis zeichnen (Weltkoordinaten bereits gespiegelt: Ursprung x=0 Boden, nach rechts = Front)
  function drawBase(ctx, age, team, t) {
    const T = TEAM[team];
    switch (age) {
      case 0: {
        // Felsenhöhle
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-10, -150);
        ctx.quadraticCurveTo(10, -235, 60, -245);
        ctx.quadraticCurveTo(100, -230, 104, -170);
        ctx.quadraticCurveTo(120, -120, 112, -60);
        ctx.lineTo(118, 0);
        ctx.closePath();
        fillStroke(ctx, '#8b8478', 2);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#9d968a';
        ctx.beginPath();
        ctx.ellipse(40, -190, 40, 30, -0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#756f64';
        ctx.beginPath();
        ctx.ellipse(90, -90, 30, 50, 0.2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#5f594f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -120);
        ctx.quadraticCurveTo(40, -130, 60, -110);
        ctx.moveTo(30, -200);
        ctx.quadraticCurveTo(60, -190, 80, -205);
        ctx.stroke();
        ctx.restore();
        // Höhleneingang
        ctx.beginPath();
        ctx.moveTo(52, 0);
        ctx.quadraticCurveTo(52, -66, 80, -70);
        ctx.quadraticCurveTo(106, -66, 108, 0);
        ctx.closePath();
        fillStroke(ctx, '#231d19', 1.8);
        // Feuer im Eingang
        const fl = Math.sin(t * 13) * 2;
        ctx.fillStyle = '#ff9a2e';
        ctx.beginPath();
        ctx.moveTo(72, -2);
        ctx.quadraticCurveTo(80, -24 - fl, 88, -2);
        ctx.fill();
        ctx.fillStyle = '#ffe07a';
        ctx.beginPath();
        ctx.moveTo(76, -2);
        ctx.quadraticCurveTo(80, -14 + fl, 84, -2);
        ctx.fill();
        // Palisade
        for (let i = 0; i < 4; i++) {
          const x = 112 + i * 7;
          ctx.beginPath();
          ctx.moveTo(x - 3, 0);
          ctx.lineTo(x - 3, -22 - (i % 2) * 6);
          ctx.lineTo(x, -30 - (i % 2) * 6);
          ctx.lineTo(x + 3, -22 - (i % 2) * 6);
          ctx.lineTo(x + 3, 0);
          ctx.closePath();
          fillStroke(ctx, '#8a6136', 1.2);
        }
        // Totem mit Teamfarbe
        rrect(ctx, 14, -60, 14, 60, 3);
        fillStroke(ctx, '#7a5230', 1.4);
        ctx.fillStyle = T.main;
        ctx.fillRect(14, -52, 14, 6);
        ctx.fillRect(14, -30, 14, 6);
        circle(ctx, 21, -66, 8, T.main, 1.4);
        flag(ctx, 58, -244, 34, T, t);
        break;
      }
      case 1: {
        // Tempel mit Obelisk
        rrect(ctx, 64, -258, 26, 160, 2);
        ctx.beginPath();
        ctx.moveTo(64, -98);
        ctx.lineTo(68, -250);
        ctx.lineTo(77, -266);
        ctx.lineTo(86, -250);
        ctx.lineTo(90, -98);
        ctx.closePath();
        fillStroke(ctx, '#e3d3ac', 1.8);
        ctx.fillStyle = T.main;
        ctx.fillRect(70, -200, 14, 4);
        ctx.fillRect(70, -150, 14, 4);
        ctx.fillStyle = '#d8b64a';
        ctx.beginPath();
        ctx.moveTo(77, -266);
        ctx.lineTo(82, -256);
        ctx.lineTo(72, -256);
        ctx.closePath();
        ctx.fill();
        // Stufen
        for (let i = 0; i < 3; i++) {
          rrect(ctx, -10 + i * 4, -12 - i * 8, 132 - i * 8, 10, 1);
          fillStroke(ctx, shade('#e8dbbb', -i * 0.04), 1.4);
        }
        // Säulen
        for (let i = 0; i < 4; i++) {
          const x = 4 + i * 28;
          rrect(ctx, x, -98, 12, 66, 1);
          fillStroke(ctx, '#f1e6c9', 1.4);
          ctx.strokeStyle = '#cbbd98';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 4, -96);
          ctx.lineTo(x + 4, -34);
          ctx.moveTo(x + 8, -96);
          ctx.lineTo(x + 8, -34);
          ctx.stroke();
          rrect(ctx, x - 2, -102, 16, 5, 1);
          fillStroke(ctx, '#e3d3ac', 1.2);
        }
        rrect(ctx, -6, -112, 128, 12, 1);
        fillStroke(ctx, '#e3d3ac', 1.5);
        ctx.fillStyle = T.main;
        ctx.fillRect(-4, -109, 124, 4);
        ctx.beginPath();
        ctx.moveTo(-8, -112);
        ctx.lineTo(56, -146);
        ctx.lineTo(120, -112);
        ctx.closePath();
        fillStroke(ctx, '#f1e6c9', 1.6);
        circle(ctx, 56, -124, 7, T.main, 1.3);
        flag(ctx, 77, -266, 30, T, t);
        break;
      }
      case 2: {
        // Burg
        const stone = '#9a958c';
        rrect(ctx, 46, -262, 56, 262, 2);
        fillStroke(ctx, stone, 2);
        stones(ctx, 47, -262, 101, 0, stone, 7 + team);
        for (let i = 0; i < 4; i++) {
          rrect(ctx, 44 + i * 16, -276, 11, 16, 1);
          fillStroke(ctx, stone, 1.4);
        }
        rrect(ctx, -10, -150, 64, 150, 2);
        fillStroke(ctx, shade(stone, -0.06), 2);
        stones(ctx, -9, -150, 53, 0, shade(stone, -0.06), 3 + team);
        for (let i = 0; i < 4; i++) {
          rrect(ctx, -10 + i * 17, -162, 11, 14, 1);
          fillStroke(ctx, shade(stone, -0.06), 1.4);
        }
        // Tor
        ctx.beginPath();
        ctx.moveTo(62, 0);
        ctx.lineTo(62, -44);
        ctx.quadraticCurveTo(80, -66, 98, -44);
        ctx.lineTo(98, 0);
        ctx.closePath();
        fillStroke(ctx, '#4a321e', 1.8);
        ctx.strokeStyle = '#2b1c10';
        ctx.lineWidth = 1.4;
        for (let x = 68; x < 98; x += 7) {
          ctx.beginPath();
          ctx.moveTo(x, -2);
          ctx.lineTo(x, -50);
          ctx.stroke();
        }
        // Fenster + Banner
        ctx.fillStyle = '#1e1a18';
        ctx.fillRect(70, -200, 8, 16);
        ctx.fillRect(14, -110, 8, 14);
        ctx.beginPath();
        ctx.moveTo(52, -240);
        ctx.lineTo(70, -240);
        ctx.lineTo(70, -205);
        ctx.lineTo(61, -212);
        ctx.lineTo(52, -205);
        ctx.closePath();
        fillStroke(ctx, T.main, 1.3);
        flag(ctx, 74, -276, 34, T, t);
        break;
      }
      case 3: {
        // Bastion / Festung
        const brick = '#b0846a';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-10, -140);
        ctx.lineTo(108, -140);
        ctx.lineTo(124, 0);
        ctx.closePath();
        fillStroke(ctx, brick, 2);
        stones(ctx, -9, -140, 118, 0, brick, 11 + team);
        rrect(ctx, -12, -150, 124, 12, 1);
        fillStroke(ctx, '#d6c8b0', 1.6);
        // Turm
        rrect(ctx, 52, -262, 48, 114, 2);
        fillStroke(ctx, '#c49a7d', 2);
        stones(ctx, 53, -262, 99, -150, '#c49a7d', 5 + team);
        rrect(ctx, 48, -270, 56, 10, 1);
        fillStroke(ctx, '#d6c8b0', 1.6);
        // Schießscharten
        ctx.fillStyle = '#2a2220';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(20 + i * 30, -90, 6, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(14 + i * 30, -90, 12, 8);
        }
        ctx.beginPath();
        ctx.moveTo(70, 0);
        ctx.lineTo(70, -40);
        ctx.quadraticCurveTo(84, -56, 98, -40);
        ctx.lineTo(98, 0);
        ctx.closePath();
        fillStroke(ctx, '#3d2a1c', 1.6);
        ctx.fillStyle = T.main;
        ctx.fillRect(-10, -126, 118, 6);
        flag(ctx, 76, -270, 38, T, t);
        break;
      }
      case 4: {
        // Bunker
        const con = '#8c8f87';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-10, -112);
        ctx.quadraticCurveTo(-10, -126, 6, -126);
        ctx.lineTo(96, -126);
        ctx.quadraticCurveTo(116, -126, 120, -100);
        ctx.lineTo(128, 0);
        ctx.closePath();
        fillStroke(ctx, con, 2);
        ctx.fillStyle = shade(con, -0.12);
        ctx.fillRect(-8, -64, 130, 6);
        ctx.fillStyle = '#1d1f1c';
        rrect(ctx, 64, -100, 44, 10, 3);
        ctx.fill();
        rrect(ctx, 10, -100, 36, 10, 3);
        ctx.fill();
        // Turm mit Radar
        rrect(ctx, 58, -262, 30, 138, 2);
        fillStroke(ctx, shade(con, 0.05), 1.8);
        ctx.strokeStyle = '#5f625b';
        ctx.lineWidth = 1.2;
        for (let y = -250; y < -130; y += 14) {
          ctx.beginPath();
          ctx.moveTo(58, y);
          ctx.lineTo(88, y + 14);
          ctx.moveTo(88, y);
          ctx.lineTo(58, y + 14);
          ctx.stroke();
        }
        limb(ctx, 73, -262, 73, -290, 2, '#5f625b');
        ctx.save();
        ctx.translate(73, -290);
        ctx.scale(Math.cos(t * 1.5), 1);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 5, 0, 0, TAU);
        fillStroke(ctx, '#b9bdb3', 1.2);
        ctx.restore();
        // Sandsäcke
        for (let i = 0; i < 5; i++) {
          rrect(ctx, 96 + (i % 3) * 12, -12 - Math.floor(i / 3) * 9, 14, 10, 4);
          fillStroke(ctx, '#bfae7c', 1.2);
        }
        ctx.fillStyle = T.main;
        ctx.fillRect(-8, -118, 58, 8);
        flag(ctx, 30, -126, 40, T, t);
        break;
      }
      case 5: {
        // Zukunfts-Zitadelle
        ctx.save();
        ctx.globalAlpha = 0.18 + Math.sin(t * 2) * 0.05;
        ctx.fillStyle = T.glow;
        ctx.beginPath();
        ctx.ellipse(50, 0, 96, 170, 0, Math.PI, TAU);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-10, -90);
        ctx.lineTo(30, -120);
        ctx.lineTo(112, -120);
        ctx.lineTo(126, 0);
        ctx.closePath();
        fillStroke(ctx, '#3a4050', 2);
        ctx.beginPath();
        ctx.moveTo(50, -120);
        ctx.lineTo(58, -270);
        ctx.lineTo(72, -290);
        ctx.lineTo(86, -270);
        ctx.lineTo(96, -120);
        ctx.closePath();
        fillStroke(ctx, '#4a5163', 2);
        ctx.save();
        ctx.shadowColor = T.glow;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = T.glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(72, -284);
        ctx.lineTo(72, -124);
        ctx.moveTo(-6, -60);
        ctx.lineTo(120, -60);
        ctx.moveTo(-6, -84);
        ctx.lineTo(30, -110);
        ctx.lineTo(108, -110);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(72, -296 + Math.sin(t * 3) * 3, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = T.glow;
        rrect(ctx, 76, -46, 34, 44, 6);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        rrect(ctx, 80, -42, 26, 40, 5);
        ctx.fill();
        break;
      }
    }
  }

  // ------------------------------------------------------------ Symbole (HUD)

  function drawSpecialIcon(ctx, kind, team, x, y, s) {
    const T = TEAM[team];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    switch (kind) {
      case 'boulders':
        circle(ctx, -4, 4, 9, '#8f8a80', 1.6);
        circle(ctx, 8, -6, 6, '#a39e94', 1.4);
        ctx.strokeStyle = '#5f594f';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(-4, 4, 5, 0.5, 2.5);
        ctx.stroke();
        break;
      case 'lightning':
        ctx.beginPath();
        ctx.moveTo(2, -16);
        ctx.lineTo(-8, 2);
        ctx.lineTo(0, 2);
        ctx.lineTo(-4, 16);
        ctx.lineTo(9, -3);
        ctx.lineTo(1, -3);
        ctx.lineTo(6, -16);
        ctx.closePath();
        fillStroke(ctx, '#ffe45c', 1.4);
        break;
      case 'arrows':
        for (let i = -1; i <= 1; i++) {
          limb(ctx, i * 7 - 6, -12, i * 7 + 4, 10, 1.6, '#8a6136');
          ctx.beginPath();
          ctx.moveTo(i * 7 + 6, 14);
          ctx.lineTo(i * 7 + 1, 7);
          ctx.lineTo(i * 7 + 7, 6);
          ctx.closePath();
          fillStroke(ctx, '#cfd4da', 1);
        }
        break;
      case 'cannonade':
        circle(ctx, -6, 4, 7, '#2b2c30', 1.4);
        circle(ctx, 7, -5, 5.5, '#2b2c30', 1.4);
        ctx.fillStyle = '#ff9a2e';
        ctx.beginPath();
        ctx.arc(-12, 10, 3, 0, TAU);
        ctx.fill();
        break;
      case 'airstrike':
        drawPlane(ctx, team, 0, 0, 0.55);
        break;
      case 'orbital':
        ctx.save();
        ctx.shadowColor = T.glow;
        ctx.shadowBlur = 10;
        ctx.fillStyle = T.glow;
        ctx.fillRect(-4, -12, 8, 28);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1.5, -12, 3, 28);
        ctx.restore();
        rrect(ctx, -11, -18, 22, 8, 3);
        fillStroke(ctx, '#596178', 1.3);
        break;
    }
    ctx.restore();
  }

  function drawPlane(ctx, team, x, y, s) {
    const T = TEAM[team];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-34, -2);
    ctx.lineTo(24, -5);
    ctx.quadraticCurveTo(38, -2, 24, 4);
    ctx.lineTo(-34, 4);
    ctx.closePath();
    fillStroke(ctx, '#6c7466', 1.6);
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-16, 18);
    ctx.lineTo(-8, 18);
    ctx.lineTo(10, 0);
    ctx.closePath();
    fillStroke(ctx, '#5b6356', 1.4);
    ctx.beginPath();
    ctx.moveTo(-28, -1);
    ctx.lineTo(-36, -14);
    ctx.lineTo(-30, -14);
    ctx.lineTo(-20, -1);
    ctx.closePath();
    fillStroke(ctx, '#5b6356', 1.4);
    circle(ctx, 2, 6, 4, T.main, 1.2);
    ctx.fillStyle = '#bfe3ff';
    ctx.fillRect(16, -4, 6, 3);
    ctx.restore();
  }

  EK.sprites = {
    TEAM,
    OUT,
    shade,
    rrect,
    circle,
    limb,
    fillStroke,
    drawUnit,
    drawUnitIcon,
    drawUnitBody,
    drawTurret,
    drawMount,
    drawBase,
    drawSpecialIcon,
    drawPlane,
  };
})((globalThis.EK = globalThis.EK || {}));
