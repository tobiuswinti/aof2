// Bildschirme außerhalb des Kampfes: Hauptmenü, Steuerung, Pause, Spielende.
// Menüeinträge kommen als Liste von { id, label, kind } aus main.js:
//   kind 'big'   – normale Zeile
//   kind 'level' – Zeile mit großen ‹ ›-Flächen links/rechts (Tippen wechselt den Wert)
//   kind 'small' – kompakte Optionsknöpfe in einer gemeinsamen Zeile darunter
// Jeder Bildschirm passt sich in den sichtbaren Bereich area = { top, h } ein.
(function (EK) {
  'use strict';

  const D = EK.data;
  const S = EK.sprites;
  const { W, H } = D;
  const FONT = EK.hud.FONT;

  const ACTION_NAMES = ['Einheit 1 (Nahkampf)', 'Einheit 2 (Fernkampf)', 'Einheit 3 (schwer)', 'Spezialangriff', 'Turm kaufen', 'Turmplatz bauen', 'Ältesten Turm verkaufen', 'Zeitalter aufsteigen'];
  const P2_ALT = ['Num 7', 'Num 8', 'Num 9', 'Num +', 'Num 4', 'Num 5', 'Num 6', 'Num ↵'];
  const PAD_NAMES = ['A', 'X', 'Y', 'B', 'LB', 'RB', 'LT', 'RT'];
  const LEVEL_NAMES = { leicht: 'Leicht', normal: 'Normal', schwer: 'Schwer' };

  // Touch-Erklärung: jeweils ein Knopf und was er tut (Index = Aktion).
  const TOUCH_HELP = [
    ['Nahkämpfer', 'günstig, hält die Front'],
    ['Fernkämpfer', 'schießt über die eigenen Reihen'],
    ['Schwere Einheit', 'teuer, sehr robust'],
    ['Spezialangriff', 'lädt sich nach dem Einsatz neu auf'],
    ['Turm kaufen', 'braucht einen freien Turmplatz'],
    ['Turmplatz bauen', 'bis zu drei pro Basis'],
    ['Turm verkaufen', 'zweimal tippen: ältester Turm geht'],
    ['Zeitalter aufsteigen', 'sobald der XP-Balken voll ist'],
  ];

  const ROW_H = 56;
  const ROW_STEP = 66;
  const SMALL_H = 54;

  class UI {
    constructor(ctx) {
      this.ctx = ctx;
      this.rects = [];
      this.time = 0;
    }

    // Liefert { index, side } – side ist bei 'level'-Zeilen -1 (links) oder +1 (rechts).
    hit(x, y) {
      for (let i = 0; i < this.rects.length; i++) {
        const r = this.rects[i];
        if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          return { index: i, side: x < r.x + r.w / 2 ? -1 : 1 };
        }
      }
      return null;
    }

    dim(a) {
      const ctx = this.ctx;
      ctx.fillStyle = `rgba(8,9,20,${a})`;
      ctx.fillRect(0, 0, W, H);
    }

    title(text, y, size, color) {
      const ctx = this.ctx;
      ctx.font = `400 ${size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size / 6;
      ctx.strokeStyle = '#120f1f';
      ctx.strokeText(text, W / 2, y);
      const g = ctx.createLinearGradient(0, y - size, 0, y);
      g.addColorStop(0, color || '#ffe9a3');
      g.addColorStop(1, '#e8a33c');
      ctx.fillStyle = g;
      ctx.fillText(text, W / 2, y);
    }

    listHeight(items) {
      const big = items.filter((it) => it.kind !== 'small').length;
      const small = items.some((it) => it.kind === 'small');
      return big * ROW_STEP + (small ? SMALL_H + 10 : 0);
    }

    // Zeichnet die Einträge ab y0 und merkt sich ihre Flächen für hit().
    drawItems(items, sel, y0, w) {
      const ctx = this.ctx;
      this.rects = [];
      let y = y0;
      const smalls = items.filter((it) => it.kind === 'small');
      const sw = Math.min(190, (w - (smalls.length - 1) * 12) / Math.max(1, smalls.length));
      let sx = W / 2 - (smalls.length * sw + (smalls.length - 1) * 12) / 2;
      const sy = y0 + (items.length - smalls.length) * ROW_STEP;
      items.forEach((it, i) => {
        let r;
        if (it.kind === 'small') {
          r = { x: sx, y: sy, w: sw, h: SMALL_H };
          sx += sw + 12;
        } else {
          r = { x: W / 2 - w / 2, y, w, h: ROW_H };
          y += ROW_STEP;
        }
        this.rects.push(r);
        const active = i === sel;
        ctx.fillStyle = it.confirm ? 'rgba(190,40,48,0.92)' : active ? 'rgba(59,130,246,0.92)' : 'rgba(20,23,42,0.88)';
        S.rrect(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.fill();
        ctx.strokeStyle = active ? '#ffd84a' : '#3b415e';
        ctx.lineWidth = active ? 3 : 1.5;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f4f1e8';
        if (it.kind === 'level') {
          // Deutlich sichtbare Tippflächen für ‹ und ›
          for (const side of [-1, 1]) {
            const ax = side < 0 ? r.x + 6 : r.x + r.w - 6 - 84;
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            S.rrect(ctx, ax, r.y + 6, 84, r.h - 12, 9);
            ctx.fill();
            ctx.font = `400 34px ${FONT}`;
            ctx.fillStyle = '#ffd84a';
            ctx.fillText(side < 0 ? '‹' : '›', ax + 42, r.y + 40);
          }
          ctx.fillStyle = '#f4f1e8';
        }
        ctx.font = `400 ${it.kind === 'small' ? 18 : 22}px ${FONT}`;
        ctx.fillText(it.label, r.x + r.w / 2, r.y + r.h / 2 + 8);
      });
    }

    drawMenu(items, sel, area, opts) {
      this.time += 1 / 60;
      const ctx = this.ctx;
      this.dim(0.45);
      const listH = this.listHeight(items);
      const footH = opts.touch ? 34 : 60;
      const blockH = 70 + 36 + listH + footH;
      const y0 = area.top + Math.max(6, (area.h - blockH) / 2);
      const bob = Math.sin(this.time * 1.5) * 3;
      this.title('EPOCHENKRIEG', y0 + 62 + bob, 70);
      ctx.font = `400 19px ${FONT}`;
      ctx.fillStyle = '#e6e9f5';
      ctx.textAlign = 'center';
      ctx.fillText('Duell durch sechs Zeitalter – von der Steinzeit bis in die Zukunft', W / 2, y0 + 96);
      const ly = y0 + 112;
      this.drawItems(items, sel, ly, 560);
      ctx.font = `400 ${opts.touch ? 17 : 14}px ${FONT}`;
      ctx.fillStyle = 'rgba(230,233,245,0.8)';
      ctx.textAlign = 'center';
      if (opts.touch) {
        ctx.fillText('Tippe auf einen Eintrag · ‹ › ändert die KI-Stufe · Grafik und Musik entstehen im Browser', W / 2, ly + listH + 24);
      } else {
        ctx.fillText('Pfeiltasten + Enter, Maus/Touch oder Gamepad · M = Musik · ESC = Pause', W / 2, ly + listH + 24);
        ctx.fillText('Eigenständiges Spiel – Grafik und Musik werden im Browser erzeugt.', W / 2, ly + listH + 48);
      }
    }

    // Steuerung für Touch-Geräte: die echten Knöpfe mit kurzer Erklärung.
    drawTouchControls(items, sel, area, opts) {
      const ctx = this.ctx;
      this.dim(0.86);
      const blockH = 56 + 4 * 84 + 70 + ROW_STEP;
      const y0 = area.top + Math.max(6, (area.h - blockH) / 2);
      this.title('SO WIRD GESPIELT', y0 + 44, 40);
      const cols = [W / 2 - 560, W / 2 + 20];
      for (let i = 0; i < 8; i++) {
        const x = cols[i < 4 ? 0 : 1];
        const y = y0 + 64 + (i % 4) * 84;
        if (opts.drawButton) opts.drawButton(i, { x, y, w: 74, h: 74 });
        ctx.textAlign = 'left';
        ctx.font = `400 22px ${FONT}`;
        ctx.fillStyle = '#f4f1e8';
        ctx.fillText(TOUCH_HELP[i][0], x + 90, y + 32);
        ctx.font = `400 17px ${FONT}`;
        ctx.fillStyle = '#c9cde0';
        ctx.fillText(TOUCH_HELP[i][1], x + 90, y + 58);
      }
      ctx.textAlign = 'center';
      ctx.font = `400 17px ${FONT}`;
      ctx.fillStyle = '#e6e9f5';
      const ty = y0 + 64 + 4 * 84 + 12;
      ctx.fillText('Zu zweit: Spieler 1 hat die Knöpfe links unten, Spieler 2 rechts unten (gespiegelt).', W / 2, ty);
      ctx.fillText('Pause oben in der Mitte · kein Ton? Am iPhone den Stummschalter prüfen.', W / 2, ty + 26);
      this.drawItems(items, sel, ty + 46, 300);
    }

    drawControls(items, sel, area, opts) {
      if (opts.touch) return this.drawTouchControls(items, sel, area, opts);
      const ctx = this.ctx;
      this.dim(0.82);
      this.title('STEUERUNG', 90, 46);
      const cols = [
        { x: 120, team: 0, head: 'SPIELER 1 (links, blau)' },
        { x: 680, team: 1, head: 'SPIELER 2 (rechts, rot)' },
      ];
      for (const c of cols) {
        const T = S.TEAM[c.team];
        ctx.fillStyle = 'rgba(20,23,42,0.9)';
        S.rrect(ctx, c.x - 20, 120, 520, 420, 14);
        ctx.fill();
        ctx.strokeStyle = T.main;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = `400 20px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = T.light;
        ctx.fillText(c.head, c.x, 156);
        ctx.font = `400 12px ${FONT}`;
        ctx.fillStyle = '#9aa3c0';
        ctx.fillText('TASTE', c.x, 184);
        if (c.team === 1) ctx.fillText('ALTERNATIV', c.x + 64, 184);
        ctx.fillText('PAD', c.x + 160, 184);
        ctx.fillText('AKTION', c.x + 210, 184);
        for (let i = 0; i < 8; i++) {
          const y = 216 + i * 38;
          ctx.fillStyle = '#2a3050';
          S.rrect(ctx, c.x, y - 20, 34, 28, 6);
          ctx.fill();
          ctx.font = `400 15px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f4f1e8';
          ctx.fillText(EK.hud.KEY_LABELS[c.team][i], c.x + 17, y);
          ctx.textAlign = 'left';
          ctx.font = `400 13px ${FONT}`;
          ctx.fillStyle = '#c9cde0';
          if (c.team === 1) ctx.fillText(P2_ALT[i], c.x + 64, y);
          ctx.fillText(PAD_NAMES[i], c.x + 160, y);
          ctx.fillStyle = '#f4f1e8';
          ctx.fillText(ACTION_NAMES[i], c.x + 210, y);
        }
      }
      ctx.font = `400 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e6e9f5';
      ctx.fillText('Alle Knöpfe lassen sich auch mit Maus oder Touch bedienen – ideal für zwei Spieler an einem Tablet.', W / 2, 572);
      ctx.fillText('Gegen die KI: zusätzlich Zifferntasten 1–8.   ESC = Pause   M = Musik an/aus', W / 2, 596);
      this.drawItems(items, sel, 618, 260);
    }

    drawPause(items, sel, area) {
      this.dim(0.6);
      const listH = this.listHeight(items);
      const y0 = area.top + Math.max(8, (area.h - (76 + listH)) / 2);
      this.title('PAUSE', y0 + 58, 60);
      this.drawItems(items, sel, y0 + 76, 440);
    }

    drawOver(s, items, sel, area, opts) {
      const ctx = this.ctx;
      this.dim(0.55);
      const listH = this.listHeight(items);
      const y0 = area.top + Math.max(6, (area.h - (66 + 168 + 34 + listH)) / 2);
      const w = s.winner;
      const T = S.TEAM[w];
      this.title(`${opts.names[w]} GEWINNT!`, y0 + 52, 54, T.light);
      const ty = y0 + 66;
      ctx.fillStyle = 'rgba(20,23,42,0.9)';
      S.rrect(ctx, W / 2 - 320, ty, 640, 160, 14);
      ctx.fill();
      ctx.font = `400 17px ${FONT}`;
      ctx.textAlign = 'left';
      const rows = [
        ['', opts.names[0], opts.names[1]],
        ['Zeitalter', ...s.players.map((p) => D.AGES[p.age].name + (p.elite ? ` (Elite ${p.elite})` : ''))],
        ['Ausgebildet', ...s.players.map((p) => String(p.stats.unitsTrained))],
        ['Besiegt', ...s.players.map((p) => String(p.stats.kills))],
        ['Beute (Gold)', ...s.players.map((p) => EK.hud.fmt(p.stats.goldEarned))],
      ];
      rows.forEach((r, i) => {
        const y = ty + 30 + i * 29;
        ctx.fillStyle = '#9aa3c0';
        ctx.fillText(r[0], W / 2 - 296, y);
        ctx.fillStyle = i === 0 ? S.TEAM[0].light : '#f4f1e8';
        ctx.fillText(r[1], W / 2 - 120, y);
        ctx.fillStyle = i === 0 ? S.TEAM[1].light : '#f4f1e8';
        ctx.fillText(r[2], W / 2 + 110, y);
      });
      const t = Math.floor(s.time);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9cde0';
      ctx.fillText(`Spieldauer ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, W / 2, ty + 186);
      this.drawItems(items, sel, ty + 204, 380);
    }
  }

  EK.UI = UI;
  EK.ui = { LEVEL_NAMES };
})((globalThis.EK = globalThis.EK || {}));
