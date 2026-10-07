// HUD: zwei Spieler-Panels mit klick-/tippbaren Knöpfen, Mittelspalte mit Zeit und Optionen.
(function (EK) {
  'use strict';

  const D = EK.data;
  const S = EK.sprites;
  const { W } = D;
  const FONT = '"Russo One", "Trebuchet MS", Arial, sans-serif';

  const PANEL_W = 556;
  const PANEL_H = 132;
  const BTN = 60;
  const GAP = 8;
  const ACTIONS = EK.sim.ACTIONS;

  const KEY_LABELS = [
    ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'],
    ['U', 'I', 'O', 'P', 'J', 'K', 'L', 'Ö'],
  ];

  function fmt(n) {
    n = Math.floor(n);
    if (n < 100000) return n.toLocaleString('de-DE');
    if (n < 1e6) return Math.floor(n / 1000) + 'k';
    return (n / 1e6).toFixed(1).replace('.', ',') + 'M';
  }

  function panelX(team) {
    return team === 0 ? 10 : W - 10 - PANEL_W;
  }

  function buttonRect(team, i) {
    return { x: panelX(team) + 12 + i * (BTN + GAP), y: 10 + 36, w: BTN, h: BTN };
  }

  const UI_BTNS = [
    { id: 'pause', x: W / 2 - 64, y: 64, w: 38, h: 34 },
    { id: 'music', x: W / 2 - 19, y: 64, w: 38, h: 34 },
    { id: 'full', x: W / 2 + 26, y: 64, w: 38, h: 34 },
  ];

  function inRect(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function coin(ctx, x, y, r) {
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(x - r * 0.18, y - r * 0.45, r * 0.3, r * 0.8);
  }

  class HUD {
    constructor(ctx) {
      this.ctx = ctx;
      this.flashes = [{}, {}];
      this.hover = null;
      this.time = 0;
    }

    press(team, action) {
      this.flashes[team][action] = 0.18;
    }

    hit(x, y) {
      for (const b of UI_BTNS) if (inRect(b, x, y)) return { kind: 'ui', id: b.id };
      for (let team = 0; team < 2; team++) {
        for (let i = 0; i < ACTIONS.length; i++) {
          if (inRect(buttonRect(team, i), x, y)) return { kind: 'action', team, action: ACTIONS[i] };
        }
      }
      return null;
    }

    update(dt) {
      this.time += dt;
      for (const f of this.flashes) for (const k in f) f[k] = Math.max(0, f[k] - dt);
    }

    draw(s, opts) {
      const ctx = this.ctx;
      for (let team = 0; team < 2; team++) this.drawPanel(s, team, opts);
      // Mittelspalte
      const t = Math.floor(s.time);
      const txt = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(14,16,30,0.78)';
      S.rrect(ctx, W / 2 - 70, 10, 140, 96, 12);
      ctx.fill();
      ctx.font = `400 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f4f1e8';
      ctx.fillText(txt, W / 2, 44);
      ctx.font = `400 11px ${FONT}`;
      ctx.fillStyle = '#9aa3c0';
      ctx.fillText('ESC = PAUSE', W / 2, 58);
      for (const b of UI_BTNS) {
        const hover = this.hover && this.hover.kind === 'ui' && this.hover.id === b.id;
        ctx.fillStyle = hover ? '#343a5c' : '#232842';
        S.rrect(ctx, b.x, b.y, b.w, b.h, 8);
        ctx.fill();
        ctx.strokeStyle = '#4b5378';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        this.drawUiIcon(b, opts);
      }
      if (opts.tooltips && this.hover && this.hover.kind === 'action') this.drawTooltip(s, this.hover.team, this.hover.action);
    }

    drawUiIcon(b, opts) {
      const ctx = this.ctx;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.fillStyle = '#e6e9f5';
      ctx.strokeStyle = '#e6e9f5';
      ctx.lineWidth = 2;
      if (b.id === 'pause') {
        ctx.fillRect(cx - 6, cy - 8, 4, 16);
        ctx.fillRect(cx + 2, cy - 8, 4, 16);
      } else if (b.id === 'music') {
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy + 6);
        ctx.lineTo(cx - 3, cy - 8);
        ctx.lineTo(cx + 7, cy - 10);
        ctx.lineTo(cx + 7, cy + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx - 6, cy + 6, 3.6, 2.8, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 4, cy + 4, 3.6, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (!opts.musicOn) {
          ctx.strokeStyle = '#ff6b6f';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(cx - 11, cy - 11);
          ctx.lineTo(cx + 11, cy + 11);
          ctx.stroke();
        }
      } else if (b.id === 'full') {
        const d = 8;
        ctx.beginPath();
        ctx.moveTo(cx - d, cy - 3);
        ctx.lineTo(cx - d, cy - d);
        ctx.lineTo(cx - 3, cy - d);
        ctx.moveTo(cx + 3, cy - d);
        ctx.lineTo(cx + d, cy - d);
        ctx.lineTo(cx + d, cy - 3);
        ctx.moveTo(cx + d, cy + 3);
        ctx.lineTo(cx + d, cy + d);
        ctx.lineTo(cx + 3, cy + d);
        ctx.moveTo(cx - 3, cy + d);
        ctx.lineTo(cx - d, cy + d);
        ctx.lineTo(cx - d, cy + 3);
        ctx.stroke();
      }
    }

    drawPanel(s, team, opts) {
      const ctx = this.ctx;
      const p = s.players[team];
      const T = S.TEAM[team];
      const x0 = panelX(team);
      const y0 = 10;
      ctx.fillStyle = 'rgba(14,16,30,0.8)';
      S.rrect(ctx, x0, y0, PANEL_W, PANEL_H, 12);
      ctx.fill();
      ctx.strokeStyle = T.main;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Kopfzeile
      ctx.textAlign = 'left';
      ctx.font = `400 16px ${FONT}`;
      ctx.fillStyle = T.light;
      const name = opts.names[team];
      ctx.fillText(name, x0 + 14, y0 + 25);
      const nw = ctx.measureText(name).width;
      ctx.fillStyle = '#c9cde0';
      ctx.font = `400 13px ${FONT}`;
      let ageTxt = D.AGES[p.age].name;
      if (p.elite) ageTxt += ' · Elite ' + p.elite;
      ctx.fillText(ageTxt, x0 + 22 + nw, y0 + 25);

      coin(ctx, x0 + 300, y0 + 20, 8);
      ctx.font = `400 17px ${FONT}`;
      ctx.fillStyle = '#ffd84a';
      ctx.fillText(fmt(p.gold), x0 + 313, y0 + 26);

      // XP-Balken
      const ev = EK.sim.actionInfo(s, team, 'evolve');
      const bx = x0 + 400;
      const bw = 142;
      ctx.fillStyle = '#2a2f4a';
      S.rrect(ctx, bx, y0 + 12, bw, 16, 6);
      ctx.fill();
      ctx.fillStyle = ev.ready ? '#ffd84a' : '#a78bfa';
      S.rrect(ctx, bx, y0 + 12, Math.max(6, bw * ev.progress), 16, 6);
      ctx.fill();
      ctx.font = `400 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#10121f';
      const need = D.AGES[p.age].xpNext || (ev.max ? 0 : D.AGES[p.age].xpElite);
      ctx.fillText(need ? `XP ${fmt(p.xp)} / ${fmt(need)}` : `XP ${fmt(p.xp)}`, bx + bw / 2, y0 + 24);

      // Knöpfe
      for (let i = 0; i < ACTIONS.length; i++) this.drawButton(s, team, i, opts);

      // Ausbildungs-Warteschlange
      const qy = y0 + 106;
      ctx.textAlign = 'left';
      ctx.font = `400 10px ${FONT}`;
      ctx.fillStyle = '#9aa3c0';
      ctx.fillText('AUSBILDUNG', x0 + 14, qy + 13);
      for (let i = 0; i < D.RULES.queueMax; i++) {
        const qx = x0 + 92 + i * 24;
        ctx.fillStyle = '#232842';
        S.rrect(ctx, qx, qy, 20, 18, 4);
        ctx.fill();
        const q = p.queue[i];
        if (!q) continue;
        if (i === 0) {
          ctx.fillStyle = T.dark;
          S.rrect(ctx, qx, qy, 20 * Math.min(1, q.t / q.def.train), 18, 4);
          ctx.fill();
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(qx, qy, 20, 18);
        ctx.clip();
        S.drawUnitIcon(ctx, q.def, team, qx + 10, qy + 17, q.def.mount ? 0.2 : 0.3);
        ctx.restore();
      }
      // Basis-LP
      const hx = x0 + 228;
      const hw = 314;
      const r = p.baseHp / p.baseMaxHp;
      ctx.fillStyle = '#9aa3c0';
      ctx.fillText('BASIS', hx, qy + 13);
      ctx.fillStyle = '#2a2f4a';
      S.rrect(ctx, hx + 44, qy + 2, hw - 44, 14, 5);
      ctx.fill();
      ctx.fillStyle = r > 0.5 ? '#4ade80' : r > 0.25 ? '#facc15' : '#ef4444';
      S.rrect(ctx, hx + 44, qy + 2, Math.max(4, (hw - 44) * r), 14, 5);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#10121f';
      ctx.fillText(`${fmt(p.baseHp)} / ${fmt(p.baseMaxHp)}`, hx + 44 + (hw - 44) / 2, qy + 13);
    }

    drawButton(s, team, i, opts) {
      const ctx = this.ctx;
      const p = s.players[team];
      const T = S.TEAM[team];
      const action = ACTIONS[i];
      const info = EK.sim.actionInfo(s, team, action);
      const r = buttonRect(team, i);
      const hover = this.hover && this.hover.kind === 'action' && this.hover.team === team && this.hover.action === action;

      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, hover ? '#3a4166' : '#2a3050');
      g.addColorStop(1, '#171b30');
      ctx.fillStyle = g;
      S.rrect(ctx, r.x, r.y, r.w, r.h, 9);
      ctx.fill();
      const pulse = info.ready ? 0.5 + Math.sin(this.time * 6) * 0.5 : 0;
      ctx.lineWidth = info.ready ? 2 + pulse * 1.5 : 1.5;
      ctx.strokeStyle = info.ready ? '#ffd84a' : info.enabled ? T.main : '#3b415e';
      ctx.stroke();

      ctx.save();
      S.rrect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 8);
      ctx.clip();
      const cx = r.x + r.w / 2;
      switch (action) {
        case 'unit0':
        case 'unit1':
        case 'unit2': {
          const def = info.def;
          const sc = def.mount === 'mech' ? 0.48 : def.mount ? 0.56 : 0.72;
          S.drawUnitIcon(ctx, def, team, cx + (def.mount ? 2 : -1), r.y + 46, sc);
          break;
        }
        case 'special':
          S.drawSpecialIcon(ctx, info.kind, team, cx, r.y + 26, 1.05);
          if (!info.enabled) {
            ctx.fillStyle = 'rgba(8,10,20,0.6)';
            ctx.beginPath();
            ctx.moveTo(cx, r.y + 26);
            ctx.arc(cx, r.y + 26, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - info.progress));
            ctx.closePath();
            ctx.fill();
          }
          break;
        case 'turret': {
          ctx.save();
          ctx.translate(cx, r.y + 40);
          ctx.scale(0.9, 0.9);
          S.drawTurret(ctx, info.def.kind, team, -0.25, 0, p.age);
          ctx.restore();
          break;
        }
        case 'slot':
          ctx.save();
          ctx.translate(cx + 4, r.y + 30);
          ctx.scale(0.75, 0.75);
          S.drawMount(ctx, p.age, team);
          ctx.restore();
          ctx.font = `400 22px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e6e9f5';
          ctx.fillText('+', cx + 4, r.y + 26);
          break;
        case 'sell':
          coin(ctx, cx - 6, r.y + 26, 11);
          ctx.strokeStyle = '#e6e9f5';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx + 6, r.y + 32);
          ctx.lineTo(cx + 16, r.y + 18);
          ctx.moveTo(cx + 9, r.y + 18);
          ctx.lineTo(cx + 16, r.y + 18);
          ctx.lineTo(cx + 16, r.y + 25);
          ctx.stroke();
          break;
        case 'evolve': {
          ctx.fillStyle = 'rgba(167,139,250,0.35)';
          ctx.fillRect(r.x, r.y + r.h * (1 - info.progress), r.w, r.h * info.progress);
          ctx.fillStyle = info.ready ? '#ffd84a' : '#e6e9f5';
          ctx.beginPath();
          const ay = r.y + 14;
          ctx.moveTo(cx, ay);
          ctx.lineTo(cx + 14, ay + 15);
          ctx.lineTo(cx + 6, ay + 15);
          ctx.lineTo(cx + 6, ay + 28);
          ctx.lineTo(cx - 6, ay + 28);
          ctx.lineTo(cx - 6, ay + 15);
          ctx.lineTo(cx - 14, ay + 15);
          ctx.closePath();
          ctx.fill();
          if (info.elite) {
            ctx.font = `400 10px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd84a';
            ctx.fillText('★', cx, ay + 25);
          }
          break;
        }
      }
      ctx.restore();

      if (!info.enabled && !info.ready) {
        ctx.fillStyle = 'rgba(8,10,20,0.45)';
        S.rrect(ctx, r.x, r.y, r.w, r.h, 9);
        ctx.fill();
      }
      const fl = this.flashes[team][action];
      if (fl > 0) {
        ctx.fillStyle = `rgba(255,255,255,${fl * 2.5})`;
        S.rrect(ctx, r.x, r.y, r.w, r.h, 9);
        ctx.fill();
      }

      // Taste
      if (opts.showKeys[team]) {
        ctx.fillStyle = 'rgba(8,10,20,0.85)';
        S.rrect(ctx, r.x + 3, r.y + 3, 16, 15, 4);
        ctx.fill();
        ctx.font = `400 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e6e9f5';
        ctx.fillText(KEY_LABELS[team][i], r.x + 11, r.y + 14.5);
      }

      // Unterzeile: Kosten / Abklingzeit / Status
      ctx.font = `400 11px ${FONT}`;
      ctx.textAlign = 'center';
      let label = '';
      let col = '#ffd84a';
      switch (action) {
        case 'special':
          label = info.enabled ? 'BEREIT' : Math.ceil(info.cooldown) + 's';
          col = info.enabled ? '#ffd84a' : '#c9cde0';
          break;
        case 'slot':
          label = info.max ? 'MAX' : fmt(info.cost);
          if (info.max) col = '#c9cde0';
          break;
        case 'sell':
          label = info.enabled ? '+' + fmt(info.cost) : '—';
          col = info.enabled ? '#86efac' : '#c9cde0';
          break;
        case 'evolve':
          label = info.max ? 'MAX' : info.ready ? 'BEREIT' : Math.floor(info.progress * 100) + '%';
          col = info.ready ? '#ffd84a' : '#c9cde0';
          break;
        case 'turret':
          label = info.full ? 'VOLL' : fmt(info.cost);
          if (info.full) col = '#c9cde0';
          break;
        default:
          label = fmt(info.cost);
      }
      ctx.fillStyle = 'rgba(8,10,20,0.7)';
      ctx.fillRect(r.x + 4, r.y + r.h - 15, r.w - 8, 12);
      ctx.fillStyle = col;
      ctx.fillText(label, cx, r.y + r.h - 5);
    }

    drawTooltip(s, team, action) {
      const ctx = this.ctx;
      const info = EK.sim.actionInfo(s, team, action);
      let text = info.label;
      if (info.def && info.def.hp) {
        const d = info.def;
        text += ` · ${fmt(d.cost)} Gold · LP ${fmt(d.hp)} · Schaden ${fmt(d.dmg)} · Reichweite ${d.range}`;
      } else if (info.def && info.def.dmg) {
        text += ` · ${fmt(info.def.cost)} Gold · Schaden ${fmt(info.def.dmg)} · Reichweite ${info.def.range}`;
      } else if (action === 'special') {
        text = 'Spezialangriff: ' + info.label;
      } else if (action === 'slot') {
        text = info.max ? 'Alle Turmplätze gebaut' : `Neuer Turmplatz · ${fmt(info.cost)} Gold`;
      } else if (action === 'sell') {
        text = info.enabled ? `Ältesten Turm verkaufen (+${fmt(info.cost)} Gold)` : 'Kein Turm zum Verkaufen';
      }
      ctx.font = `400 13px ${FONT}`;
      const w = ctx.measureText(text).width + 24;
      const x = Math.max(10, Math.min(W - 10 - w, panelX(team) + (team === 0 ? 0 : PANEL_W - w)));
      const y = 10 + PANEL_H + 8;
      ctx.fillStyle = 'rgba(14,16,30,0.92)';
      S.rrect(ctx, x, y, w, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#f4f1e8';
      ctx.textAlign = 'left';
      ctx.fillText(text, x + 12, y + 18);
    }
  }

  EK.HUD = HUD;
  EK.hud = { FONT, KEY_LABELS, fmt, coin };
})((globalThis.EK = globalThis.EK || {}));
