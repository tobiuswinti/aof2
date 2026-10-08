// Bildschirme außerhalb des Kampfes: Hauptmenü, Steuerung, Pause, Spielende.
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

  class UI {
    constructor(ctx) {
      this.ctx = ctx;
      this.items = [];
      this.time = 0;
    }

    hit(x, y) {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.items[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
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

    menuList(labels, sel, y0, w) {
      const ctx = this.ctx;
      this.items = [];
      labels.forEach((label, i) => {
        const r = { x: W / 2 - w / 2, y: y0 + i * 68, w, h: 58 };
        this.items.push(r);
        const active = i === sel;
        ctx.fillStyle = active ? 'rgba(59,130,246,0.9)' : 'rgba(20,23,42,0.85)';
        S.rrect(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.fill();
        ctx.strokeStyle = active ? '#ffd84a' : '#3b415e';
        ctx.lineWidth = active ? 3 : 1.5;
        ctx.stroke();
        ctx.font = `400 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f4f1e8';
        ctx.fillText(label, W / 2, r.y + 37);
      });
    }

    drawMenu(sel, opts) {
      this.time += 1 / 60;
      this.dim(0.45);
      const bob = Math.sin(this.time * 1.5) * 3;
      this.title('EPOCHENKRIEG', 190 + bob, 76);
      const ctx = this.ctx;
      ctx.font = `400 18px ${FONT}`;
      ctx.fillStyle = '#e6e9f5';
      ctx.textAlign = 'center';
      ctx.fillText('Duell durch sechs Zeitalter – von der Steinzeit bis in die Zukunft', W / 2, 232);
      this.menuList(
        ['2 SPIELER · LOKAL', `1 SPIELER · GEGEN KI  ‹ ${LEVEL_NAMES[opts.level]} ›`, 'STEUERUNG', `MUSIK: ${opts.musicOn ? 'AN' : 'AUS'}`],
        sel,
        268,
        520
      );
      ctx.font = `400 ${opts.touch ? 15 : 13}px ${FONT}`;
      ctx.fillStyle = 'rgba(230,233,245,0.75)';
      const hint = opts.touch
        ? 'Tippe auf einen Eintrag · ‹ › wechselt die KI-Stufe'
        : 'Pfeiltasten + Enter, Maus/Touch oder Gamepad · M = Musik · ESC = Pause';
      ctx.fillText(hint, W / 2, 568);
      ctx.fillText('Eigenständiges Spiel – Grafik und Musik werden im Browser erzeugt.', W / 2, 592);
    }

    // Steuerung für Touch-Geräte: Was die Knöpfe unten am Bildschirmrand tun.
    drawTouchControls() {
      const ctx = this.ctx;
      this.dim(0.84);
      this.title('SO WIRD GESPIELT', 84, 42);
      const rows = [
        ['1 · 2 · 3', 'Einheiten ausbilden: Nahkampf, Fernkampf, schwer. Die Zahl am Knopf zeigt die Warteschlange.'],
        ['4', 'Spezialangriff – lädt sich nach jedem Einsatz wieder auf.'],
        ['5', 'Turm kaufen (braucht einen freien Turmplatz).'],
        ['6', 'Neuen Turmplatz an der Basis bauen (bis zu drei).'],
        ['7', 'Ältesten Turm verkaufen – Platz frei für einen besseren.'],
        ['8', 'Ins nächste Zeitalter aufsteigen, sobald der XP-Balken voll ist.'],
      ];
      ctx.fillStyle = 'rgba(20,23,42,0.92)';
      S.rrect(ctx, 150, 112, 980, 380, 16);
      ctx.fill();
      rows.forEach((r, i) => {
        const y = 160 + i * 54;
        ctx.textAlign = 'center';
        ctx.font = `400 20px ${FONT}`;
        ctx.fillStyle = '#ffd84a';
        ctx.fillText(r[0], 260, y);
        ctx.textAlign = 'left';
        ctx.font = `400 18px ${FONT}`;
        ctx.fillStyle = '#f4f1e8';
        ctx.fillText(r[1], 350, y);
      });
      ctx.textAlign = 'center';
      ctx.font = `400 17px ${FONT}`;
      ctx.fillStyle = '#c9cde0';
      ctx.fillText('Knöpfe von links nach rechts gezählt. Zu zweit: Spieler 1 links unten, Spieler 2 rechts unten.', W / 2, 528);
      ctx.fillText('Pause oben in der Mitte. Wer zuerst die gegnerische Basis zerstört, gewinnt.', W / 2, 556);
      this.items = [];
      this.menuList(['ZURÜCK'], 0, 590, 300);
    }

    drawControls(opts) {
      if (opts && opts.touch) return this.drawTouchControls();
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
      ctx.fillText('Alle Knöpfe lassen sich auch mit Maus oder Touch bedienen – ideal für zwei Spieler an einem Tablet.', W / 2, 580);
      ctx.fillText('Gegen die KI: zusätzlich Zifferntasten 1–8.   ESC = Pause   M = Musik an/aus', W / 2, 604);
      this.items = [];
      this.menuList(['ZURÜCK'], 0, 632, 260);
    }

    drawPause(sel) {
      this.dim(0.6);
      this.title('PAUSE', 250, 64);
      this.menuList(['WEITER', 'NEU STARTEN', 'STEUERUNG', 'HAUPTMENÜ'], sel, 290, 400);
    }

    drawOver(s, sel, opts) {
      const ctx = this.ctx;
      this.dim(0.55);
      const w = s.winner;
      const T = S.TEAM[w];
      this.title(`${opts.names[w]} GEWINNT!`, 230, 58, T.light);
      ctx.fillStyle = 'rgba(20,23,42,0.9)';
      S.rrect(ctx, W / 2 - 300, 262, 600, 150, 14);
      ctx.fill();
      ctx.font = `400 15px ${FONT}`;
      ctx.textAlign = 'left';
      const rows = [
        ['', opts.names[0], opts.names[1]],
        ['Zeitalter', ...s.players.map((p) => D.AGES[p.age].name + (p.elite ? ` (Elite ${p.elite})` : ''))],
        ['Ausgebildet', ...s.players.map((p) => String(p.stats.unitsTrained))],
        ['Besiegt', ...s.players.map((p) => String(p.stats.kills))],
        ['Beute (Gold)', ...s.players.map((p) => EK.hud.fmt(p.stats.goldEarned))],
      ];
      rows.forEach((r, i) => {
        const y = 290 + i * 26;
        ctx.fillStyle = '#9aa3c0';
        ctx.fillText(r[0], W / 2 - 280, y);
        ctx.fillStyle = i === 0 ? S.TEAM[0].light : '#f4f1e8';
        ctx.fillText(r[1], W / 2 - 120, y);
        ctx.fillStyle = i === 0 ? S.TEAM[1].light : '#f4f1e8';
        ctx.fillText(r[2], W / 2 + 100, y);
      });
      const t = Math.floor(s.time);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9cde0';
      ctx.fillText(`Spieldauer ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, W / 2, 436);
      this.menuList(['REVANCHE', 'HAUPTMENÜ'], sel, 452, 360);
    }
  }

  EK.UI = UI;
  EK.ui = { LEVEL_NAMES };
})((globalThis.EK = globalThis.EK || {}));
