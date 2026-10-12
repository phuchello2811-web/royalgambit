// Âm thanh nước đi, tạo trực tiếp bằng Web Audio (không cần file âm thanh).

const Sound = (() => {
  let ctx = null;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(a, freq, start, dur, type, gain) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(a.destination);
    o.start(start);
    o.stop(start + dur);
  }

  // Tiếng "cốc" gỗ: nhiễu ngắn qua bộ lọc
  function knock(a, start, freq, gain) {
    const len = Math.floor(a.sampleRate * 0.06);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf;
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination);
    src.start(start);
  }

  function play(kind) {
    if (!Profile.prefs().sound) return;
    const a = audio();
    if (!a) return;
    const t = a.currentTime + 0.01;
    if (kind === 'move') { knock(a, t, 1800, 1.6); tone(a, 220, t, 0.06, 'triangle', 0.08); }
    if (kind === 'capture') { knock(a, t, 900, 2.2); knock(a, t + 0.035, 1400, 1.2); tone(a, 140, t, 0.1, 'triangle', 0.12); }
    if (kind === 'check') { knock(a, t, 1600, 1.4); tone(a, 740, t, 0.12, 'sine', 0.08); tone(a, 988, t + 0.1, 0.16, 'sine', 0.08); }
    if (kind === 'end') [523, 659, 784].forEach((f, i) => tone(a, f, t + i * 0.09, 0.5, 'sine', 0.07));
    if (kind === 'ok') { tone(a, 784, t, 0.14, 'sine', 0.09); tone(a, 1175, t + 0.08, 0.26, 'sine', 0.09); }
    if (kind === 'bad') { tone(a, 196, t, 0.22, 'square', 0.04); tone(a, 147, t + 0.1, 0.28, 'square', 0.04); }
  }

  return { play, unlock: audio };
})();
