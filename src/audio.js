// Ton: prozedural erzeugte Musik (eigener Sequenzer, Melodien werden aus Seeds generiert)
// und synthetisierte Soundeffekte. Alles mit WebAudio – keine Audiodateien.
(function (EK) {
  'use strict';

  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygianDom: [0, 1, 4, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
  };

  // Schlagzeug-Muster auf 16 Schritten (x = Schlag, o = leise)
  const DRUMS = {
    epic: { kick: 'x.......x.....x.', snare: '....x.......x...', hat: '', tom: '..............xx' },
    tribal: { kick: 'x..x..x...x..x..', snare: '', hat: '', tom: '..x...x.x.x...xo', shaker: 'x.o.x.o.x.o.x.o.' },
    frame: { kick: 'x.....x...x.....', snare: '', hat: '', tom: '...x.....x..x.xx', shaker: 'o.o.o.o.o.o.o.o.' },
    march: { kick: 'x.......x.......', snare: '..x.x.x...x.xxxx', hat: '', tom: '' },
    baroque: { kick: 'x.......x.......', snare: '....x.......x.o.', hat: 'x.x.x.x.x.x.x.x.', tom: '' },
    rock: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tom: '' },
    synth: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', tom: '', shaker: 'oooooooooooooooo' },
    victory: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tom: '' },
  };

  const THEMES = {
    menu: { bpm: 84, root: 50, scale: 'minor', prog: [0, 5, 3, 4], lead: 'horn', bass: 'sub', pad: true, drums: 'epic', density: 0.5, seed: 11 },
    0: { bpm: 100, root: 57, scale: 'minor', prog: [0, 0, 6, 4], lead: 'flute', bass: 'sub', pad: false, drums: 'tribal', density: 0.55, seed: 21, penta: true },
    1: { bpm: 104, root: 50, scale: 'phrygianDom', prog: [0, 1, 0, 6], lead: 'pluck', bass: 'sub', pad: true, drums: 'frame', density: 0.65, seed: 31 },
    2: { bpm: 108, root: 50, scale: 'dorian', prog: [0, 6, 3, 0], lead: 'horn', bass: 'pluckBass', pad: true, drums: 'march', density: 0.55, seed: 41 },
    3: { bpm: 116, root: 55, scale: 'harmonic', prog: [0, 3, 4, 0], lead: 'harpsi', bass: 'pluckBass', pad: true, drums: 'baroque', density: 0.75, seed: 51, arp: true },
    4: { bpm: 126, root: 52, scale: 'minor', prog: [0, 5, 2, 6], lead: 'lead', bass: 'sawBass', pad: true, drums: 'rock', density: 0.6, seed: 61 },
    5: { bpm: 128, root: 48, scale: 'minor', prog: [0, 5, 3, 6], lead: 'synth', bass: 'sawBass', pad: true, drums: 'synth', density: 0.6, seed: 71, arp: true },
    victory: { bpm: 112, root: 55, scale: 'mixolydian', prog: [0, 3, 4, 0], lead: 'horn', bass: 'sub', pad: true, drums: 'victory', density: 0.7, seed: 91 },
  };

  const RHYTHMS = ['x.x.x-x.', 'x-x.xxx.', 'x--.x.x.', 'xx.xx.x-', 'x.xx.-x.', 'x---x-x.', 'x.x-xx-.', 'x-.xx.x.'];

  function midiHz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Erzeugt aus einem Thema eine 8-taktige Komposition (Melodie, Bass, Akkorde).
  function compose(th) {
    const r = rng(th.seed);
    const sc = SCALES[th.scale];
    const degNote = (deg) => th.root + 12 + sc[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
    const chordDegs = (c) => [c, c + 2, c + 4];
    const rA = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    const rB = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    const melody = [];
    let deg = 7;
    const motif = [];
    for (let bar = 0; bar < 8; bar++) {
      const chord = th.prog[bar % th.prog.length];
      const rhythm = bar === 7 ? 'x---x---' : bar % 2 === 0 ? rA : rB;
      const notes = [];
      for (let i = 0; i < 8; i++) {
        const c = rhythm[i];
        if (c === 'x') {
          if (bar >= 4 && bar < 6 && motif[bar - 4]) {
            notes.push(motif[bar - 4][i]);
            continue;
          }
          const strong = i === 0 || i === 4;
          if (strong || r() < 0.25) {
            const tones = chordDegs(chord).map((d) => d + 7);
            let best = tones[0];
            for (const t of tones) if (Math.abs(t - deg) < Math.abs(best - deg)) best = t;
            deg = best;
          } else {
            const steps = [-2, -1, -1, 1, 1, 2];
            deg += steps[Math.floor(r() * steps.length)];
            if (deg > 13) deg -= 2;
            if (deg < 4) deg += 2;
          }
          if (bar === 7 && i === 4) deg = 7;
          let n = degNote(deg);
          if (th.penta) {
            const pc = (n - th.root + 120) % 12;
            if (pc === 2 || pc === 8) n += 1;
          }
          let len = 1;
          while (i + len < 8 && rhythm[i + len] === '-') len++;
          notes.push({ n, len });
        } else notes.push(null);
      }
      if (bar < 2) motif.push(notes);
      melody.push(notes);
    }
    const chords = [];
    for (let bar = 0; bar < 8; bar++) {
      const c = th.prog[bar % th.prog.length];
      chords.push(chordDegs(c).map((d) => th.root + sc[d % 7] + 12 * Math.floor(d / 7)));
    }
    return { melody, chords, density: th.density };
  }

  class Sound {
    constructor() {
      this.ctx = null;
      this.musicOn = true;
      this.sfxOn = true;
      try {
        const v = localStorage.getItem('ek-music');
        if (v === '0') this.musicOn = false;
      } catch (e) {
        /* Speicher nicht verfügbar */
      }
      this.themeName = null;
      this.pending = null;
      this.step = 0;
      this.last = {};
      this.voices = 0;
    }

    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        const ctx = (this.ctx = new AC());
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -14;
        this.comp.ratio.value = 4;
        this.comp.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.comp);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = this.musicOn ? 0.33 : 0;
        this.musicBus.connect(this.master);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.55;
        this.sfxBus.connect(this.master);
        // Echo für Lead-Stimmen
        this.delay = ctx.createDelay(1);
        this.delay.delayTime.value = 0.28;
        this.fb = ctx.createGain();
        this.fb.gain.value = 0.28;
        this.delay.connect(this.fb);
        this.fb.connect(this.delay);
        this.delayOut = ctx.createGain();
        this.delayOut.gain.value = 0.35;
        this.delay.connect(this.delayOut);
        this.delayOut.connect(this.musicBus);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.nextTime = ctx.currentTime + 0.1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    toggleMusic() {
      this.musicOn = !this.musicOn;
      try {
        localStorage.setItem('ek-music', this.musicOn ? '1' : '0');
      } catch (e) {
        /* ignorieren */
      }
      if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.33 : 0, this.ctx.currentTime, 0.1);
    }

    setTheme(name) {
      name = String(name);
      if (name === this.themeName || name === this.pending) return;
      if (!this.themeName) this.startTheme(name);
      else this.pending = name;
    }

    startTheme(name) {
      this.themeName = name;
      this.pending = null;
      this.theme = THEMES[name];
      this.song = compose(this.theme);
      this.step = 0;
    }

    // Musik-Scheduler: wird jeden Frame aufgerufen und plant ~0,15 s voraus.
    update() {
      const ctx = this.ctx;
      if (!ctx || !this.theme || ctx.state !== 'running') return;
      if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05;
      while (this.nextTime < ctx.currentTime + 0.15) {
        if (this.pending && this.step % 16 === 0) this.startTheme(this.pending);
        this.playStep(this.step, this.nextTime);
        this.nextTime += 60 / this.theme.bpm / 4;
        this.step++;
      }
    }

    playStep(step, t) {
      const th = this.theme;
      const song = this.song;
      const bar = Math.floor(step / 16) % 8;
      const s16 = step % 16;
      const beat = 60 / th.bpm;
      const chord = song.chords[bar];
      const dr = DRUMS[th.drums];
      const hit = (pat) => pat && pat[s16] !== '.' && pat[s16] !== undefined;
      const vel = (pat) => (pat[s16] === 'o' ? 0.45 : 1);
      if (hit(dr.kick)) this.kick(t, vel(dr.kick));
      if (hit(dr.snare)) this.snare(t, vel(dr.snare));
      if (hit(dr.hat)) this.hat(t, vel(dr.hat) * 0.7);
      if (hit(dr.tom)) this.tom(t, vel(dr.tom));
      if (hit(dr.shaker)) this.shaker(t, vel(dr.shaker));

      // Bass
      if (s16 % 8 === 0 || (th.bass === 'sawBass' && s16 % 4 === 2)) {
        const n = chord[0] - 12 + (th.bass === 'sawBass' && s16 % 8 === 6 ? 12 : 0);
        this.bassNote(th.bass, t, midiHz(n), beat * (th.bass === 'sawBass' ? 0.45 : 1.6));
      }
      // Flächen
      if (th.pad && s16 === 0) for (const n of chord) this.pad(t, midiHz(n), beat * 4);
      // Arpeggio
      if (th.arp && s16 % 2 === 0) {
        const n = chord[(s16 / 2) % 3] + 12 + (s16 >= 8 ? 12 : 0);
        this.arp(t, midiHz(n), beat * 0.4, th.lead);
      }
      // Melodie (Achtel)
      if (s16 % 2 === 0) {
        const note = song.melody[bar][s16 / 2];
        // Erste Hälfte der Schleife sparsamer, damit das Thema „atmet“.
        if (note && (bar >= 2 || s16 % 4 === 0 || song.density > 0.6)) {
          this.leadNote(th.lead, t, midiHz(note.n), note.len * beat * 0.5);
        }
      }
    }

    env(g, t, a, peak, dur, rel) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }

    osc(type, freq, t, dur, dest, detune) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (detune) o.detune.value = detune;
      o.connect(dest);
      o.start(t);
      o.stop(t + dur + 0.05);
      return o;
    }

    leadNote(kind, t, f, dur) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.connect(this.musicBus);
      const send = ctx.createGain();
      send.gain.value = kind === 'synth' || kind === 'flute' ? 0.6 : 0.3;
      g.connect(send);
      send.connect(this.delay);
      switch (kind) {
        case 'flute': {
          this.env(g, t, 0.05, 0.22, dur + 0.1, 0.12);
          const o = this.osc('sine', f, t, dur + 0.1, g);
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();
          lfo.frequency.value = 5.2;
          lg.gain.value = f * 0.006;
          lfo.connect(lg);
          lg.connect(o.frequency);
          lfo.start(t);
          lfo.stop(t + dur + 0.2);
          const g2 = ctx.createGain();
          g2.gain.value = 0.25;
          g2.connect(g);
          this.osc('triangle', f * 2, t, dur + 0.1, g2);
          break;
        }
        case 'pluck': {
          this.env(g, t, 0.005, 0.25, Math.max(0.35, dur), 0.3);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(3500, t);
          lp.frequency.exponentialRampToValueAtTime(600, t + 0.3);
          lp.connect(g);
          this.osc('triangle', f, t, Math.max(0.35, dur), lp);
          this.osc('sawtooth', f, t, 0.2, lp, 5);
          break;
        }
        case 'horn': {
          this.env(g, t, 0.07, 0.16, dur + 0.12, 0.1);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(700, t);
          lp.frequency.linearRampToValueAtTime(1500, t + 0.12);
          lp.Q.value = 1.2;
          lp.connect(g);
          this.osc('sawtooth', f, t, dur + 0.12, lp, -6);
          this.osc('sawtooth', f, t, dur + 0.12, lp, 6);
          break;
        }
        case 'harpsi': {
          this.env(g, t, 0.003, 0.16, Math.max(0.4, dur), 0.35);
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 400;
          hp.connect(g);
          this.osc('square', f, t, Math.max(0.4, dur), hp);
          this.osc('sawtooth', f * 2, t, 0.25, hp, 3);
          break;
        }
        case 'lead': {
          this.env(g, t, 0.01, 0.13, dur + 0.05, 0.06);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 2400;
          lp.connect(g);
          this.osc('square', f, t, dur + 0.05, lp, -4);
          this.osc('sawtooth', f, t, dur + 0.05, lp, 4);
          break;
        }
        case 'synth': {
          this.env(g, t, 0.01, 0.13, dur + 0.08, 0.08);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.Q.value = 6;
          lp.frequency.setValueAtTime(4000, t);
          lp.frequency.exponentialRampToValueAtTime(900, t + dur + 0.05);
          lp.connect(g);
          this.osc('sawtooth', f, t, dur + 0.08, lp, -9);
          this.osc('sawtooth', f, t, dur + 0.08, lp, 9);
          break;
        }
      }
    }

    arp(t, f, dur, kind) {
      const g = this.ctx.createGain();
      g.connect(this.musicBus);
      this.env(g, t, 0.004, 0.05, dur, dur * 0.7);
      const type = kind === 'harpsi' ? 'square' : 'sawtooth';
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = kind === 'harpsi' ? 3000 : 2200;
      lp.connect(g);
      this.osc(type, f, t, dur, lp);
    }

    pad(t, f, dur) {
      const g = this.ctx.createGain();
      g.connect(this.musicBus);
      this.env(g, t, 0.35, 0.045, dur, 0.4);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1100;
      lp.connect(g);
      this.osc('sawtooth', f, t, dur, lp, -8);
      this.osc('sawtooth', f, t, dur, lp, 8);
    }

    bassNote(kind, t, f, dur) {
      const g = this.ctx.createGain();
      g.connect(this.musicBus);
      if (kind === 'sawBass') {
        this.env(g, t, 0.005, 0.22, dur, dur * 0.5);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, t);
        lp.frequency.exponentialRampToValueAtTime(200, t + dur);
        lp.connect(g);
        this.osc('sawtooth', f, t, dur, lp);
      } else if (kind === 'pluckBass') {
        this.env(g, t, 0.005, 0.32, dur, dur * 0.8);
        this.osc('triangle', f, t, dur, g);
      } else {
        this.env(g, t, 0.02, 0.36, dur, dur * 0.5);
        this.osc('sine', f, t, dur, g);
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.3;
        g2.connect(g);
        this.osc('triangle', f * 2, t, dur, g2);
      }
    }

    noiseSrc(t, dur, dest) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noise;
      n.connect(dest);
      n.start(t, Math.random() * 0.5);
      n.stop(t + dur + 0.02);
      return n;
    }

    kick(t, v, dest) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.connect(dest || this.musicBus);
      g.gain.setValueAtTime(0.9 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.3);
    }

    snare(t, v) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.connect(this.musicBus);
      g.gain.setValueAtTime(0.45 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1900;
      bp.Q.value = 0.8;
      bp.connect(g);
      this.noiseSrc(t, 0.17, bp);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.25 * v, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      g2.connect(this.musicBus);
      this.osc('triangle', 190, t, 0.08, g2);
    }

    hat(t, v) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.connect(this.musicBus);
      g.gain.setValueAtTime(0.18 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      hp.connect(g);
      this.noiseSrc(t, 0.05, hp);
    }

    shaker(t, v) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.connect(this.musicBus);
      g.gain.setValueAtTime(0.1 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5200;
      bp.connect(g);
      this.noiseSrc(t, 0.07, bp);
    }

    tom(t, v) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.connect(this.musicBus);
      g.gain.setValueAtTime(0.55 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(68, t + 0.25);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.32);
    }

    // ------------------------------------------------------------ Soundeffekte

    can(name, gap) {
      if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return false;
      const now = this.ctx.currentTime;
      if (this.last[name] && now - this.last[name] < (gap || 0.04)) return false;
      if (this.voices > 28) return false;
      this.last[name] = now;
      return true;
    }

    out(pan, vol) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.value = vol;
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        p.connect(this.sfxBus);
      } else g.connect(this.sfxBus);
      this.voices++;
      setTimeout(() => this.voices--, 400);
      return g;
    }

    sfx(name, x) {
      const pan = x == null ? 0 : ((x / EK.data.W) * 2 - 1) * 0.7;
      if (!this.can(name, name === 'explosion' ? 0.06 : 0.035)) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.005;
      const o = this.out(pan, 1);
      const sweep = (type, f0, f1, dur, vol, dest) => {
        const g = ctx.createGain();
        g.connect(dest || o);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      };
      const noise = (type, freq, dur, vol, q) => {
        const g = ctx.createGain();
        g.connect(o);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        if (q) f.Q.value = q;
        f.connect(g);
        this.noiseSrc(t, dur, f);
        return f;
      };
      switch (name) {
        case 'bonk':
          sweep('sine', 260, 90, 0.12, 0.35);
          noise('lowpass', 900, 0.06, 0.25);
          break;
        case 'clang':
          sweep('square', 1400, 900, 0.09, 0.07);
          sweep('triangle', 2300, 1800, 0.12, 0.08);
          noise('highpass', 3000, 0.05, 0.12);
          break;
        case 'slash':
          sweep('sawtooth', 900, 2400, 0.12, 0.07);
          noise('bandpass', 4000, 0.12, 0.15, 2);
          break;
        case 'thud':
          sweep('sine', 160, 50, 0.18, 0.4);
          noise('lowpass', 500, 0.1, 0.25);
          break;
        case 'whoosh': {
          const f = noise('bandpass', 600, 0.22, 0.25, 3);
          f.frequency.setValueAtTime(300, t);
          f.frequency.exponentialRampToValueAtTime(1600, t + 0.2);
          break;
        }
        case 'twang':
          sweep('triangle', 520, 260, 0.14, 0.18);
          noise('highpass', 2500, 0.05, 0.08);
          break;
        case 'shot':
          noise('lowpass', 2600, 0.14, 0.45);
          sweep('square', 180, 50, 0.08, 0.15);
          break;
        case 'musket':
          noise('lowpass', 1500, 0.3, 0.5);
          sweep('sine', 120, 40, 0.25, 0.4);
          break;
        case 'cannon':
          noise('lowpass', 700, 0.5, 0.6);
          sweep('sine', 90, 30, 0.45, 0.7);
          break;
        case 'rocket': {
          const f = noise('bandpass', 1200, 0.35, 0.3, 1.5);
          f.frequency.setValueAtTime(2400, t);
          f.frequency.exponentialRampToValueAtTime(500, t + 0.35);
          break;
        }
        case 'zap':
          sweep('sawtooth', 1800, 300, 0.16, 0.1);
          sweep('square', 900, 200, 0.12, 0.05);
          break;
        case 'laser':
          sweep('sawtooth', 2400, 180, 0.22, 0.12);
          sweep('sine', 1200, 90, 0.25, 0.18);
          break;
        case 'tick':
          noise('highpass', 3500, 0.03, 0.12);
          break;
        case 'explosion':
          noise('lowpass', 900, 0.7, 0.7);
          sweep('sine', 110, 30, 0.6, 0.6);
          break;
        case 'smallboom':
          noise('lowpass', 1200, 0.35, 0.45);
          sweep('sine', 140, 40, 0.3, 0.35);
          break;
        case 'thunder':
          noise('lowpass', 2200, 0.08, 0.6);
          noise('lowpass', 400, 1.1, 0.55);
          break;
        case 'rumble':
          noise('lowpass', 220, 1.6, 0.5);
          break;
        case 'plane':
          sweep('sawtooth', 70, 110, 2.2, 0.05);
          noise('lowpass', 500, 2.4, 0.18);
          break;
        case 'charge':
          sweep('sawtooth', 120, 2000, 0.5, 0.08);
          sweep('sine', 240, 3000, 0.5, 0.08);
          break;
        case 'volley': {
          const f = noise('bandpass', 1500, 0.8, 0.25, 1.2);
          f.frequency.setValueAtTime(800, t);
          f.frequency.linearRampToValueAtTime(2600, t + 0.7);
          break;
        }
        case 'death':
          sweep('triangle', 420, 120, 0.2, 0.1);
          break;
        case 'click':
          sweep('square', 900, 1200, 0.04, 0.06);
          break;
        case 'build':
          noise('bandpass', 1800, 0.05, 0.25, 3);
          sweep('square', 300, 200, 0.06, 0.06);
          break;
        case 'coin':
          sweep('square', 1320, 1320, 0.07, 0.06);
          setTimeout(() => this.ctx && this.blip(1760, 0.12, pan), 70);
          break;
        case 'deny':
          sweep('square', 140, 110, 0.14, 0.07);
          break;
        case 'evolve':
          [0, 4, 7, 12, 16].forEach((n, i) => setTimeout(() => this.ctx && this.blip(523 * Math.pow(2, n / 12), 0.25, pan, 'sawtooth'), i * 90));
          break;
        case 'elite':
          [0, 7, 12].forEach((n, i) => setTimeout(() => this.ctx && this.blip(659 * Math.pow(2, n / 12), 0.2, pan, 'square'), i * 80));
          break;
        case 'win':
          [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => setTimeout(() => this.ctx && this.blip(392 * Math.pow(2, n / 12), 0.35, 0, 'sawtooth'), i * 130));
          break;
      }
    }

    blip(f, dur, pan, type) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.005;
      const o = this.out(pan || 0, 1);
      const g = ctx.createGain();
      g.connect(o);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3000;
      lp.connect(g);
      const osc = ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.value = f;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    // Übersetzt Simulationsereignisse in Klänge.
    handleEvents(events, humanTeams) {
      if (!this.ctx) return;
      for (const ev of events) {
        switch (ev.type) {
          case 'fire': {
            const m = { stone: 'whoosh', rock: 'whoosh', firepot: 'whoosh', arrow: 'twang', bolt: 'twang', bullet: 'shot', cannonball: 'cannon', shell: 'cannon', rocket: 'rocket', plasma: 'zap', laser: 'laser' };
            this.sfx(m[ev.proj] || 'whoosh', ev.x);
            break;
          }
          case 'impact':
            if (ev.splash > 0) this.sfx(ev.splash >= 36 ? 'explosion' : 'smallboom', ev.x);
            else if (ev.proj === 'stone' || ev.proj === 'rock') this.sfx('thud', ev.x);
            else if (ev.proj === 'arrow' || ev.proj === 'bolt') this.sfx('tick', ev.x);
            break;
          case 'melee': {
            const w = ev.weapon;
            const name = w === 'blade' ? 'slash' : w === 'sword' || w === 'sabre' || w === 'spear' || w === 'lance' ? 'clang' : ev.mount ? 'thud' : 'bonk';
            this.sfx(name, ev.x);
            break;
          }
          case 'death':
            this.sfx('death', ev.unit.x);
            break;
          case 'order':
            if (humanTeams[ev.team]) this.sfx('click', ev.team === 0 ? 200 : 1080);
            break;
          case 'build':
            this.sfx('build', ev.team === 0 ? 100 : 1180);
            break;
          case 'sell':
            this.sfx('coin', ev.x);
            break;
          case 'deny':
            if (humanTeams[ev.team]) this.sfx('deny', ev.team === 0 ? 200 : 1080);
            break;
          case 'evolve':
            this.sfx('evolve', ev.team === 0 ? 100 : 1180);
            break;
          case 'elite':
            this.sfx('elite', ev.team === 0 ? 100 : 1180);
            break;
          case 'special': {
            const m = { boulders: 'rumble', lightning: 'thunder', arrows: 'volley', cannonade: 'cannon', airstrike: 'plane', orbital: 'charge' };
            this.sfx(m[ev.kind], ev.team === 0 ? 300 : 980);
            break;
          }
          case 'strike':
            if (ev.kind === 'lightning') this.sfx('thunder', ev.x);
            else if (ev.kind === 'laser') this.sfx('zap', ev.x);
            else this.sfx('tick', ev.x);
            break;
          case 'crush':
            this.sfx('thud', ev.x);
            break;
          case 'win':
            this.sfx('win');
            break;
        }
      }
    }
  }

  EK.Sound = Sound;
  EK.audio = { THEMES, compose };
})((globalThis.EK = globalThis.EK || {}));
