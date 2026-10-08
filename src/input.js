// Eingabe: Tastatur (zwei Spieler an einer Tastatur), Maus/Touch und Gamepads.
// Verwendet event.code (physische Taste), damit QWERTZ und QWERTY gleich funktionieren.
(function (EK) {
  'use strict';

  const ACTIONS = EK.sim.ACTIONS;

  const KEYS = {
    KeyQ: [0, 'unit0'],
    KeyW: [0, 'unit1'],
    KeyE: [0, 'unit2'],
    KeyR: [0, 'special'],
    KeyA: [0, 'turret'],
    KeyS: [0, 'slot'],
    KeyD: [0, 'sell'],
    KeyF: [0, 'evolve'],
    KeyU: [1, 'unit0'],
    KeyI: [1, 'unit1'],
    KeyO: [1, 'unit2'],
    KeyP: [1, 'special'],
    KeyJ: [1, 'turret'],
    KeyK: [1, 'slot'],
    KeyL: [1, 'sell'],
    Semicolon: [1, 'evolve'],
    // Alternative für Spieler 2 auf dem Nummernblock
    Numpad7: [1, 'unit0'],
    Numpad8: [1, 'unit1'],
    Numpad9: [1, 'unit2'],
    NumpadAdd: [1, 'special'],
    Numpad4: [1, 'turret'],
    Numpad5: [1, 'slot'],
    Numpad6: [1, 'sell'],
    NumpadEnter: [1, 'evolve'],
  };

  // Ziffern 1–8: nur im Einzelspielermodus für den menschlichen Spieler.
  const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];

  // Standard-Gamepad-Belegung
  const PAD = { 0: 'unit0', 2: 'unit1', 3: 'unit2', 1: 'special', 4: 'turret', 5: 'slot', 6: 'sell', 7: 'evolve' };

  class Input {
    constructor(canvas, handler) {
      this.canvas = canvas;
      this.h = handler;
      this.pads = [];
      this.toLogical = (x, y) => ({ x, y });
      window.addEventListener('keydown', (e) => this.onKey(e));
      canvas.tabIndex = 0;
      canvas.addEventListener('pointerdown', (e) => this.onPointer(e, 'down'));
      canvas.addEventListener('pointermove', (e) => this.onPointer(e, 'move'));
      canvas.addEventListener('pointerup', (e) => this.onPointer(e, 'up'));
      canvas.addEventListener('pointerleave', () => this.h.hover(null));
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      // iOS schaltet WebAudio teils erst bei touchend/click frei; Zoom-Gesten unterbinden.
      for (const ev of ['touchend', 'click']) window.addEventListener(ev, () => this.safeUnlock(), { passive: true });
      for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('touchstart', (e) => e.cancelable && e.preventDefault(), { passive: false });
    }

    // Audio-Freischaltung darf nie die eigentliche Eingabe verhindern.
    safeUnlock() {
      try {
        this.h.unlock();
      } catch (e) {
        /* ignorieren */
      }
    }

    onKey(e) {
      if (e.repeat) return;
      this.safeUnlock();
      if (this.h.keyboard) this.h.keyboard();
      const code = e.code;
      if (code === 'Escape') {
        this.h.ui('escape');
        e.preventDefault();
        return;
      }
      if (code === 'KeyM') {
        this.h.ui('music');
        return;
      }
      if (code === 'Enter' || code === 'Space') {
        if (this.h.ui(code === 'Enter' ? 'enter' : 'space')) {
          e.preventDefault();
          return;
        }
      }
      if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
        if (this.h.ui(code)) {
          e.preventDefault();
          return;
        }
      }
      const d = DIGITS.indexOf(code);
      if (d !== -1) {
        this.h.action(-1, ACTIONS[d]);
        return;
      }
      const m = KEYS[code];
      if (m) {
        e.preventDefault();
        this.h.action(m[0], m[1]);
      }
    }

    // phase: 'down' (Spielknöpfe reagieren sofort), 'up' (Menüs – erst beim Loslassen,
    // das gilt auch als Nutzeraktivierung für Vollbild auf Touch-Geräten), 'move' (Hover).
    onPointer(e, phase) {
      // Erst den Gerätetyp melden: Schaltet das das Layout um (erster Fingertipp auf einem
      // Touch-Laptop), zielte der Nutzer auf das alte Bild – dieser Tipp löst dann nichts aus.
      const switched = this.h.pointer && phase !== 'up' ? this.h.pointer(e.pointerType) : false;
      const rect = this.canvas.getBoundingClientRect();
      const p = this.toLogical(e.clientX - rect.left, e.clientY - rect.top);
      if (phase === 'down') {
        this.safeUnlock();
        e.preventDefault();
        // preventDefault verhindert den automatischen Fokus – ohne Fokus kämen im
        // eingebetteten Rahmen keine Tastatureingaben an.
        try {
          this.canvas.focus({ preventScroll: true });
        } catch (err) {
          /* ignorieren */
        }
        if (!switched) this.h.click(p.x, p.y, e.pointerType, e.pointerId);
      } else if (phase === 'up') {
        if (this.h.release) this.h.release(p.x, p.y, e.pointerType, e.pointerId);
      } else if (e.pointerType === 'mouse') {
        this.h.move(p.x, p.y);
      }
    }

    pollGamepads() {
      // Im abgeschotteten Rahmen kann getGamepads() per Permissions-Policy werfen.
      if (this.noPads) return;
      let list = [];
      try {
        list = navigator.getGamepads ? navigator.getGamepads() || [] : [];
      } catch (e) {
        this.noPads = true;
        return;
      }
      let idx = 0;
      for (const gp of list) {
        if (!gp || !gp.connected) continue;
        const team = idx++;
        if (team > 1) break;
        const prev = this.pads[team] || [];
        const now = gp.buttons.map((b) => b.pressed || b.value > 0.5);
        for (let i = 0; i < now.length; i++) {
          if (!now[i] || prev[i]) continue;
          this.h.unlock();
          if (i === 9) this.h.ui('escape');
          else if (i === 12) this.h.ui('ArrowUp');
          else if (i === 13) this.h.ui('ArrowDown');
          else if (i === 14) this.h.ui('ArrowLeft');
          else if (i === 15) this.h.ui('ArrowRight');
          else if (i === 0 && this.h.ui('enter')) continue;
          else if (PAD[i]) this.h.action(team, PAD[i], true);
        }
        this.pads[team] = now;
      }
    }
  }

  EK.Input = Input;
  EK.input = { KEYS, PAD };
})((globalThis.EK = globalThis.EK || {}));
