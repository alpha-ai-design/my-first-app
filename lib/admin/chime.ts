// New-order sounds, made with the Web Audio API (no sound files).
// Browsers only allow sound after the user has interacted with the page, so the owner screen
// unlocks it on the first tap or key press (and straight away if the page already had one,
// e.g. right after signing in).

let ctx: AudioContext | null = null;
const listeners = new Set<(unlocked: boolean) => void>();

export const isSoundUnlocked = () => ctx?.state === "running";

// Called with true/false whenever sound becomes available or gets blocked again (e.g. iOS
// suspends audio after a phone call). Returns an unsubscribe function.
export function onSoundChange(listener: (unlocked: boolean) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

// Try to start sound. Only succeeds during (or after) a user interaction.
export async function unlockAudio(): Promise<boolean> {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      ctx.addEventListener("statechange", () => listeners.forEach((l) => l(isSoundUnlocked())));
    }
    await ctx.resume();
    tone(ctx, 0, 1, 0.001, "sine", 0.05); // silent blip finishes the unlock on iOS
  } catch {
    // No audio support; the screen still works.
  }
  const unlocked = isSoundUnlocked();
  listeners.forEach((l) => l(unlocked));
  return unlocked;
}

function tone(ac: AudioContext, start: number, freq: number, volume: number, type: OscillatorType, length: number) {
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

// Normal: a two-note "ding-dong". Urgent: louder, harsher, repeated beeps.
export function playChime(urgent: boolean) {
  if (!ctx) return;
  void ctx.resume();
  if (urgent) {
    for (let i = 0; i < 6; i++) tone(ctx, i * 0.22, i % 2 ? 1046 : 1318, 0.5, "square", 0.16);
  } else {
    tone(ctx, 0, 1318, 0.35, "sine", 0.9);
    tone(ctx, 0.35, 988, 0.35, "sine", 1.2);
  }
}
