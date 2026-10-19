/**
 * Incoming/outgoing call ringtone, synthesised with Web Audio so no asset is
 * needed. `startRingtone` must be called from a user gesture (button click) so
 * browsers allow audio; it loops a soft two-burst "ring ring" until
 * `stopRingtone` is called (call answered or ended).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let loop: number | undefined;
let active: OscillatorNode[] = [];

const LOOP_MS = 3000;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.0001;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3400;
  master.connect(filter);
  filter.connect(ctx.destination);
  return ctx;
}

/** One bell note with a soft attack/decay and a quiet octave harmonic. */
function note(at: number, freq: number, duration: number, level: number) {
  if (!ctx || !master) return;
  const fundamental = ctx.createOscillator();
  const harmonic = ctx.createOscillator();
  const gain = ctx.createGain();
  fundamental.type = "sine";
  harmonic.type = "sine";
  fundamental.frequency.setValueAtTime(freq, at);
  harmonic.frequency.setValueAtTime(freq * 2, at);

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.value = 0.22;

  fundamental.connect(gain);
  harmonic.connect(harmonicGain);
  harmonicGain.connect(gain);
  gain.connect(master);

  fundamental.start(at);
  harmonic.start(at);
  fundamental.stop(at + duration + 0.03);
  harmonic.stop(at + duration + 0.03);
  active.push(fundamental, harmonic);
  fundamental.onended = () => {
    active = active.filter((o) => o !== fundamental && o !== harmonic);
  };
}

/** A double "ring ring" burst (~1.5s), then silence until the next loop. */
function ringOnce() {
  if (!ctx) return;
  const t = ctx.currentTime;
  note(t + 0.0, 784, 0.5, 0.1); // G5
  note(t + 0.24, 987.77, 0.36, 0.07); // B5
  note(t + 0.86, 784, 0.5, 0.1); // G5
  note(t + 1.1, 587.33, 0.62, 0.07); // D5
}

export function startRingtone() {
  const audio = ensureContext();
  if (!audio) return;
  // Restart cleanly if a tone is somehow already running.
  if (loop !== undefined) {
    window.clearInterval(loop);
    loop = undefined;
  }
  void audio.resume().catch(() => {});
  // Cut any lingering notes from a previous ring before starting the loop.
  const now = audio.currentTime;
  for (const osc of active) {
    try {
      osc.stop(now);
    } catch {
      /* already stopped */
    }
  }
  active = [];
  if (master) {
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.8, now + 0.06);
  }
  ringOnce();
  loop = window.setInterval(ringOnce, LOOP_MS);
}

export function stopRingtone() {
  if (loop !== undefined) {
    window.clearInterval(loop);
    loop = undefined;
  }
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  for (const osc of active) {
    try {
      osc.stop(now + 0.1);
    } catch {
      /* already stopped */
    }
  }
  active = [];
}
