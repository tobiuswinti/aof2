// Einstiegspunkt: Spielschleife (fester Zeitschritt), Zustandsautomat der Bildschirme
// und Verdrahtung von Eingabe, Simulation, Darstellung und Ton.
(function (EK) {
  'use strict';

  const D = EK.data;
  const STEP = 1 / 60;
  // Version des gespeicherten Spielstands – bei Änderungen am Zustandsformat erhöhen,
  // damit alte Stände (Live-Update, lokale Sicherung) verworfen statt falsch geladen werden.
  const STATE_V = 2;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const renderer = new EK.Renderer(ctx);
  const hud = new EK.HUD(ctx);
  const ui = new EK.UI(ctx);
  const sound = new EK.Sound();

  // ------------------------------------------------------------ Speicher (kann im Rahmen werfen)
  function load(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function store(key, val) {
    try {
      if (val == null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) {
      /* Speicher nicht verfügbar */
    }
  }

  function coarsePointer() {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch (e) {
      return false;
    }
  }

  const app = {
    mode: 'menu', // menu | controls | play | pause | over
    back: 'menu',
    sel: 0,
    level: 'normal',
    vsAI: false,
    game: null,
    ais: [null, null],
    humans: [false, false],
    names: ['SPIELER 1', 'SPIELER 2'],
    overT: 0,
    // Touch-Layout: bei grobem Zeiger (Handy/Tablet) oder sobald jemand den Bildschirm antippt.
    touch: coarsePointer(),
    keys: false,
    flip: load('ek-flip') === '1',
    confirm: null,
    saved: load('ek-save'),
    pressed: null,
    quality: 0, // 0 = volle Qualität … 3 = sparsamste Darstellung
  };
  const savedLevel = load('ek-level');
  if (savedLevel && EK.ai.LEVELS[savedLevel]) app.level = savedLevel;

  function inMatch() {
    return app.mode === 'play' || app.mode === 'pause' || app.mode === 'over' || (app.mode === 'controls' && app.back === 'pause');
  }

  // ------------------------------------------------------------ Partien
  function startDemo() {
    app.game = EK.sim.createGame({ seed: (Math.random() * 1e9) | 0 });
    app.ais = [EK.ai.createAI(0, 'normal', 1), EK.ai.createAI(1, 'normal', 2)];
    app.humans = [false, false];
    app.names = ['BLAU', 'ROT'];
    renderer.reset();
  }

  function names(vsAI) {
    return vsAI ? ['SPIELER', 'KI · ' + EK.ui.LEVEL_NAMES[app.level].toUpperCase()] : ['SPIELER 1', 'SPIELER 2'];
  }

  function startGame(vsAI) {
    app.vsAI = vsAI;
    const lvl = EK.ai.LEVELS[app.level];
    app.game = EK.sim.createGame({ seed: (Math.random() * 1e9) | 0, bonus: [1, vsAI ? lvl.bonus : 1] });
    app.ais = [null, vsAI ? EK.ai.createAI(1, app.level, (Math.random() * 1e9) | 0) : null];
    app.humans = [true, !vsAI];
    app.names = names(vsAI);
    app.overT = 0;
    setMode('play');
    renderer.reset();
    renderer.add({ kind: 'banner', x: D.W / 2, y: 330, text: 'KAMPF!', color: '#ffe9a3', life: 1.6 });
  }

  function toMenu() {
    discardSave();
    setMode('menu');
    startDemo();
  }

  function setMode(m) {
    app.mode = m;
    app.sel = 0;
    app.confirm = null;
    app.pressed = null;
    if (m === 'over') discardSave();
    syncWakeLock();
  }

  function vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {
      /* nicht erlaubt */
    }
  }

  // src: 'key' | 'pad' | 'mouse' | 'touch'
  function doAction(team, action, src) {
    if (app.mode !== 'play' || app.game.over) return;
    if (team === -1) {
      // Ziffern: nur wenn genau ein Mensch spielt
      if (app.humans[0] && app.humans[1]) return;
      team = app.humans[0] ? 0 : 1;
    }
    if (src === 'pad' && app.vsAI) team = 0;
    if (!app.humans[team]) return;
    // Verkaufen per Touch braucht ein zweites Tippen (liegt direkt neben „Aufsteigen“).
    if (action === 'sell' && src === 'touch' && !hud.isArmed(team, 'sell') && EK.sim.actionInfo(app.game, team, 'sell').enabled) {
      hud.arm(team, 'sell');
      hud.press(team, 'sell');
      return;
    }
    hud.disarm(team, 'sell');
    hud.press(team, action);
    if (!EK.sim.command(app.game, team, action)) {
      hud.deny(team, action);
      if (src === 'touch') vibrate(25);
    }
  }

  function fullscreen() {
    try {
      const el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch (e) {
      /* Vollbild nicht erlaubt */
    }
  }

  function cycleLevel(d) {
    const keys = Object.keys(EK.ai.LEVELS);
    app.level = keys[(keys.indexOf(app.level) + d + keys.length) % keys.length];
    store('ek-level', app.level);
  }

  function toggleFlip() {
    app.flip = !app.flip;
    store('ek-flip', app.flip ? '1' : '0');
    resize();
  }

  // ------------------------------------------------------------ Menüs
  function armed(id) {
    return app.confirm && app.confirm.id === id && performance.now() < app.confirm.until;
  }

  function confirmItem(id, label) {
    const a = armed(id);
    return { id, kind: 'big', label: a ? 'NOCHMAL TIPPEN: ' + label : label, confirm: a };
  }

  function menuItems() {
    const opts = [
      { id: 'music', kind: 'small', label: sound.musicOn ? 'MUSIK AN' : 'MUSIK AUS' },
      document.fullscreenEnabled && { id: 'full', kind: 'small', label: document.fullscreenElement ? 'FENSTER' : 'VOLLBILD' },
      view.rotated && { id: 'flip', kind: 'small', label: 'BILD DREHEN' },
    ];
    switch (app.mode) {
      case 'menu':
        return [
          app.saved && { id: 'continue', kind: 'big', label: 'PARTIE FORTSETZEN' },
          { id: 'p2', kind: 'big', label: '2 SPIELER · LOKAL' },
          { id: 'ai', kind: 'big', label: '1 SPIELER · GEGEN KI' },
          { id: 'level', kind: 'level', label: 'KI-STUFE: ' + EK.ui.LEVEL_NAMES[app.level].toUpperCase() },
          { id: 'controls', kind: 'big', label: 'STEUERUNG' },
          ...opts,
        ].filter(Boolean);
      case 'pause':
        return [{ id: 'resume', kind: 'big', label: 'WEITER' }, confirmItem('restart', 'NEU STARTEN'), { id: 'controls', kind: 'big', label: 'STEUERUNG' }, confirmItem('quit', 'HAUPTMENÜ'), ...opts].filter(Boolean);
      case 'over':
        return [
          { id: 'again', kind: 'big', label: 'REVANCHE' },
          { id: 'quit', kind: 'big', label: 'HAUPTMENÜ' },
        ];
      case 'controls':
        return [{ id: 'back', kind: 'big', label: 'ZURÜCK' }];
    }
    return [];
  }

  // Bestätigungspflichtige Einträge: erstes Auslösen schärft, zweites (binnen 3 s) führt aus.
  function needsConfirm(id) {
    if (armed(id)) {
      app.confirm = null;
      return false;
    }
    app.confirm = { id, until: performance.now() + 3000 };
    return true;
  }

  function activate(item, side) {
    if (!item) return;
    switch (item.id) {
      case 'p2':
        return startGame(false);
      case 'ai':
        return startGame(true);
      case 'level':
        return cycleLevel(side || 1);
      case 'controls':
        app.back = app.mode;
        return setMode('controls');
      case 'back': {
        const sel = app.back === 'pause' ? 2 : 0;
        setMode(app.back);
        app.sel = sel;
        return;
      }
      case 'music':
        return sound.toggleMusic();
      case 'full':
        return fullscreen();
      case 'flip':
        return toggleFlip();
      case 'continue':
        return resumeSaved();
      case 'resume':
        return setMode('play');
      case 'again':
        return startGame(app.vsAI);
      case 'restart':
        if (!needsConfirm('restart')) startGame(app.vsAI);
        return;
      case 'quit':
        if (app.mode === 'over' || !needsConfirm('quit')) toMenu();
        return;
    }
  }

  function hudOpts() {
    const keyHints = !app.touch || app.keys;
    return {
      names: app.names,
      layout: app.touch ? 'touch' : 'desktop',
      humans: app.humans,
      canFull: !!document.fullscreenEnabled,
      showKeys: [keyHints && app.humans[0], keyHints && app.humans[1]],
      musicOn: sound.musicOn,
      tooltips: app.mode === 'play' && !app.touch,
      showUi: app.mode === 'play',
      top: view.top,
    };
  }

  function setTouch(touch) {
    if (touch === app.touch) return;
    app.touch = touch;
    resize();
    hud.relayout(hudOpts());
  }

  const input = new EK.Input(canvas, {
    unlock: () => sound.unlock(),
    pointer: (type) => {
      if (type === 'touch' || type === 'pen') setTouch(true);
      else if (type === 'mouse' && !coarsePointer()) setTouch(false);
    },
    keyboard: () => (app.keys = true),
    action: (team, action, fromPad) => doAction(team, action, fromPad ? 'pad' : 'key'),
    hover: (h) => (hud.hover = h),
    move: (x, y) => {
      if (app.mode === 'play') hud.hover = hud.hit(x, y);
      else {
        hud.hover = null;
        const h = ui.hit(x, y);
        if (h) app.sel = h.index;
      }
    },
    click: (x, y, type, id) => {
      if (app.mode === 'play') {
        hud.relayout(hudOpts());
        const h = hud.hit(x, y);
        if (!h) return;
        if (h.kind === 'action') doAction(h.team, h.action, type === 'mouse' ? 'mouse' : 'touch');
        else if (h.id === 'pause') setMode('pause');
        else if (h.id === 'music') sound.toggleMusic();
        else if (h.id === 'full') fullscreen();
        return;
      }
      // Menüs lösen erst beim Loslassen auf demselben Eintrag aus.
      const h = ui.hit(x, y);
      app.pressed = h ? { id, index: h.index } : null;
      if (h) app.sel = h.index;
    },
    release: (x, y, type, id) => {
      const p = app.pressed;
      app.pressed = null;
      if (!p || app.mode === 'play' || p.id !== id) return;
      const h = ui.hit(x, y);
      if (h && h.index === p.index) activate(menuItems()[h.index], h.side);
    },
    ui: (key) => {
      if (key === 'music') {
        sound.toggleMusic();
        return true;
      }
      if (key === 'escape') {
        if (app.mode === 'play') setMode('pause');
        else if (app.mode === 'pause') setMode('play');
        else if (app.mode === 'controls') activate({ id: 'back' });
        else if (app.mode === 'over') toMenu();
        return true;
      }
      if (app.mode === 'play') return false;
      const items = menuItems();
      const n = items.length;
      const cur = items[app.sel];
      if (key === 'ArrowUp') app.sel = (app.sel - 1 + n) % n;
      else if (key === 'ArrowDown') app.sel = (app.sel + 1) % n;
      else if ((key === 'ArrowLeft' || key === 'ArrowRight') && cur && cur.id === 'level') cycleLevel(key === 'ArrowLeft' ? -1 : 1);
      else if (key === 'enter' || key === 'space') activate(cur, 1);
      else return false;
      return true;
    },
  });

  // ------------------------------------------------------------ Größe & Skalierung
  // Die Leinwand füllt ihren Container (respektiert so die Safe-Area-Ränder des Rahmens).
  // Touch-Geräte im Hochformat: um 90° gedreht zeichnen (Richtung umschaltbar), damit das
  // Spiel auch spielbar bleibt, wenn die App das Drehen des Bildschirms nicht zulässt.
  // Breite Touch-Bildschirme: oben leeren Himmel abschneiden statt seitlicher Balken – so
  // wird alles größer. view.top/view.vh beschreiben den sichtbaren logischen Bereich.
  const view = { w: 1, h: 1, dpr: 1, scale: 1, offX: 0, offY: 0, rotated: false, flip: false, top: 0, vh: D.H };

  function screenPortrait() {
    try {
      if (screen.orientation && screen.orientation.type) return screen.orientation.type.indexOf('portrait') === 0;
    } catch (e) {
      /* ignorieren */
    }
    if (typeof window.orientation === 'number') return window.orientation % 180 === 0;
    return screen.height >= screen.width;
  }

  function resize() {
    const stage = canvas.parentElement;
    const w = Math.max(1, stage.clientWidth);
    const h = Math.max(1, stage.clientHeight);
    const dpr = Math.min(app.quality >= 3 ? 1 : app.quality >= 1 ? 1.5 : 2, window.devicePixelRatio || 1);
    // Nur echte Handys/Tablets im Hochformat drehen – nicht etwa ein schmales Seitenpanel am Laptop.
    const rotated = coarsePointer() && h > w * 1.05 && screenPortrait();
    const inset = app.touch ? 12 : 0; // Abstand zu den Wisch-Gesten am Bildschirmrand
    const lw = (rotated ? h : w) - 2 * inset;
    const lh = (rotated ? w : h) - 2 * inset;
    let vh = D.H;
    if (app.touch && lw / lh > D.W / D.H) vh = Math.max(560, Math.min(D.H, (D.W * lh) / lw));
    const scale = Math.min(lw / D.W, lh / vh);
    Object.assign(view, {
      w,
      h,
      dpr,
      rotated,
      flip: rotated && app.flip,
      scale,
      top: D.H - vh,
      vh,
      offX: inset + (lw - D.W * scale) / 2,
      offY: inset + (lh - vh * scale) / 2,
    });
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const v = view;
    if (!rotated) input.toLogical = (x, y) => ({ x: (x - v.offX) / v.scale, y: (y - v.offY) / v.scale + v.top });
    else if (!v.flip) input.toLogical = (x, y) => ({ x: (y - v.offX) / v.scale, y: (v.w - v.offY - x) / v.scale + v.top });
    else input.toLogical = (x, y) => ({ x: (v.h - v.offX - y) / v.scale, y: (x - v.offY) / v.scale + v.top });
  }

  function applyTransform() {
    const { dpr, scale: s, offX, offY, top } = view;
    if (!view.rotated) ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * offX, dpr * (offY - s * top));
    else if (!view.flip) ctx.setTransform(0, dpr * s, -dpr * s, 0, dpr * (view.w - offY + s * top), dpr * offX);
    else ctx.setTransform(0, -dpr * s, dpr * s, 0, dpr * (offY - s * top), dpr * (view.h - offX));
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);
  canvas.addEventListener('contextrestored', () => renderer.invalidate());
  resize();

  // Qualitätsstufe ≥ 2: Leuchteffekte (shadowBlur) abschalten – auf schwachen GPUs teuer.
  try {
    const blur = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    if (blur && blur.set) {
      Object.defineProperty(ctx, 'shadowBlur', {
        configurable: true,
        get() {
          return blur.get.call(this);
        },
        set(v) {
          blur.set.call(this, app.quality >= 2 ? 0 : v);
        },
      });
    }
  } catch (e) {
    /* ignorieren */
  }

  // ------------------------------------------------------------ Handy: Hintergrund, Display, Sicherung
  let wakeLock = null;
  let wakePending = false;
  function wantWake() {
    return !document.hidden && (app.mode === 'play' || app.mode === 'pause' || (app.mode === 'controls' && app.back === 'pause'));
  }
  // Bildschirm nur während einer Partie wach halten; im Menü wieder freigeben.
  function syncWakeLock() {
    if (wakeLock && wakeLock.released) wakeLock = null;
    if (wantWake()) {
      if (wakeLock || wakePending || !navigator.wakeLock) return;
      wakePending = true;
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          wakePending = false;
          if (!wantWake()) return l.release().catch(() => {});
          wakeLock = l;
          l.addEventListener('release', () => {
            if (wakeLock === l) wakeLock = null;
          });
        })
        .catch(() => {
          wakePending = false;
        });
    } else if (wakeLock) {
      const l = wakeLock;
      wakeLock = null;
      l.release().catch(() => {});
    }
  }

  function pauseIfPlaying() {
    if (app.mode === 'play' && !app.game.over) setMode('pause');
  }

  function persist() {
    if (!inMatch() || app.game.over) return;
    try {
      const data = JSON.stringify(snapshot());
      store('ek-save', data);
      app.saved = data;
    } catch (e) {
      /* ignorieren */
    }
  }

  function discardSave() {
    store('ek-save', null);
    app.saved = null;
  }

  document.addEventListener('visibilitychange', () => {
    sound.setHidden(document.hidden);
    if (document.hidden) {
      pauseIfPlaying();
      persist();
    }
    syncWakeLock();
  });
  window.addEventListener('pagehide', persist);
  // iOS: Kontrollzentrum, Anruf-Banner oder Siri lassen die Seite „sichtbar“, nehmen ihr aber den Fokus.
  window.addEventListener('blur', pauseIfPlaying);
  sound.onInterrupt = pauseIfPlaying;

  // ------------------------------------------------------------ Spielstand: Live-Update & Sicherung
  function snapshot() {
    return {
      v: STATE_V,
      level: app.level,
      flip: app.flip,
      vsAI: app.vsAI,
      mode: inMatch() ? app.mode : 'menu',
      game: inMatch() ? EK.sim.serialize(app.game) : null,
    };
  }

  function restore(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.level && EK.ai.LEVELS[data.level]) app.level = data.level;
    if (typeof data.flip === 'boolean') app.flip = data.flip;
    if (data.v !== STATE_V || typeof data.game !== 'string') return false;
    // Probelauf: ein beschädigter oder inkompatibler Stand darf das Spiel nicht einfrieren.
    EK.sim.update(EK.sim.deserialize(data.game), STEP);
    const game = EK.sim.deserialize(data.game);
    app.vsAI = !!data.vsAI;
    app.game = game;
    app.ais = [null, app.vsAI ? EK.ai.createAI(1, app.level, (Math.random() * 1e9) | 0) : null];
    app.humans = [true, !app.vsAI];
    app.names = names(app.vsAI);
    app.overT = 0;
    renderer.reset();
    setMode(game.over ? 'over' : 'pause');
    return true;
  }

  function resumeSaved() {
    let ok = false;
    try {
      ok = restore(JSON.parse(app.saved));
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      discardSave();
      startDemo();
    }
  }

  // ------------------------------------------------------------ Schleife
  let last = performance.now();
  let acc = 0;
  let demoRestart = 0;
  let lastDraw = 0;
  let drawEma = 16.7;
  let slowT = 0;
  let saveT = 0;
  let errors = 0;

  function frame(now) {
    // Zuerst neu anmelden: Ein Fehler in einem Frame darf die Schleife nie beenden.
    requestAnimationFrame(frame);
    try {
      tick(now);
    } catch (e) {
      if (errors++ < 5 && window.console) console.error(e);
    }
  }

  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    input.pollGamepads();

    const s = app.game;
    const running = app.mode === 'play' || app.mode === 'menu' || (app.mode === 'controls' && app.back === 'menu');
    if (running) {
      acc += dt;
      while (acc >= STEP) {
        for (const ai of app.ais) if (ai) EK.ai.updateAI(ai, s, STEP);
        EK.sim.update(s, STEP);
        acc -= STEP;
      }
    } else acc = 0;

    renderer.handleEvents(s.events, s);
    if (app.mode === 'play') sound.handleEvents(s.events, app.humans);
    s.events.length = 0;
    renderer.update(running ? dt : 0, s, dt);
    hud.update(dt);
    if (app.confirm && now > app.confirm.until) app.confirm = null;

    if (app.mode === 'play' && s.over) {
      app.overT += dt;
      if (app.overT > 2.2) setMode('over');
    }
    if (app.mode === 'menu' && s.over) {
      demoRestart += dt;
      if (demoRestart > 4) {
        demoRestart = 0;
        startDemo();
      }
    }
    if (app.mode === 'play' && !s.over) {
      saveT += dt;
      if (saveT > 5) {
        saveT = 0;
        persist();
      }
    }

    // Musik
    if (app.mode === 'over' || (app.mode === 'play' && s.over)) sound.setTheme('victory');
    else if (app.mode === 'menu' || (app.mode === 'controls' && app.back === 'menu')) sound.setTheme('menu');
    else sound.setTheme(Math.max(s.players[0].age, s.players[1].age));
    sound.update();

    // Zeichnen höchstens ~60-mal pro Sekunde (120-Hz-Displays würden sonst doppelt zeichnen)
    if (now - lastDraw < 14) return;
    const interval = now - lastDraw;
    lastDraw = now;
    if (interval < 100 && !document.hidden) {
      // Dauerhaft unter ~40 fps: eine Qualitätsstufe herunterschalten. Die letzte Stufe
      // (Auflösung 1×) erst unter ~25 fps – 30 fps im iOS-Stromsparmodus sind keine Last.
      drawEma = drawEma * 0.95 + interval * 0.05;
      slowT = drawEma > (app.quality >= 2 ? 40 : 25) ? slowT + interval : 0;
      if (slowT > 3000 && app.quality < 3) {
        app.quality++;
        slowT = 0;
        drawEma = 16.7;
        resize();
      }
    }
    draw(s);
  }

  function draw(s) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    applyTransform();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, view.top, D.W, view.vh);
    ctx.clip();
    renderer.showBaseBars = !app.touch; // im Touch-Layout stehen die Basis-LP in den Infotafeln
    renderer.drawWorld(s);
    const opts = hudOpts();
    if (inMatch()) hud.draw(s, opts);
    const items = menuItems();
    if (app.sel >= items.length) app.sel = Math.max(0, items.length - 1);
    const area = { top: view.top, h: view.vh };
    if (app.mode === 'menu') ui.drawMenu(items, app.sel, area, { touch: app.touch });
    else if (app.mode === 'controls') ui.drawControls(items, app.sel, area, { touch: app.touch, drawButton: (i, r) => hud.drawButton(s, 0, i, r, opts) });
    else if (app.mode === 'pause') ui.drawPause(items, app.sel, area);
    else if (app.mode === 'over') ui.drawOver(s, items, app.sel, area, opts);
    ctx.restore();
  }

  // ------------------------------------------------------------ Start & Live-Update
  // Wird die Seite neu veröffentlicht, übernimmt der Viewer den Zustand über claude.hot:
  // Eine laufende Partie geht so nicht verloren (sie startet pausiert).
  let started = false;
  function start(data) {
    if (started) return;
    started = true;
    let restored = false;
    try {
      restored = restore(data);
    } catch (e) {
      restored = false;
    }
    if (!restored) startDemo();
    resize();
    requestAnimationFrame(frame);
  }

  const hot = window.claude && window.claude.hot;
  try {
    if (hot && hot.snapshot) hot.snapshot(snapshot);
  } catch (e) {
    /* Live-Update nicht verfügbar */
  }
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});

  // Für Fehlersuche und automatisierte Browser-Tests
  app.sound = sound;
  app.view = view;
  app.ui = ui;
  app.hud = hud;
  app.toLogicalProbe = (x, y) => input.toLogical(x, y);
  EK.app = app;
})((globalThis.EK = globalThis.EK || {}));
