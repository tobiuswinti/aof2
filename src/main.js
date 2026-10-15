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
    // Online-Duell: Lobby/Verbindung (online) und laufende Lockstep-Partie (net)
    online: new EK.Online(),
    net: null,
    netWaitSince: 0,
  };
  app.onlineSaved = app.online.savedGame();
  // Nur echte Stufen akzeptieren (z. B. kein 'constructor' aus manipuliertem Speicher).
  function validLevel(l) {
    return typeof l === 'string' && Object.prototype.hasOwnProperty.call(EK.ai.LEVELS, l);
  }
  const savedLevel = load('ek-level');
  if (validLevel(savedLevel)) app.level = savedLevel;

  function inMatch() {
    return app.mode === 'play' || app.mode === 'pause' || app.mode === 'over' || (app.mode === 'controls' && app.back === 'pause');
  }

  // ------------------------------------------------------------ Online
  // Eine neue Online-Partie (oder Runde) beginnt – auch nach Neuladen/Live-Update.
  function enterOnline(ls) {
    app.net = ls;
    app.vsAI = false;
    app.game = ls.s;
    app.ais = [null, null];
    app.humans = [ls.team === 0, ls.team === 1];
    app.names = onlineNames();
    app.overT = 0;
    app.onlineSaved = null;
    renderer.mirror = ls.team === 1; // eigene Basis immer links
    renderer.reset();
    setMode('play');
    renderer.add({ kind: 'banner', x: D.W / 2, y: 330, text: 'KAMPF!', color: '#ffe9a3', life: 1.6 });
  }
  app.online.onStart = enterOnline;

  function onlineNames() {
    const opp = app.online.oppName().toUpperCase();
    return app.net && app.net.team === 1 ? [opp, 'DU'] : ['DU', opp];
  }

  // Online-Partie verlassen (Lobby-Raum bleibt verbunden).
  function endOnline() {
    if (app.net || app.online.game) app.online.leave();
    app.net = null;
    renderer.mirror = false;
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
    endOnline();
    discardSave();
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
    endOnline();
    discardSave();
    setMode('menu');
    startDemo();
  }

  function setMode(m) {
    app.mode = m;
    app.sel = 0;
    app.confirm = null;
    app.pressed = null;
    // Online: eigene Pause hält die gemeinsame Partie an (der Gegner sieht das).
    if (app.net) app.net.paused = m === 'pause' || (m === 'controls' && app.back === 'pause');
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
    // Online steuert jede Taste/jeder Knopf das eigene Team.
    if (app.net && (src === 'key' || src === 'pad')) team = app.net.team;
    if (!app.humans[team]) return;
    // Verkaufen per Touch braucht ein zweites Tippen (liegt direkt neben „Aufsteigen“).
    if (action === 'sell' && src === 'touch' && !hud.isArmed(team, 'sell') && EK.sim.actionInfo(app.game, team, 'sell').enabled) {
      hud.arm(team, 'sell');
      hud.press(team, 'sell');
      return;
    }
    hud.disarm(team, 'sell');
    hud.press(team, action);
    if (app.net) {
      // Online: Befehl wird mit Vorlauf eingeplant; Ablehnungen meldet später die Simulation.
      if (!app.net.local(action)) hud.deny(team, action);
      return;
    }
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
          app.onlineSaved && { id: 'onlineResume', kind: 'big', label: 'ONLINE-PARTIE FORTSETZEN' },
          app.saved && { id: 'continue', kind: 'big', label: 'PARTIE FORTSETZEN' },
          { id: 'online', kind: 'big', label: 'ONLINE-DUELL' },
          { id: 'p2', kind: 'big', label: '2 SPIELER · LOKAL' },
          { id: 'ai', kind: 'big', label: '1 SPIELER · GEGEN KI' },
          { id: 'level', kind: 'level', label: 'KI-STUFE: ' + EK.ui.LEVEL_NAMES[app.level].toUpperCase() },
          opts[0],
          { id: 'controls', kind: 'small', label: 'HILFE' },
          ...opts.slice(1),
        ].filter(Boolean);
      case 'lobby':
        return lobbyItems();
      case 'pause':
        if (app.net) return [{ id: 'resume', kind: 'big', label: 'WEITER' }, { id: 'controls', kind: 'big', label: 'STEUERUNG' }, confirmItem('resign', 'AUFGEBEN'), ...opts].filter(Boolean);
        return [{ id: 'resume', kind: 'big', label: 'WEITER' }, confirmItem('restart', 'NEU STARTEN'), { id: 'controls', kind: 'big', label: 'STEUERUNG' }, confirmItem('quit', 'HAUPTMENÜ'), ...opts].filter(Boolean);
      case 'over':
        if (app.net) {
          const opp = app.online.opp;
          return [
            app.online.rematch ? { id: 'wait', kind: 'big', label: 'WARTE AUF ' + app.online.oppName().toUpperCase() + ' …' } : { id: 'again', kind: 'big', label: opp ? 'REVANCHE' : 'GEGNER IST WEG' },
            { id: 'quit', kind: 'big', label: 'HAUPTMENÜ' },
          ];
        }
        return [
          { id: 'again', kind: 'big', label: 'REVANCHE' },
          { id: 'quit', kind: 'big', label: 'HAUPTMENÜ' },
        ];
      case 'controls':
        return [{ id: 'back', kind: 'big', label: 'ZURÜCK' }];
    }
    return [];
  }

  // Lobby: je nach Verbindungszustand eröffnen, beitreten, warten, abbrechen.
  function lobbyItems() {
    const o = app.online;
    switch (o.state) {
      case 'lobby': {
        const games = o.openGames().slice(0, 3);
        return [{ id: 'host', kind: 'big', label: 'SPIEL ERÖFFNEN' }, ...games.map((p) => ({ id: 'join', peer: p, kind: 'big', label: 'BEITRETEN · ' + o.nameOf(p).toUpperCase() })), { id: 'lobbyBack', kind: 'big', label: 'ZURÜCK' }];
      }
      case 'hosting':
      case 'joining':
        return [{ id: 'cancel', kind: 'big', label: 'ABBRECHEN' }];
      default:
        return [{ id: 'lobbyBack', kind: 'big', label: 'ZURÜCK' }];
    }
  }

  function lobbyInfo() {
    const o = app.online;
    switch (o.state) {
      case 'idle':
      case 'connecting':
        return ['Verbinde mit der Lobby …'];
      case 'unavailable':
        return ['Online spielen geht nur in der veröffentlichten Seite in Claude –', 'für alle, mit denen sie geteilt ist. Beide öffnen den Link.'];
      case 'lobby': {
        const n = o.others().length;
        const games = o.openGames().length;
        return [
          n ? `In der Lobby: du und ${n} weitere${n === 1 ? 'r' : ''}` : 'Noch niemand sonst in der Lobby – teile den Link mit deinem Gegner.',
          games ? 'Tritt einem offenen Spiel bei oder eröffne ein eigenes.' : 'Eröffne ein Spiel – dein Gegner sieht es hier und tritt bei.',
        ];
      }
      case 'hosting':
        return ['Dein Spiel ist eröffnet – warte auf einen Gegner …', 'Wer die Seite gerade offen hat, sieht es in seiner Lobby.'];
      case 'joining':
        return ['Verbinde mit dem Spiel …'];
    }
    return [];
  }

  function openLobby() {
    setMode('lobby');
    app.online.init();
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
        if (app.net) return app.online.opp ? app.online.requestRematch() : undefined;
        return startGame(app.vsAI);
      case 'restart':
        if (!needsConfirm('restart')) startGame(app.vsAI);
        return;
      case 'quit':
        if (app.mode === 'over' || !needsConfirm('quit')) toMenu();
        return;
      case 'online':
        return openLobby();
      case 'onlineResume': {
        const saved = app.onlineSaved;
        app.onlineSaved = null;
        setMode('lobby');
        app.online.resume(saved);
        return;
      }
      case 'host':
        return app.online.host();
      case 'join':
        return app.online.join(item.peer);
      case 'cancel':
        return app.online.leave();
      case 'lobbyBack':
        if (app.online.game) app.online.leave();
        return setMode('menu');
      case 'resign':
        if (!needsConfirm('resign')) {
          app.online.resign();
          setMode('play');
        }
        return;
      case 'wait':
        return;
    }
  }

  function hudOpts() {
    const keyHints = !app.touch || app.keys;
    return {
      names: app.names,
      layout: view.big ? 'touch' : 'desktop',
      humans: app.humans,
      canFull: !!document.fullscreenEnabled,
      showKeys: [keyHints && app.humans[0], keyHints && app.humans[1]],
      musicOn: sound.musicOn,
      tooltips: app.mode === 'play' && !app.touch,
      showUi: app.mode === 'play',
      top: view.top,
      mirror: !!(app.net && app.net.team === 1),
      keyRow: app.net ? [0, 0] : null, // online: beide Seiten zeigen Q W E …
    };
  }

  // Liefert true, wenn sich dadurch das Layout geändert hat.
  function setTouch(touch) {
    if (touch === app.touch) return false;
    const before = view.big;
    app.touch = touch;
    resize();
    hud.relayout(hudOpts());
    return before !== view.big;
  }

  const input = new EK.Input(canvas, {
    unlock: () => sound.unlock(),
    pointer: (type) => {
      if (type === 'touch' || type === 'pen') return setTouch(true);
      if (type === 'mouse' && !coarsePointer()) return setTouch(false);
      return false;
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
        else if (h.id === 'pause') pauseIfPlaying();
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
      if (!p || p.id !== id) return; // anderer Finger – laufenden Menü-Tipp nicht abbrechen
      app.pressed = null;
      if (app.mode === 'play') return;
      const h = ui.hit(x, y);
      if (h && h.index === p.index) activate(menuItems()[h.index], h.side);
    },
    ui: (key) => {
      if (key === 'music') {
        sound.toggleMusic();
        return true;
      }
      if (key === 'escape') {
        if (app.mode === 'play') pauseIfPlaying();
        else if (app.mode === 'pause') setMode('play');
        else if (app.mode === 'controls') activate({ id: 'back' });
        else if (app.mode === 'over') toMenu();
        else if (app.mode === 'lobby') activate({ id: 'lobbyBack' });
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
  const view = { w: 1, h: 1, dpr: 1, scale: 1, offX: 0, offY: 0, rotated: false, flip: false, big: false, top: 0, vh: D.H };

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
    // Große Bedienung (Touch-Layout) bei Touch oder wenn das Fenster sehr klein ist.
    const big = app.touch || Math.min(w / D.W, h / D.H) < 0.55;
    const inset = app.touch ? 12 : 0; // Abstand zu den Wisch-Gesten am Bildschirmrand
    const lw = (rotated ? h : w) - 2 * inset;
    const lh = (rotated ? w : h) - 2 * inset;
    let vh = D.H;
    if (big && lw / lh > D.W / D.H) vh = Math.max(560, Math.min(D.H, (D.W * lh) / lw));
    const scale = Math.min(lw / D.W, lh / vh);
    Object.assign(view, {
      w,
      h,
      dpr,
      big,
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
    if (!inMatch() || app.net) return;
    // Eine entschiedene Partie darf nicht fortsetzbar bleiben.
    if (app.game.over) return discardSave();
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
    if (app.net) {
      // Online: Lockstep-Zustand mitgeben; nach dem Neuladen geht es im selben Raum weiter.
      let online = null;
      try {
        online = app.online.snapshot();
      } catch (e) {
        online = null;
      }
      return { v: STATE_V, level: app.level, flip: app.flip, mode: 'menu', game: null, online };
    }
    return {
      v: STATE_V,
      level: app.level,
      flip: app.flip,
      vsAI: app.vsAI,
      mode: inMatch() ? app.mode : 'menu',
      game: inMatch() ? EK.sim.serialize(app.game) : null,
    };
  }

  // applyPrefs: nur beim Live-Update (gleiches Gerät, gleicher Viewer) auch die Drehrichtung
  // übernehmen; eine lokale Sicherung ändert sie nicht (sie liegt ohnehin in 'ek-flip').
  function restore(data, applyPrefs) {
    if (!data || typeof data !== 'object') return false;
    if (applyPrefs && typeof data.flip === 'boolean' && data.flip !== app.flip) {
      app.flip = data.flip;
      store('ek-flip', app.flip ? '1' : '0');
    }
    if (data.v !== STATE_V || typeof data.game !== 'string') return false;
    if (validLevel(data.level)) app.level = data.level;
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
      ok = restore(JSON.parse(app.saved), false);
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
  let frameEma = 16.7;
  let frameNo = 0;
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
      // Zeichenzustand komplett zurücksetzen (offene save()/clip aus dem fehlerhaften Frame).
      try {
        canvas.width = canvas.width;
      } catch (err) {
        /* ignorieren */
      }
    }
  }

  function tick(now) {
    const rawMs = now - last;
    const dt = Math.min(0.1, Math.max(0, rawMs / 1000));
    last = now;
    if (rawMs > 0 && rawMs < 100) frameEma = frameEma * 0.9 + rawMs * 0.1;
    input.pollGamepads();

    let s = app.game;
    const running = app.mode === 'play' || app.mode === 'menu' || app.mode === 'lobby' || (app.mode === 'controls' && app.back === 'menu');
    if (app.net) {
      // Online: Lobby/Raum pflegen und die Lockstep-Partie so weit rechnen, wie beide Seiten bestätigt haben.
      app.online.update();
      const net = app.net;
      if (app.game !== net.s) app.game = s = net.s; // nach einer Spielstand-Übertragung
      if (app.mode === 'play') app.names = onlineNames();
      acc += dt;
      let due = Math.floor(acc / STEP);
      if (net.oppTick > net.tick + 2) due += 2; // zurückgefallen: aufholen
      const ran = net.step(Math.min(due, 8));
      acc = Math.max(0, acc - ran * STEP);
      if (acc > STEP * 3) acc = STEP * 3; // beim Warten nicht ansammeln
      if (net.stalled()) {
        if (!app.netWaitSince) app.netWaitSince = now;
      } else app.netWaitSince = 0;
      for (const ev of s.events) if (ev.type === 'deny' && ev.team === net.team && ev.action) hud.deny(ev.team, ev.action);
    } else if (app.online.game || app.online.state === 'hosting' || app.online.state === 'joining') {
      app.online.update();
    }
    if (!app.net && running) {
      acc += dt;
      while (acc >= STEP) {
        for (const ai of app.ais) if (ai) EK.ai.updateAI(ai, s, STEP);
        EK.sim.update(s, STEP);
        acc -= STEP;
      }
    } else if (!app.net) acc = 0;

    renderer.handleEvents(s.events, s);
    if (app.mode === 'play') sound.handleEvents(s.events, app.humans);
    s.events.length = 0;
    renderer.update(running ? dt : 0, s, dt);
    hud.update(dt);
    if (app.confirm && now > app.confirm.until) app.confirm = null;

    if (app.mode === 'play' && s.over) {
      if (app.overT === 0) discardSave();
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
    else if (app.mode === 'menu' || app.mode === 'lobby' || (app.mode === 'controls' && app.back === 'menu')) sound.setTheme('menu');
    else sound.setTheme(Math.max(s.players[0].age, s.players[1].age));
    sound.update();

    // Dauerhaft niedrige Bildrate: eine Qualitätsstufe herunterschalten. Die letzte Stufe
    // (Auflösung 1×) erst unter ~25 fps – 30 fps im iOS-Stromsparmodus sind keine Last.
    if (rawMs < 100 && !document.hidden) {
      slowT = frameEma > (app.quality >= 2 ? 40 : 25) ? slowT + rawMs : 0;
      if (slowT > 3000 && app.quality < 3) {
        app.quality++;
        slowT = 0;
        frameEma = 16.7;
        resize();
      }
    }
    // Auf Displays mit 120 Hz und mehr nur jedes n-te Bild zeichnen (~60 fps);
    // 60–90 Hz zeichnen jedes Bild.
    const every = Math.max(1, Math.floor(1000 / 60 / frameEma + 0.25));
    frameNo++;
    if (frameNo % every !== 0) return;
    draw(s);
  }

  // Warum die Online-Partie gerade steht
  function waitText() {
    const net = app.net;
    const o = app.online;
    const gone = o.oppMissing();
    if (net.need) return ['Spielstand wird übertragen …', net.recv ? `Teil ${net.recv.have} von ${net.recv.n}` : 'Warte auf den Gegner'];
    if (net.out) return ['Übertrage Spielstand an ' + o.oppName() + ' …', ''];
    if (gone > 1500) return [o.oppName() + ' ist nicht verbunden', gone > 20000 ? 'Warte weiter oder gib im Pausenmenü auf' : 'Warte auf Wiederverbindung …'];
    if (net.oppPaused) return [o.oppName() + ' hat pausiert', ''];
    return ['Warte auf ' + o.oppName() + ' …', ''];
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
    // Im großen Layout würde das HUD unter Pause/Spielende-Bildschirmen durchscheinen.
    if (inMatch() && (app.mode === 'play' || !view.big)) hud.draw(s, opts);
    const items = menuItems();
    if (app.sel >= items.length) app.sel = Math.max(0, items.length - 1);
    const area = { top: view.top, h: view.vh };
    if (app.mode === 'play' && app.net && app.netWaitSince && performance.now() - app.netWaitSince > 400) ui.drawWaiting(area, waitText());
    if (app.mode === 'menu') ui.drawMenu(items, app.sel, area, { touch: app.touch });
    else if (app.mode === 'lobby') ui.drawLobby(items, app.sel, area, lobbyInfo());
    else if (app.mode === 'controls') ui.drawControls(items, app.sel, area, { touch: app.touch, drawButton: (i, r) => hud.drawButton(s, 0, i, r, opts) });
    else if (app.mode === 'pause') ui.drawPause(items, app.sel, area);
    else if (app.mode === 'over') {
      if (app.net) opts.overTitle = s.winner === app.net.team ? 'SIEG!' : 'NIEDERLAGE';
      ui.drawOver(s, items, app.sel, area, opts);
    }
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
      restored = restore(data, true);
    } catch (e) {
      restored = false;
    }
    if (!restored) startDemo();
    // Laufende Online-Partie nach einem Live-Update fortsetzen (asynchron, sobald verbunden)
    if (data && data.v === STATE_V && data.online && data.online.ls) {
      app.online.restore(data.online).catch(() => {});
    }
    resize();
    requestAnimationFrame(frame);
  }

  const hot = window.claude && window.claude.hot;
  try {
    if (hot && hot.snapshot) hot.snapshot(snapshot);
  } catch (e) {
    /* Live-Update nicht verfügbar */
  }
  if (hot && hot.ready) {
    try {
      hot.ready(start);
    } catch (e) {
      /* ignorieren */
    }
    // Falls der Viewer nie zurückruft, trotzdem starten.
    setTimeout(() => start((hot && hot.data) || {}), 2000);
  } else start((hot && hot.data) || {});

  // Für Fehlersuche und automatisierte Browser-Tests
  app.sound = sound;
  app.view = view;
  app.ui = ui;
  app.items = () => menuItems();
  app.hud = hud;
  app.toLogicalProbe = (x, y) => input.toLogical(x, y);
  EK.app = app;
})((globalThis.EK = globalThis.EK || {}));
