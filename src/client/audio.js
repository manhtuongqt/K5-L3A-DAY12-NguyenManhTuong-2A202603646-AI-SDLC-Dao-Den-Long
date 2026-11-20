// Âm thanh tự tổng hợp bằng WebAudio: không dùng file ngoài.
// Nhạc nền đêm nhẹ (pad + nốt hộp nhạc có vang) và các hiệu ứng.
export function createAudio(getSettings) {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuf = null;
  let windGain = null;
  let timer = null;
  let nextNoteT = 0;
  let step = 0;
  let night = 1;
  let ducked = false;
  let musicOn = false;

  const A_MINOR = [0, 3, 5, 7, 10, 12, 15]; // bậc ngũ cung/dorian nhẹ (nửa cung từ gốc)
  const ROOTS = { 1: 220, 2: 246.94, 3: 196 };
  const CHORDS = [[0, 7, 15], [-4, 3, 12], [-9, 0, 7], [-2, 5, 10]]; // bán cung so với gốc
  const hz = (root, semi) => root * Math.pow(2, semi / 12);

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch { return false; }
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    sfxBus.gain.value = 0.9;
    // vang đơn giản: delay có hồi tiếp lọc thấp
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    delay.connect(lp); lp.connect(fb); fb.connect(delay);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    musicBus.connect(master);
    musicBus.connect(delay);
    delay.connect(wet); wet.connect(master);
    sfxBus.connect(master);
    // nhiễu trắng dùng chung
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolume();
    return true;
  }

  function applyVolume() {
    if (!master) return;
    const v = getSettings().volume;
    master.gain.setTargetAtTime(v * v, ctx.currentTime, 0.03);
  }

  function tone({ type = 'sine', f0, f1 = f0, dur = 0.15, gain = 0.2, at = 0, attack = 0.005, bus = sfxBus, detune = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.3, type = 'bandpass', f0 = 800, f1 = f0, q = 1, gain = 0.2, at = 0, attack = 0.01 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t0, Math.random());
    s.stop(t0 + dur + 0.05);
  }

  const SFX = {
    click: () => tone({ type: 'triangle', f0: 660, f1: 880, dur: 0.07, gain: 0.12 }),
    pickup: () => { tone({ f0: 880, f1: 1320, dur: 0.09, gain: 0.16 }); tone({ f0: 1760, dur: 0.1, gain: 0.06, at: 0.04 }); },
    deposit: () => { tone({ type: 'triangle', f0: 523, dur: 0.12, gain: 0.14 }); tone({ type: 'triangle', f0: 659, dur: 0.14, gain: 0.12, at: 0.07 }); },
    refuel: () => {
      noise({ dur: 0.35, type: 'bandpass', f0: 700, f1: 1400, q: 2, gain: 0.09 });
      [660, 880, 1100].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.2, gain: 0.1, at: i * 0.07 }));
    },
    lanternOut: () => {
      noise({ dur: 0.45, type: 'lowpass', f0: 1800, f1: 160, gain: 0.16 });
      tone({ type: 'triangle', f0: 440, f1: 110, dur: 0.5, gain: 0.12 });
    },
    lantern: () => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.9, gain: 0.15, at: i * 0.09, attack: 0.02 }));
      tone({ type: 'sine', f0: 130.8, dur: 1.2, gain: 0.2 });
    },
    pulse: () => {
      tone({ f0: 900, f1: 180, dur: 0.45, gain: 0.2 });
      tone({ type: 'triangle', f0: 1350, f1: 360, dur: 0.4, gain: 0.08 });
      noise({ dur: 0.5, type: 'bandpass', f0: 500, f1: 3200, q: 0.8, gain: 0.14 });
    },
    hit: () => {
      tone({ type: 'sawtooth', f0: 150, f1: 45, dur: 0.35, gain: 0.25 });
      noise({ dur: 0.25, type: 'lowpass', f0: 1400, f1: 200, gain: 0.25 });
    },
    jump: () => tone({ f0: 330, f1: 700, dur: 0.12, gain: 0.12 }),
    dash: () => {
      noise({ dur: 0.22, type: 'highpass', f0: 800, f1: 4200, q: 0.6, gain: 0.2 });
      tone({ type: 'triangle', f0: 500, f1: 1100, dur: 0.16, gain: 0.07 });
    },
    win: () => {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.5, gain: 0.17, at: i * 0.13 }));
      tone({ type: 'sine', f0: 261.6, dur: 1.6, gain: 0.18, at: 0.5 });
    },
    lose: () => {
      [392, 349.23, 311.13, 261.63].forEach((f, i) => tone({ type: 'sine', f0: f, f1: f * 0.97, dur: 0.7, gain: 0.18, at: i * 0.25 }));
      tone({ type: 'sawtooth', f0: 98, dur: 1.4, gain: 0.07, at: 0.3 });
    },
    shade: () => {
      tone({ type: 'sawtooth', f0: 90, f1: 55, dur: 0.8, gain: 0.12, attack: 0.15 });
      tone({ type: 'sine', f0: 180, f1: 120, dur: 0.8, gain: 0.1, attack: 0.2, detune: 40 });
    },
    tick: () => tone({ type: 'square', f0: 1000, dur: 0.06, gain: 0.07 }),
    tickFinal: () => tone({ type: 'square', f0: 1500, dur: 0.18, gain: 0.1 }),
    windWarn: () => noise({ dur: 2.0, type: 'bandpass', f0: 250, f1: 1400, q: 2.5, gain: 0.2, attack: 1.0 }),
    charm: () => { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.35, gain: 0.12, at: i * 0.06 })); },
    steal: () => { tone({ f0: 900, f1: 220, dur: 0.5, gain: 0.15, detune: 20 }); noise({ dur: 0.3, type: 'highpass', f0: 2500, f1: 900, gain: 0.1 }); },
    drop: () => tone({ f0: 1200, f1: 600, dur: 0.15, gain: 0.1 }),
    pad: () => tone({ type: 'triangle', f0: 440, f1: 1320, dur: 0.18, gain: 0.14 }),
  };

  // nhạc nền: lịch phát trước 0.7 s
  function scheduleMusic() {
    if (!ctx || !musicOn) return;
    const beat = 0.62;
    const root = ROOTS[night] || 220;
    while (nextNoteT < ctx.currentTime + 0.7) {
      const at = nextNoteT - ctx.currentTime;
      const bar = Math.floor(step / 8);
      const chord = CHORDS[bar % CHORDS.length];
      if (step % 8 === 0) {
        // pad: ba nốt dài, hơi lệch cao độ
        chord.forEach((semi, i) => tone({
          type: 'triangle', f0: hz(root / 2, semi + 12), dur: beat * 8.5, gain: 0.05, at, attack: 1.2, bus: musicBus, detune: (i - 1) * 6,
        }));
        tone({ type: 'sine', f0: hz(root / 4, chord[0] + 12), dur: beat * 8, gain: 0.09, at, attack: 0.8, bus: musicBus });
      }
      // nốt hộp nhạc thưa, ngẫu nhiên theo ngũ cung
      if (Math.random() < 0.55) {
        const semi = A_MINOR[Math.floor(Math.random() * A_MINOR.length)] + (Math.random() < 0.3 ? 12 : 0);
        tone({ type: 'sine', f0: hz(root, semi), dur: 1.4, gain: 0.07, at, attack: 0.01, bus: musicBus });
        tone({ type: 'sine', f0: hz(root, semi + 12), dur: 0.8, gain: 0.025, at, attack: 0.01, bus: musicBus });
      }
      step++;
      nextNoteT += beat;
    }
  }

  return {
    init: ensure,
    get ready() { return !!ctx; },
    applyVolume,
    sfx(name) {
      if (!ensure()) return;
      const f = SFX[name];
      if (f) f();
    },
    startMusic(n = 1) {
      if (!ensure()) return;
      night = n;
      if (musicOn) return;
      musicOn = true;
      nextNoteT = ctx.currentTime + 0.1;
      step = 0;
      timer = setInterval(scheduleMusic, 250);
      scheduleMusic();
    },
    setNight(n) { night = n; },
    stopMusic() {
      musicOn = false;
      if (timer) { clearInterval(timer); timer = null; }
    },
    duck(on) {
      if (!ctx || ducked === on) return;
      ducked = on;
      musicBus.gain.setTargetAtTime(on ? 0.15 : 0.55, ctx.currentTime, 0.15);
    },
    // gió thổi liên tục khi wind.active
    wind(on) {
      if (!ensure()) return;
      if (on && !windGain) {
        const s = ctx.createBufferSource();
        s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.9;
        windGain = ctx.createGain();
        windGain.gain.value = 0.0001;
        s.connect(f); f.connect(windGain); windGain.connect(sfxBus);
        s.start();
        windGain.src = s;
        windGain.gain.setTargetAtTime(0.16, ctx.currentTime, 0.4);
      } else if (!on && windGain) {
        const w = windGain;
        windGain = null;
        w.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
        setTimeout(() => { try { w.src.stop(); } catch { /* đã dừng */ } }, 1500);
      }
    },
  };
}
