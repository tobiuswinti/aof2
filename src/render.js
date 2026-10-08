// Weltdarstellung: Hintergrund je Epoche, Basen, Türme, Einheiten, Geschosse,
// Spezialangriffe und ein reines Darstellungs-Partikelsystem.
(function (EK) {
  'use strict';

  const D = EK.data;
  const S = EK.sprites;
  const { W, H, GROUND_Y } = D;
  const TAU = Math.PI * 2;

  const ERA = [
    { sky: ['#5fb2ee', '#b9e1f6', '#fbe6b2'], sun: '#fff4b8', far: '#86a3bb', mid: '#6ea552', near: '#5b9442', grass: '#6cbf4a', dirt: '#8b6a45', cloud: 'rgba(255,255,255,0.9)', deco: 'trees' },
    { sky: ['#57a9e6', '#bfe4f6', '#fff0c6'], sun: '#fff6c8', far: '#9fb1bd', mid: '#a5b862', near: '#8fa650', grass: '#9cc155', dirt: '#a98656', cloud: 'rgba(255,255,255,0.9)', deco: 'cypress' },
    { sky: ['#7a98b8', '#b8c7d5', '#e9e0cc'], sun: '#f4f0dc', far: '#7d8ea0', mid: '#5f8a4c', near: '#4f7a3e', grass: '#5ea347', dirt: '#7a5d3e', cloud: 'rgba(240,242,246,0.92)', deco: 'pines' },
    { sky: ['#4c5fa6', '#d9845a', '#ffd497'], sun: '#ffd27a', far: '#7b6f88', mid: '#76804a', near: '#5f6d3c', grass: '#7aa64a', dirt: '#8a6a48', cloud: 'rgba(255,214,190,0.8)', deco: 'windmill' },
    { sky: ['#2d3858', '#7a6879', '#d98a5e'], sun: '#ffb27a', far: '#55566a', mid: '#4f5a3d', near: '#434c33', grass: '#5f7a3c', dirt: '#5e4b38', cloud: 'rgba(120,110,120,0.7)', deco: 'ruins' },
    { sky: ['#060a22', '#1b1850', '#4c2b70'], sun: '#d9e8ff', far: '#262a52', mid: '#1f2442', near: '#191c34', grass: '#2b5f78', dirt: '#24243a', cloud: 'rgba(130,110,200,0.25)', deco: 'towers', night: true },
  ];

  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function ridge(ctx, rnd, base, amp, step, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    let y = base;
    for (let x = 0; x <= W + step; x += step) {
      y = Math.max(base - amp, Math.min(base + amp * 0.3, y + (rnd() - 0.5) * amp * 0.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  function hills(ctx, base, amp, freq, phase, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= W; x += 8) {
      const y = base - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.7 + phase * 3) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  function deco(ctx, e, rnd) {
    const col = S.shade(e.near, -0.25);
    switch (e.deco) {
      case 'trees':
        for (let i = 0; i < 14; i++) {
          const x = 140 + rnd() * (W - 280);
          const h = 40 + rnd() * 30;
          ctx.fillStyle = '#5b3d22';
          ctx.fillRect(x - 3, GROUND_Y - 30 - h * 0.4, 6, h * 0.4 + 10);
          ctx.fillStyle = S.shade(e.near, -0.1 - rnd() * 0.15);
          ctx.beginPath();
          ctx.arc(x, GROUND_Y - 30 - h * 0.55, h * 0.35, 0, TAU);
          ctx.arc(x - h * 0.22, GROUND_Y - 30 - h * 0.4, h * 0.25, 0, TAU);
          ctx.arc(x + h * 0.22, GROUND_Y - 30 - h * 0.4, h * 0.25, 0, TAU);
          ctx.fill();
        }
        break;
      case 'cypress':
        for (let i = 0; i < 12; i++) {
          const x = 150 + rnd() * (W - 300);
          const h = 50 + rnd() * 40;
          ctx.fillStyle = S.shade('#4f6b33', -rnd() * 0.2);
          ctx.beginPath();
          ctx.ellipse(x, GROUND_Y - 28 - h / 2, 8, h / 2, 0, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(240,230,200,0.55)';
        for (let i = 0; i < 4; i++) {
          const x = 300 + i * 190 + rnd() * 60;
          ctx.fillRect(x, GROUND_Y - 80, 8, 52);
          ctx.fillRect(x - 3, GROUND_Y - 84, 14, 5);
        }
        break;
      case 'pines':
        for (let i = 0; i < 18; i++) {
          const x = 130 + rnd() * (W - 260);
          const h = 45 + rnd() * 40;
          ctx.fillStyle = S.shade('#2f5a3a', -rnd() * 0.25);
          ctx.beginPath();
          ctx.moveTo(x, GROUND_Y - 28 - h);
          ctx.lineTo(x + h * 0.3, GROUND_Y - 26);
          ctx.lineTo(x - h * 0.3, GROUND_Y - 26);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'windmill': {
        for (const x of [380, 900]) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(x - 14, GROUND_Y - 26);
          ctx.lineTo(x - 8, GROUND_Y - 110);
          ctx.lineTo(x + 8, GROUND_Y - 110);
          ctx.lineTo(x + 14, GROUND_Y - 26);
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 4;
          for (let k = 0; k < 4; k++) {
            const a = 0.5 + (k * Math.PI) / 2;
            ctx.beginPath();
            ctx.moveTo(x, GROUND_Y - 110);
            ctx.lineTo(x + Math.cos(a) * 46, GROUND_Y - 110 + Math.sin(a) * 46);
            ctx.stroke();
          }
        }
        break;
      }
      case 'ruins':
        ctx.fillStyle = col;
        for (let i = 0; i < 9; i++) {
          const x = 160 + i * 115 + rnd() * 40;
          const h = 40 + rnd() * 90;
          ctx.fillRect(x, GROUND_Y - 26 - h, 34 + rnd() * 30, h);
        }
        ctx.fillStyle = 'rgba(255,190,120,0.35)';
        for (let i = 0; i < 30; i++) ctx.fillRect(170 + rnd() * (W - 340), GROUND_Y - 40 - rnd() * 100, 3, 4);
        break;
      case 'towers':
        for (let i = 0; i < 12; i++) {
          const x = 150 + rnd() * (W - 300);
          const h = 70 + rnd() * 140;
          const w = 18 + rnd() * 26;
          ctx.fillStyle = '#141734';
          ctx.fillRect(x, GROUND_Y - 26 - h, w, h);
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,220,255,0.6)' : 'rgba(255,120,220,0.5)';
          for (let y = GROUND_Y - 20 - h; y < GROUND_Y - 34; y += 9) {
            if (rnd() < 0.55) ctx.fillRect(x + 4, y, w - 8, 2);
          }
        }
        break;
    }
  }

  function buildBackground(era) {
    const e = ERA[era];
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const rnd = seeded(1000 + era * 77);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, e.sky[0]);
    g.addColorStop(0.55, e.sky[1]);
    g.addColorStop(1, e.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GROUND_Y);
    if (e.night) {
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
        const r = rnd() < 0.1 ? 1.6 : 0.9;
        ctx.fillRect(rnd() * W, rnd() * (GROUND_Y - 200), r, r);
      }
    }
    // Sonne / Mond
    const sx = W * 0.5;
    const sy = era >= 3 ? 330 : 205;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 130);
    sg.addColorStop(0, e.sun);
    sg.addColorStop(0.25, e.sun);
    sg.addColorStop(0.26, 'rgba(255,255,255,0.25)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, 130, 0, TAU);
    ctx.fill();
    ridge(ctx, rnd, GROUND_Y - 150, 90, 26, e.far);
    hills(ctx, GROUND_Y - 70, 26, 0.006, era, e.mid);
    deco(ctx, e, rnd);
    hills(ctx, GROUND_Y - 22, 10, 0.011, era * 2 + 1, e.near);
    // Boden
    ctx.fillStyle = e.dirt;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    const dg = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    dg.addColorStop(0, 'rgba(0,0,0,0)');
    dg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = S.shade(e.dirt, (rnd() - 0.5) * 0.4);
      const y = GROUND_Y + 14 + rnd() * (H - GROUND_Y - 14);
      ctx.beginPath();
      ctx.ellipse(rnd() * W, y, 1.5 + rnd() * 3, 1 + rnd() * 1.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = e.grass;
    ctx.fillRect(0, GROUND_Y - 4, W, 12);
    ctx.fillStyle = S.shade(e.grass, -0.2);
    ctx.fillRect(0, GROUND_Y + 8, W, 3);
    ctx.fillStyle = S.shade(e.grass, 0.15);
    for (let x = 0; x < W; x += 5) {
      const h = 3 + rnd() * 5;
      ctx.fillRect(x, GROUND_Y - 3 - h, 2, h);
    }
    return c;
  }

  class Renderer {
    constructor(ctx) {
      this.ctx = ctx;
      this.particles = [];
      this.bg = [];
      this.era = 0;
      this.prevEra = 0;
      this.eraFade = 1;
      this.time = 0;
      this.shake = 0;
      this.flash = 0;
      this.flashColor = '#ffffff';
      const rnd = seeded(42);
      this.clouds = [];
      for (let i = 0; i < 7; i++) {
        this.clouds.push({ x: rnd() * W, y: 175 + rnd() * 150, s: 0.6 + rnd() * 0.8, v: 4 + rnd() * 8 });
      }
    }

    background(era) {
      if (!this.bg[era]) this.bg[era] = buildBackground(era);
      return this.bg[era];
    }

    // Zerstörte Basis: einmal in eine Offscreen-Leinwand zeichnen und abdunkeln.
    ruin(age, team) {
      this.ruins = this.ruins || {};
      const key = age * 2 + team;
      if (!this.ruins[key]) {
        const c = makeCanvas(180, 340);
        const g = c.getContext('2d');
        g.translate(20, 330);
        S.drawBase(g, age, team, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(24,20,18,0.6)';
        g.fillRect(-20, -330, 180, 340);
        this.ruins[key] = c;
      }
      return this.ruins[key];
    }

    // Nach einem Verlust des Zeichenkontexts müssen die Offscreen-Caches neu entstehen.
    invalidate() {
      this.bg = [];
      this.ruins = {};
    }

    reset() {
      this.particles.length = 0;
      this.shake = 0;
      this.flash = 0;
    }

    setEra(era) {
      if (era === this.era) return;
      this.prevEra = this.era;
      this.era = era;
      this.eraFade = 0;
    }

    add(p) {
      if (this.particles.length > 900) return;
      p.life = p.life || 0.5;
      p.max = p.life;
      this.particles.push(p);
    }

    burst(kind, x, y, n, opts) {
      for (let i = 0; i < n; i++) {
        const a = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.spread || 1) : Math.random() * TAU;
        const sp = (opts.speed || 100) * (0.4 + Math.random() * 0.8);
        this.add({
          kind,
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          g: opts.g != null ? opts.g : 400,
          life: (opts.life || 0.5) * (0.6 + Math.random() * 0.6),
          size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
          color: opts.colors ? opts.colors[Math.floor(Math.random() * opts.colors.length)] : opts.color,
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 12,
        });
      }
    }

    explosion(x, y, r) {
      const big = r >= 30;
      this.add({ kind: 'flash', x, y, size: r * 2.2, life: 0.18 });
      this.add({ kind: 'ring', x, y, size: r * 1.6, life: 0.35, color: 'rgba(255,240,200,0.8)' });
      this.burst('fire', x, y - 4, big ? 14 : 8, { speed: r * 4, life: 0.45, size: r * 0.28, g: -60, colors: ['#ffd25a', '#ff9a2e', '#ff5a1f'] });
      this.burst('smoke', x, y - 6, big ? 10 : 6, { speed: r * 1.6, life: 1.1, size: r * 0.35, g: -40, colors: ['#5a534d', '#6d655e', '#4a4440'] });
      this.burst('debris', x, y - 4, big ? 10 : 5, { angle: -Math.PI / 2, spread: 2.2, speed: r * 7, life: 0.9, size: 3, colors: ['#5a4630', '#3d3329', '#77624a'] });
      this.shake = Math.max(this.shake, big ? 5 : 2.5);
    }

    text(x, y, str, color, size) {
      this.add({ kind: 'text', x, y, vx: 0, vy: -38, g: 0, life: 1.1, text: str, color, size: size || 14 });
    }

    handleEvents(events, s) {
      for (const ev of events) {
        switch (ev.type) {
          case 'fire': {
            const gun = { bullet: 1, shell: 1, cannonball: 1, rocket: 1 };
            if (gun[ev.proj]) {
              this.add({ kind: 'muzzle', x: ev.x + ev.dir * 4, y: ev.y, dir: ev.dir, size: ev.proj === 'bullet' ? 7 : 12, life: 0.07 });
              if (ev.proj !== 'bullet') this.burst('smoke', ev.x + ev.dir * 8, ev.y, 4, { angle: ev.dir > 0 ? 0 : Math.PI, spread: 0.8, speed: 60, life: 0.8, size: 5, g: -30, colors: ['#bdb6ad', '#a39b92'] });
            } else if (ev.proj === 'plasma' || ev.proj === 'laser') {
              this.add({ kind: 'glow', x: ev.x, y: ev.y, size: 10, life: 0.12, color: S.TEAM[ev.team].glow });
            }
            break;
          }
          case 'impact':
            if (ev.splash > 0) this.explosion(ev.x, Math.min(ev.y + 10, GROUND_Y - 4), ev.splash);
            else if (ev.proj === 'stone' || ev.proj === 'rock') this.burst('dust', ev.x, ev.y + 8, 5, { speed: 60, life: 0.5, size: 4, g: 100, color: '#a08c70' });
            else if (ev.proj === 'plasma' || ev.proj === 'laser') this.burst('spark', ev.x, ev.y, 8, { speed: 160, life: 0.3, size: 2, g: 200, colors: [S.TEAM[ev.team].glow, '#ffffff'] });
            else this.burst('spark', ev.x, ev.y, 4, { speed: 120, life: 0.25, size: 1.6, g: 400, colors: ['#fff2b0', '#ffd25a'] });
            break;
          case 'melee': {
            const metal = ev.weapon === 'sword' || ev.weapon === 'sabre' || ev.weapon === 'spear' || ev.weapon === 'lance';
            if (ev.weapon === 'blade') this.burst('spark', ev.x, ev.y, 7, { speed: 150, life: 0.3, size: 2, g: 100, colors: [S.TEAM[ev.team].glow, '#ffffff'] });
            else if (metal) this.burst('spark', ev.x, ev.y, 5, { speed: 140, life: 0.25, size: 1.8, g: 500, colors: ['#ffffff', '#fff2b0'] });
            else this.burst('dust', ev.x, ev.y, 4, { speed: 70, life: 0.35, size: 3, g: 120, color: '#d9c3a0' });
            break;
          }
          case 'death': {
            const u = ev.unit;
            this.add({ kind: 'corpse', x: u.x, y: GROUND_Y + (u.lane || 0) * 2, unit: u, life: 1.0 });
            this.burst('dust', u.x, GROUND_Y - 4, 5, { angle: -Math.PI / 2, spread: 2.5, speed: 50, life: 0.6, size: 4, g: 40, color: '#b8a080' });
            this.text(u.x, GROUND_Y - (u.def.mount ? 80 : 58), '+' + ev.gold, '#ffd84a', 13);
            break;
          }
          case 'spawn':
            this.burst('dust', ev.x, GROUND_Y - 2, 5, { angle: -Math.PI / 2, spread: 2.5, speed: 40, life: 0.5, size: 4, g: 30, color: '#c8b394' });
            break;
          case 'evolve': {
            const x = ev.team === 0 ? 80 : W - 80;
            this.add({ kind: 'ring', x, y: GROUND_Y - 120, size: 260, life: 0.9, color: S.TEAM[ev.team].light });
            this.burst('spark', x, GROUND_Y - 140, 40, { speed: 260, life: 1.0, size: 3, g: 120, colors: [S.TEAM[ev.team].light, '#ffffff', '#ffd84a'] });
            this.add({ kind: 'banner', x: ev.team === 0 ? W * 0.28 : W * 0.72, y: 300, text: D.AGES[ev.age].name.toUpperCase(), color: S.TEAM[ev.team].light, life: 2.4 });
            this.flash = 0.5;
            this.flashColor = S.TEAM[ev.team].light;
            break;
          }
          case 'elite': {
            const x = ev.team === 0 ? 80 : W - 80;
            this.burst('spark', x, GROUND_Y - 140, 30, { speed: 220, life: 0.9, size: 3, g: 120, colors: ['#ffd84a', '#ffffff'] });
            this.add({ kind: 'banner', x: ev.team === 0 ? W * 0.28 : W * 0.72, y: 300, text: 'ELITE ' + 'I'.repeat(ev.level), color: '#ffd84a', life: 2 });
            break;
          }
          case 'strike':
            if (ev.kind === 'lightning') {
              this.flash = Math.max(this.flash, 0.25);
              this.flashColor = '#e8f0ff';
              this.burst('spark', ev.x, GROUND_Y - 6, 12, { angle: -Math.PI / 2, spread: 2.4, speed: 260, life: 0.4, size: 2.2, g: 600, colors: ['#ffffff', '#cfe0ff', '#ffe45c'] });
              this.add({ kind: 'scorch', x: ev.x, y: GROUND_Y + 2, size: 26, life: 2.5 });
              this.shake = Math.max(this.shake, 3);
            } else if (ev.kind === 'laser') {
              this.burst('spark', ev.x, ev.y, 10, { speed: 220, life: 0.4, size: 2.2, g: 300, colors: ['#ffffff', '#bfe8ff'] });
            } else {
              this.burst('dust', ev.x, GROUND_Y - 2, 2, { angle: -Math.PI / 2, spread: 1.5, speed: 40, life: 0.3, size: 2.5, g: 100, color: '#b8a080' });
            }
            break;
          case 'crush':
            this.burst('debris', ev.x, ev.y, 5, { angle: -Math.PI / 2, spread: 2, speed: 160, life: 0.7, size: 3, colors: ['#8f8a80', '#6f6a60'] });
            this.shake = Math.max(this.shake, 2);
            break;
          case 'sell':
            this.text(ev.x, ev.y - 20, '+' + ev.amount, '#ffd84a', 15);
            this.burst('debris', ev.x, ev.y, 8, { angle: -Math.PI / 2, spread: 2, speed: 120, life: 0.7, size: 3, colors: ['#7a5230', '#55595f'] });
            break;
          case 'build': {
            const pos = D.turretPos(ev.team, ev.slot);
            this.burst('dust', pos.x, pos.y, 8, { speed: 60, life: 0.6, size: 4, g: 40, color: '#e0d4bc' });
            break;
          }
          case 'win': {
            const col = S.TEAM[ev.team];
            for (let i = 0; i < 6; i++) {
              this.burst('spark', 200 + Math.random() * (W - 400), 200 + Math.random() * 150, 30, { speed: 220, life: 1.4, size: 3, g: 80, colors: [col.light, col.main, '#ffd84a', '#ffffff'] });
            }
            const loser = 1 - ev.team;
            const bx = loser === 0 ? 60 : W - 60;
            for (let i = 0; i < 5; i++) this.explosion(bx + (Math.random() - 0.5) * 100, GROUND_Y - Math.random() * 200, 40);
            break;
          }
        }
      }
    }

    // dt = Spielzeit (0 während der Pause), realDt = echte Zeit für reine Optik-Übergänge.
    update(dt, s, realDt) {
      this.time += dt;
      this.eraFade = Math.min(1, this.eraFade + (realDt != null ? realDt : dt) / 2.5);
      this.shake = Math.max(0, this.shake - dt * 18);
      this.flash = Math.max(0, this.flash - dt * 1.6);
      for (const c of this.clouds) {
        c.x += c.v * dt;
        if (c.x > W + 120) c.x = -120;
      }
      // Effekte erzeugen kontinuierlich Partikel (Staub hinter Felsen, Funken am Laser …)
      if (s) {
        for (const fx of s.effects) {
          if (fx.kind === 'boulders') {
            for (const b of fx.items) {
              if (fx.t >= b.delay && Math.random() < 0.6) this.add({ kind: 'dust', x: b.x - fx.dir * b.r, y: GROUND_Y - 4, vx: -fx.dir * 30, vy: -30, g: 30, life: 0.6, size: 5, color: '#b8a080' });
            }
          } else if (fx.kind === 'orbital' && fx.t >= fx.warm && Math.random() < 0.8) {
            this.add({ kind: 'spark', x: fx.beamX + (Math.random() - 0.5) * 30, y: GROUND_Y - 4, vx: (Math.random() - 0.5) * 200, vy: -150 - Math.random() * 150, g: 500, life: 0.5, size: 2.4, color: Math.random() < 0.5 ? '#ffffff' : S.TEAM[fx.team].glow });
          } else if (fx.kind === 'cannonade') {
            for (const b of fx.balls) if (!b.landed && Math.random() < 0.5) this.add({ kind: 'smoke', x: lerpBall(b).x, y: lerpBall(b).y, vx: 0, vy: -10, g: 0, life: 0.5, size: 4, color: '#9a938b' });
          }
        }
        for (const pr of s.projectiles) {
          if ((pr.type === 'rocket' || pr.type === 'firepot') && Math.random() < 0.7) {
            const p = projPos(pr);
            this.add({ kind: pr.type === 'rocket' ? 'smoke' : 'fire', x: p.x, y: p.y, vx: 0, vy: -12, g: 0, life: pr.type === 'rocket' ? 0.6 : 0.3, size: pr.type === 'rocket' ? 4 : 3.5, color: pr.type === 'rocket' ? '#c9c2b8' : '#ff9a2e' });
          }
        }
      }
      const keep = [];
      for (const p of this.particles) {
        p.life -= dt;
        if (p.life <= 0) continue;
        if (p.vx != null) {
          p.vy += (p.g || 0) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.kind === 'debris' && p.y > GROUND_Y + 4) {
            p.y = GROUND_Y + 4;
            p.vy *= -0.35;
            p.vx *= 0.6;
          }
          if (p.rot != null) p.rot += (p.vr || 0) * dt;
        }
        keep.push(p);
      }
      this.particles = keep;
    }

    drawBackground() {
      const ctx = this.ctx;
      ctx.drawImage(this.background(this.era), 0, 0);
      if (this.eraFade < 1) {
        ctx.globalAlpha = 1 - this.eraFade;
        ctx.drawImage(this.background(this.prevEra), 0, 0);
        ctx.globalAlpha = 1;
      }
      const e = ERA[this.era];
      ctx.fillStyle = e.cloud;
      for (const c of this.clouds) {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 50 * c.s, 14 * c.s, 0, 0, TAU);
        ctx.ellipse(c.x - 24 * c.s, c.y + 2, 30 * c.s, 11 * c.s, 0, 0, TAU);
        ctx.ellipse(c.x + 18 * c.s, c.y - 8 * c.s, 28 * c.s, 14 * c.s, 0, 0, TAU);
        ctx.fill();
      }
    }

    drawBases(s) {
      const ctx = this.ctx;
      for (const p of s.players) {
        ctx.save();
        if (p.team === 1) {
          ctx.translate(W, GROUND_Y);
          ctx.scale(-1, 1);
        } else ctx.translate(0, GROUND_Y);
        if (p.baseHp <= 0) {
          ctx.drawImage(this.ruin(p.age, p.team), -20, -330);
        } else {
          // Treffer lassen die Basis kurz wackeln
          if (p.baseHurt > 0 && !s.over) ctx.translate((Math.random() - 0.5) * 3, 0);
          S.drawBase(ctx, p.age, p.team, this.time + p.team);
        }
        ctx.restore();
        // Turmplätze
        for (let i = 0; i < p.turrets.length; i++) {
          const pos = D.turretPos(p.team, i);
          ctx.save();
          ctx.translate(pos.x, pos.y);
          if (p.team === 1) ctx.scale(-1, 1);
          S.drawMount(ctx, p.age, p.team);
          const t = p.turrets[i];
          if (t) {
            const local = p.team === 0 ? t.angle : Math.PI - t.angle;
            const a = local > Math.PI ? local - TAU : local;
            S.drawTurret(ctx, D.turretDef(t.age).kind, p.team, a, t.fire, t.age);
          }
          ctx.restore();
        }
        if (p.evolveFlash > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, p.evolveFlash) * 0.5;
          const x = p.team === 0 ? 60 : W - 60;
          const g = ctx.createRadialGradient(x, GROUND_Y - 120, 10, x, GROUND_Y - 120, 200);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 200, GROUND_Y - 320, 400, 320);
          ctx.restore();
        }
        // Lebensbalken der Basis
        if (this.showBaseBars === false) continue;
        const bw = 120;
        const bx = p.team === 0 ? 8 : W - 8 - bw;
        const by = GROUND_Y - 338;
        const r = p.baseHp / p.baseMaxHp;
        ctx.fillStyle = 'rgba(10,10,20,0.7)';
        S.rrect(ctx, bx - 2, by - 2, bw + 4, 12, 4);
        ctx.fill();
        ctx.fillStyle = r > 0.5 ? '#4ade80' : r > 0.25 ? '#facc15' : '#ef4444';
        S.rrect(ctx, bx, by, Math.max(0, bw * r), 8, 3);
        ctx.fill();
      }
    }

    drawUnits(s) {
      const ctx = this.ctx;
      const list = s.units.slice().sort((a, b) => a.lane - b.lane);
      for (const u of list) {
        const y = GROUND_Y + u.lane * 2;
        S.drawUnit(ctx, u, u.x, y);
      }
      for (const u of list) {
        if (u.hp >= u.maxHp) continue;
        const h = u.def.mount === 'mech' ? 86 : u.def.mount ? 72 : 56;
        const w = Math.min(36, 16 + u.def.w * 0.4);
        const r = Math.max(0, u.hp / u.maxHp);
        ctx.fillStyle = 'rgba(10,10,20,0.65)';
        ctx.fillRect(u.x - w / 2 - 1, GROUND_Y - h - 1, w + 2, 5);
        ctx.fillStyle = S.TEAM[u.team].light;
        ctx.fillRect(u.x - w / 2, GROUND_Y - h, w * r, 3);
      }
      for (const u of list) {
        if (!u.elite) continue;
        const h = u.def.mount === 'mech' ? 92 : u.def.mount ? 78 : 62;
        ctx.fillStyle = '#ffd84a';
        ctx.font = '700 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★'.repeat(Math.min(u.elite, 5)), u.x, GROUND_Y - h);
      }
    }

    drawProjectiles(s) {
      const ctx = this.ctx;
      for (const pr of s.projectiles) {
        const p = projPos(pr);
        const team = S.TEAM[pr.team];
        switch (pr.type) {
          case 'stone':
            S.circle(ctx, p.x, p.y, 2.6, '#9b968c', 1);
            break;
          case 'rock':
            S.circle(ctx, p.x, p.y, 5, '#8f8a80', 1.4);
            break;
          case 'arrow':
          case 'bolt': {
            const len = pr.type === 'arrow' ? 14 : 12;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.a);
            S.limb(ctx, -len, 0, 0, 0, pr.type === 'arrow' ? 1.2 : 2, '#8a6136');
            ctx.fillStyle = '#d9dde2';
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(-2, -2.5);
            ctx.lineTo(-2, 2.5);
            ctx.fill();
            ctx.fillStyle = '#f2f2f2';
            ctx.fillRect(-len, -2, 3, 4);
            ctx.restore();
            break;
          }
          case 'firepot':
            S.circle(ctx, p.x, p.y, 5, '#b3541e', 1.3);
            ctx.fillStyle = '#ffcf4a';
            ctx.beginPath();
            ctx.arc(p.x, p.y - 3, 3, 0, TAU);
            ctx.fill();
            break;
          case 'bullet': {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.a);
            ctx.fillStyle = 'rgba(255,240,170,0.95)';
            ctx.fillRect(-12, -1, 12, 2);
            ctx.restore();
            break;
          }
          case 'cannonball':
            S.circle(ctx, p.x, p.y, 4.2, '#26272b', 1.2);
            break;
          case 'shell':
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.a);
            ctx.fillStyle = 'rgba(255,220,150,0.5)';
            ctx.fillRect(-18, -1.2, 16, 2.4);
            S.rrect(ctx, -4, -2.4, 9, 4.8, 2);
            S.fillStroke(ctx, '#5b5e52', 1);
            ctx.restore();
            break;
          case 'rocket':
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.a);
            S.rrect(ctx, -6, -2, 11, 4, 2);
            S.fillStroke(ctx, '#55603a', 1);
            ctx.fillStyle = '#ffb02e';
            ctx.beginPath();
            ctx.moveTo(-6, -2);
            ctx.lineTo(-12 - Math.random() * 4, 0);
            ctx.lineTo(-6, 2);
            ctx.fill();
            ctx.restore();
            break;
          case 'plasma':
            ctx.save();
            ctx.shadowColor = team.glow;
            ctx.shadowBlur = 12;
            ctx.fillStyle = team.light;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 7, 3.5, p.a, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, TAU);
            ctx.fill();
            ctx.restore();
            break;
          case 'laser': {
            const f = 1 - pr.t / pr.T;
            ctx.save();
            ctx.globalAlpha = 0.4 + f * 0.6;
            ctx.shadowColor = team.glow;
            ctx.shadowBlur = 14;
            ctx.strokeStyle = team.glow;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(pr.sx, pr.sy);
            ctx.lineTo(pr.tx, pr.ty);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.restore();
            break;
          }
        }
      }
    }

    drawEffects(s) {
      const ctx = this.ctx;
      for (const fx of s.effects) {
        const team = S.TEAM[fx.team];
        switch (fx.kind) {
          case 'boulders':
            for (const b of fx.items) {
              if (fx.t < b.delay) continue;
              ctx.save();
              ctx.translate(b.x, GROUND_Y - b.r + 2);
              ctx.rotate(b.rot * fx.dir);
              S.circle(ctx, 0, 0, b.r, '#8f8a80', 2);
              ctx.strokeStyle = '#5f594f';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(0, 0, b.r * 0.55, 0.3, 2.2);
              ctx.moveTo(-b.r * 0.6, -b.r * 0.2);
              ctx.lineTo(b.r * 0.1, -b.r * 0.5);
              ctx.stroke();
              ctx.restore();
            }
            break;
          case 'lightning': {
            const dark = Math.min(1, fx.t * 3) * (fx.fired >= fx.def.count ? Math.max(0, 1 - (fx.t - fx.def.count * fx.def.interval) * 2) : 1);
            ctx.fillStyle = `rgba(20,24,40,${0.35 * dark})`;
            ctx.fillRect(0, 0, W, GROUND_Y);
            ctx.fillStyle = `rgba(60,64,80,${0.85 * dark})`;
            for (let i = 0; i < 10; i++) {
              ctx.beginPath();
              ctx.ellipse(i * 140 + 40, 160 + (i % 3) * 8, 110, 30, 0, 0, TAU);
              ctx.fill();
            }
            for (const st of fx.strikes) {
              if (st.t > 0.35) continue;
              drawBolt(ctx, st.x, 170, GROUND_Y, st.seed, 1 - st.t / 0.35);
            }
            break;
          }
          case 'arrows':
            for (const a of fx.items) {
              if (a.landed) {
                if (a.t > 0.6) continue;
                ctx.save();
                ctx.globalAlpha = 1 - a.t / 0.6;
                ctx.translate(a.tx, GROUND_Y - 2);
                ctx.rotate(fx.dir > 0 ? -2.2 : -0.94);
                S.limb(ctx, 0, 0, 14, 0, 1.2, '#8a6136');
                ctx.restore();
                continue;
              }
              const f = a.t / a.T;
              const x = a.sx + (a.tx - a.sx) * f;
              const y = 140 + (GROUND_Y - 140) * f * f;
              const ang = Math.atan2((GROUND_Y - 140) * 2 * f, a.tx - a.sx);
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(ang);
              S.limb(ctx, -14, 0, 0, 0, 1.2, '#8a6136');
              ctx.fillStyle = '#d9dde2';
              ctx.beginPath();
              ctx.moveTo(4, 0);
              ctx.lineTo(-2, -2.5);
              ctx.lineTo(-2, 2.5);
              ctx.fill();
              ctx.restore();
            }
            break;
          case 'cannonade':
            for (const b of fx.balls) {
              if (b.landed) continue;
              const p = lerpBall(b);
              S.circle(ctx, p.x, p.y, 6, '#26272b', 1.4);
            }
            break;
          case 'airstrike': {
            ctx.save();
            ctx.translate(fx.planeX, 205);
            ctx.scale(fx.dir, 1);
            S.drawPlane(ctx, fx.team, 0, 0, 1.25);
            ctx.restore();
            for (const b of fx.bombs) {
              if (b.landed) continue;
              ctx.save();
              ctx.translate(b.x, b.y);
              ctx.rotate(Math.atan2(b.vy, b.vx));
              S.rrect(ctx, -6, -3, 12, 6, 3);
              S.fillStroke(ctx, '#3b3f36', 1.2);
              ctx.restore();
            }
            break;
          }
          case 'orbital': {
            if (fx.t < fx.warm) {
              ctx.save();
              ctx.globalAlpha = 0.5 + Math.sin(fx.t * 60) * 0.3;
              ctx.strokeStyle = team.glow;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(fx.beamX, 140);
              ctx.lineTo(fx.beamX, GROUND_Y);
              ctx.stroke();
              ctx.restore();
              break;
            }
            const w = fx.def.width;
            ctx.save();
            const g = ctx.createLinearGradient(fx.beamX - w, 0, fx.beamX + w, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.3, team.glow);
            g.addColorStop(0.5, '#ffffff');
            g.addColorStop(0.7, team.glow);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = g;
            ctx.fillRect(fx.beamX - w, 0, w * 2, GROUND_Y);
            const rg = ctx.createRadialGradient(fx.beamX, GROUND_Y, 4, fx.beamX, GROUND_Y, 70);
            rg.addColorStop(0, '#ffffff');
            rg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = rg;
            ctx.fillRect(fx.beamX - 70, GROUND_Y - 70, 140, 90);
            ctx.restore();
            break;
          }
        }
      }
    }

    drawParticles() {
      const ctx = this.ctx;
      for (const p of this.particles) {
        const f = p.life / p.max;
        switch (p.kind) {
          case 'spark':
            ctx.globalAlpha = Math.min(1, f * 1.5);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            break;
          case 'dust':
          case 'smoke':
            ctx.globalAlpha = f * (p.kind === 'smoke' ? 0.55 : 0.6);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1.8 - f), 0, TAU);
            ctx.fill();
            break;
          case 'fire':
            ctx.globalAlpha = f;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.4 + f), 0, TAU);
            ctx.fill();
            break;
          case 'debris':
            ctx.globalAlpha = Math.min(1, f * 2);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
            ctx.restore();
            break;
          case 'flash': {
            ctx.globalAlpha = f;
            const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.size);
            g.addColorStop(0, 'rgba(255,255,230,1)');
            g.addColorStop(0.4, 'rgba(255,210,120,0.7)');
            g.addColorStop(1, 'rgba(255,150,60,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, TAU);
            ctx.fill();
            break;
          }
          case 'glow':
            ctx.globalAlpha = f;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * f, 0, TAU);
            ctx.fill();
            break;
          case 'ring':
            ctx.globalAlpha = f;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 - f) + 4, 0, TAU);
            ctx.stroke();
            break;
          case 'muzzle': {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff3b0';
            ctx.beginPath();
            const s = p.size;
            ctx.moveTo(p.x, p.y - s * 0.35);
            ctx.lineTo(p.x + p.dir * s, p.y);
            ctx.lineTo(p.x, p.y + s * 0.35);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffb02e';
            ctx.beginPath();
            ctx.arc(p.x, p.y, s * 0.35, 0, TAU);
            ctx.fill();
            break;
          }
          case 'scorch':
            ctx.globalAlpha = Math.min(1, f * 2) * 0.5;
            ctx.fillStyle = '#1b1612';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size, 4, 0, 0, TAU);
            ctx.fill();
            break;
          case 'corpse': {
            const t = 1 - f;
            const rot = Math.min(1, t / 0.35) * 1.35;
            ctx.globalAlpha = 1;
            S.drawUnit(ctx, p.unit, p.x, p.y + Math.min(1, t / 0.35) * 4, { alpha: Math.min(1, f * 2), rot: -rot });
            break;
          }
          case 'text':
            ctx.globalAlpha = Math.min(1, f * 2);
            ctx.font = `700 ${p.size}px "Russo One", "Trebuchet MS", sans-serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(20,16,10,0.8)';
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
            break;
          case 'banner': {
            const t = 1 - f;
            const sc = t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1;
            ctx.globalAlpha = Math.min(1, f * 3);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(sc, sc);
            ctx.font = '400 40px "Russo One", "Trebuchet MS", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(15,12,30,0.85)';
            ctx.strokeText(p.text, 0, 0);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, 0, 0);
            ctx.restore();
            break;
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    drawWorld(s) {
      const ctx = this.ctx;
      const era = Math.max(s.players[0].age, s.players[1].age);
      this.setEra(era);
      ctx.save();
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.drawBackground();
      this.drawBases(s);
      this.drawUnits(s);
      this.drawProjectiles(s);
      this.drawEffects(s);
      this.drawParticles();
      ctx.restore();
      if (this.flash > 0) {
        ctx.globalAlpha = this.flash * 0.5;
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }
  }

  function projPos(pr) {
    const f = Math.min(1, pr.t / pr.T);
    const x = pr.sx + (pr.tx - pr.sx) * f;
    const y = pr.sy + (pr.ty - pr.sy) * f - pr.arc * 4 * f * (1 - f);
    const dx = pr.tx - pr.sx;
    const dy = pr.ty - pr.sy - pr.arc * 4 * (1 - 2 * f);
    return { x, y, a: Math.atan2(dy, dx) };
  }

  function lerpBall(b) {
    const f = Math.min(1, b.t / b.T);
    return { x: b.sx + (b.tx - b.sx) * f, y: b.sy + (D.GROUND_Y - 8 - b.sy) * f - 220 * 4 * f * (1 - f) };
  }

  function drawBolt(ctx, x, y0, y1, seed, alpha) {
    const rnd = seeded(seed);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#bcd4ff';
    ctx.shadowBlur = 18;
    for (let pass = 0; pass < 2; pass++) {
      const r2 = seeded(seed);
      ctx.strokeStyle = pass ? '#ffffff' : '#9ec2ff';
      ctx.lineWidth = pass ? 2 : 6;
      ctx.beginPath();
      let cx = x + (r2() - 0.5) * 40;
      ctx.moveTo(cx, y0);
      for (let y = y0; y < y1; y += 22) {
        cx += (r2() - 0.5) * 34;
        cx = x + (cx - x) * 0.8;
        ctx.lineTo(cx, Math.min(y1, y + 22));
      }
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    // Verästelungen
    ctx.strokeStyle = '#cfe0ff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const sy = y0 + rnd() * (y1 - y0) * 0.7;
      let bx = x + (rnd() - 0.5) * 30;
      ctx.beginPath();
      ctx.moveTo(bx, sy);
      for (let k = 0; k < 4; k++) {
        bx += (rnd() - 0.3) * 30;
        ctx.lineTo(bx, sy + k * 16 + 16);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  EK.Renderer = Renderer;
  EK.render = { ERA, projPos };
})((globalThis.EK = globalThis.EK || {}));
