let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

// Creates a bell-like tone with natural exponential decay
function bell(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  peakGain: number,
  decayTime: number
) {
  // Fundamental (sine)
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, startTime);
  g1.gain.setValueAtTime(0, startTime);
  g1.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
  g1.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime);
  osc1.connect(g1);
  g1.connect(dest);
  osc1.start(startTime);
  osc1.stop(startTime + decayTime + 0.05);

  // 2nd harmonic (x2.756 — inharmonic like real bells)
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq * 2.756, startTime);
  g2.gain.setValueAtTime(0, startTime);
  g2.gain.linearRampToValueAtTime(peakGain * 0.55, startTime + 0.012);
  g2.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime * 0.6);
  osc2.connect(g2);
  g2.connect(dest);
  osc2.start(startTime);
  osc2.stop(startTime + decayTime * 0.65);

  // 3rd partial (x5.404 — gives the "ping" brightness)
  const osc3 = ctx.createOscillator();
  const g3 = ctx.createGain();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(freq * 5.404, startTime);
  g3.gain.setValueAtTime(0, startTime);
  g3.gain.linearRampToValueAtTime(peakGain * 0.25, startTime + 0.008);
  g3.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime * 0.25);
  osc3.connect(g3);
  g3.connect(dest);
  osc3.start(startTime);
  osc3.stop(startTime + decayTime * 0.3);
}

// Deep bass thump at the start — adds "weight"
function bassThump(ctx: AudioContext, dest: AudioNode, startTime: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(90, startTime);
  osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.18);
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(1.0, startTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);
  osc.connect(g);
  g.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + 0.25);
}

// Rich, deep, pleasant notification chime:
// Bass thump → low bell → mid bell → high bell (chord arpeggiated upward)
export function playNotificationSound() {
  try {
    const ctx = getAudioCtx();

    const doPlay = () => {
      const t = ctx.currentTime;

      // Master limiter/gain
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.85, t);
      master.connect(ctx.destination);

      // 0.00 — deep bass thump for weight
      bassThump(ctx, master, t + 0.00);

      // 0.02 — low bell: D3 (146.83 Hz) — the "heavy" body
      bell(ctx, master, 146.83, t + 0.02, 0.80, 2.8);

      // 0.18 — mid bell: A3 (220 Hz) — warmth
      bell(ctx, master, 220.00, t + 0.18, 0.70, 2.4);

      // 0.36 — high bell: D4 (293.66 Hz) — melody
      bell(ctx, master, 293.66, t + 0.36, 0.65, 2.8);

      // 0.52 — top bell: F#4 (369.99 Hz) — completes the chord
      bell(ctx, master, 369.99, t + 0.52, 0.55, 3.0);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(doPlay);
    } else {
      doPlay();
    }
  } catch (e) {
    console.warn("[sound] playNotificationSound error:", e);
  }
}
