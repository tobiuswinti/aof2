// Einstiegspunkt: Spielschleife (fester Zeitschritt), Zustandsautomat der Bildschirme
// und Verdrahtung von Eingabe, Simulation, Darstellung und Ton.
(function (EK) {
  'use strict';

  const D = EK.data;
  const STEP = 1 / 60;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const renderer = new EK.Renderer(ctx);
  const hud = new EK.HUD(ctx);
  const ui = new EK.UI(ctx);
  const sound = new EK.Sound();

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
  };

  try {
    const l = localStorage.getItem('ek-level');
    if (l && EK.ai.LEVELS[l]) app.level = l;
  } catch (e) {
    /* ignorieren */
  }

  function startDemo() {
    app.game = EK.sim.createGame({ seed: (Math.random() * 1e9) | 0 });
    app.ais = [EK.ai.createAI(0, 'normal', 1), EK.ai.createAI(1, 'normal', 2)];
    app.humans = [false, false];
    app.names = ['BLAU', 'ROT'];
    renderer.reset();
  }

  function startGame(vsAI) {
    app.vsAI = vsAI;
    const lvl = EK.ai.LEVELS[app.level];
    app.game = EK.sim.createGame({ seed: (Math.random() * 1e9) | 0, bonus: [1, vsAI ? lvl.bonus : 1] });
    app.ais = [null, vsAI ? EK.ai.createAI(1, app.level, (Math.random() * 1e9) | 0) : null];
    app.humans = [true, !vsAI];
    app.names = vsAI ? ['SPIELER', 'KI · ' + EK.ui.LEVEL_NAMES[app.level].toUpperCase()] : ['SPIELER 1', 'SPIELER 2'];
    app.mode = 'play';
    app.overT = 0;
    renderer.reset();
    renderer.add({ kind: 'banner', x: D.W / 2, y: 330, text: 'KAMPF!', color: '#ffe9a3', life: 1.6 });
  }

  function setMode(m) {
    app.mode = m;
    app.sel = 0;
  }

  function doAction(team, action, fromPad) {
    if (app.mode !== 'play') return;
    if (team === -1) {
      // Ziffern: nur wenn genau ein Mensch spielt
      if (app.humans[0] && app.humans[1]) return;
      team = app.humans[0] ? 0 : 1;
    }
    if (fromPad && app.vsAI) team = 0;
    if (!app.humans[team]) return;
    hud.press(team, action);
    EK.sim.command(app.game, team, action);
  }

  function fullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  function menuChoose(i) {
    switch (app.mode) {
      case 'menu':
        if (i === 0) startGame(false);
        else if (i === 1) startGame(true);
        else if (i === 2) {
          app.back = 'menu';
          setMode('controls');
        } else if (i === 3) sound.toggleMusic();
        break;
      case 'controls':
        setMode(app.back);
        if (app.back === 'pause') app.sel = 2;
        break;
      case 'pause':
        if (i === 0) app.mode = 'play';
        else if (i === 1) startGame(app.vsAI);
        else if (i === 2) {
          app.back = 'pause';
          setMode('controls');
        } else if (i === 3) {
          setMode('menu');
          startDemo();
        }
        break;
      case 'over':
        if (i === 0) startGame(app.vsAI);
        else {
          setMode('menu');
          startDemo();
        }
        break;
    }
  }

  function cycleLevel(d) {
    const keys = Object.keys(EK.ai.LEVELS);
    const i = (keys.indexOf(app.level) + d + keys.length) % keys.length;
    app.level = keys[i];
    try {
      localStorage.setItem('ek-level', app.level);
    } catch (e) {
      /* ignorieren */
    }
  }

  const input = new EK.Input(canvas, {
    unlock: () => sound.unlock(),
    action: doAction,
    hover: (h) => (hud.hover = h),
    move: (x, y) => {
      if (app.mode === 'play') hud.hover = hud.hit(x, y);
      else {
        hud.hover = null;
        const i = ui.hit(x, y);
        if (i !== -1) app.sel = i;
      }
    },
    click: (x, y) => {
      if (app.mode === 'play') {
        const h = hud.hit(x, y);
        if (!h) return;
        if (h.kind === 'action') doAction(h.team, h.action);
        else if (h.id === 'pause') setMode('pause');
        else if (h.id === 'music') sound.toggleMusic();
        else if (h.id === 'full') fullscreen();
        return;
      }
      const i = ui.hit(x, y);
      if (i === -1) return;
      if (app.mode === 'menu' && i === 1) {
        // Klick auf die Pfeile wechselt die Schwierigkeit
        const r = ui.items[1];
        if (x < r.x + 70) return cycleLevel(-1);
        if (x > r.x + r.w - 70) return cycleLevel(1);
      }
      app.sel = i;
      menuChoose(i);
    },
    ui: (key) => {
      if (key === 'music') {
        sound.toggleMusic();
        return true;
      }
      if (key === 'escape') {
        if (app.mode === 'play') setMode('pause');
        else if (app.mode === 'pause') app.mode = 'play';
        else if (app.mode === 'controls') menuChoose(0);
        else if (app.mode === 'over') menuChoose(1);
        return true;
      }
      if (app.mode === 'play') return false;
      const n = ui.items.length;
      if (key === 'ArrowUp') app.sel = (app.sel - 1 + n) % n;
      else if (key === 'ArrowDown') app.sel = (app.sel + 1) % n;
      else if ((key === 'ArrowLeft' || key === 'ArrowRight') && app.mode === 'menu' && app.sel === 1) cycleLevel(key === 'ArrowLeft' ? -1 : 1);
      else if (key === 'enter' || key === 'space') menuChoose(app.sel);
      else return false;
      return true;
    },
  });

  // ------------------------------------------------------------ Größe & Skalierung
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    scale = Math.min(w / D.W, h / D.H);
    offX = (w - D.W * scale) / 2;
    offY = (h - D.H * scale) / 2;
    input.toLogical = (x, y) => ({ x: (x - offX) / scale, y: (y - offY) / scale });
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ Schleife
  let last = performance.now();
  let acc = 0;
  let demoRestart = 0;

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
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
    renderer.update(running ? dt : 0, s);
    hud.update(dt);

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

    // Musik
    if (app.mode === 'over' || (app.mode === 'play' && s.over)) sound.setTheme('victory');
    else if (app.mode === 'menu' || (app.mode === 'controls' && app.back === 'menu')) sound.setTheme('menu');
    else sound.setTheme(Math.max(s.players[0].age, s.players[1].age));
    sound.update();

    // Zeichnen
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, D.W, D.H);
    ctx.clip();
    renderer.drawWorld(s);
    const opts = { names: app.names, showKeys: app.vsAI ? [true, false] : [true, true], musicOn: sound.musicOn, tooltips: app.mode === 'play' };
    if (app.mode === 'play' || app.mode === 'pause' || app.mode === 'over' || (app.mode === 'controls' && app.back === 'pause')) hud.draw(s, opts);
    if (app.mode === 'menu') ui.drawMenu(app.sel, { level: app.level, musicOn: sound.musicOn });
    else if (app.mode === 'controls') ui.drawControls();
    else if (app.mode === 'pause') ui.drawPause(app.sel);
    else if (app.mode === 'over') ui.drawOver(s, app.sel, opts);
    ctx.restore();
    requestAnimationFrame(frame);
  }

  startDemo();
  const go = () => requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) {
    Promise.race([document.fonts.load('20px "Russo One"'), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
  } else go();

  // Für Fehlersuche und automatisierte Browser-Tests
  app.sound = sound;
  EK.app = app;
})((globalThis.EK = globalThis.EK || {}));
