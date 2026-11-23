/**
 * Blends RNNoise's output with the original mic signal, which is what makes the "Strength" slider
 * and the gentler "Local (light)" mode possible.
 *
 * RNNoise's output lags its input by two frames (measured: ~960 samples = 20 ms at 48 kHz), so the
 * original has to be delayed by exactly the same amount before the two are mixed - otherwise the
 * mix would have comb-filter notches and sound phasey. The delay costs no extra latency: the
 * denoised path is already that late.
 */

/** RNNoise's input-to-output delay, in frames. Measured, not documented. */
export const DENOISE_DELAY_FRAMES = 2

/** Light mode: how much of the untouched voice is put back while someone is speaking (0..1). */
const LIGHT_RESTORE = 0.4
/** Light mode: how slowly the restored amount fades after speech stops, per frame (closer to 1 = slower). */
const LIGHT_RELEASE = 0.8

interface Pending {
  dry: Float32Array
  vad: number
}

export class DenoiseMixer {
  private readonly frameSize: number
  private readonly light: boolean
  private readonly queue: Pending[] = []
  private speechAmount = 0 // light mode's smoothed "how much to restore", per frame
  private lastRestore = 0

  constructor(frameSize: number, light: boolean) {
    this.frameSize = frameSize
    this.light = light
  }

  /**
   * `frame` holds RNNoise's output for this call; the mixed result is written back into it.
   * `dry` is a copy of the frame taken *before* RNNoise processed it, `vad` RNNoise's
   * voice-activity probability for it, and `strength` the slider (0 = untouched mic, 1 = full).
   */
  mix(frame: Float32Array, dry: Float32Array, vad: number, strength: number): void {
    this.queue.push({ dry, vad })
    // Until the delay line has filled, the output has no matching original: treat it as silence.
    const aligned = this.queue.length > DENOISE_DELAY_FRAMES ? this.queue.shift()! : null

    let restore = 0
    if (this.light) {
      // Frames that RNNoise judged to be speech (looking a little ahead, so word onsets and tails
      // are protected) get some of the original voice back, which undoes its habit of muting soft
      // consonants and word endings. Non-speech frames stay fully denoised.
      let speech = aligned ? aligned.vad : 0
      for (const p of this.queue) speech = Math.max(speech, p.vad)
      const target = LIGHT_RESTORE * speech
      this.speechAmount = target > this.speechAmount ? target : this.speechAmount * LIGHT_RELEASE + target * (1 - LIGHT_RELEASE)
      restore = this.speechAmount
    }

    const n = this.frameSize
    const prevRestore = this.lastRestore
    for (let i = 0; i < n; i++) {
      const d = aligned ? aligned.dry[i] : 0
      const w = frame[i]
      // Ramp the restore amount across the frame so it never steps (a step would click).
      const r = prevRestore + (restore - prevRestore) * ((i + 1) / n)
      const processed = w + r * (d - w)
      frame[i] = d + strength * (processed - d)
    }
    this.lastRestore = restore
  }
}
