/**
 * High-performance audio utilities for Gemini Live real-time streaming
 * Handles 16kHz microphone capture and 24kHz response playback with zero clipping.
 */

export interface PCMDecodeState {
  leftoverByte: number | null;
}

/**
 * Resamples Float32 audio buffer from source sample rate to target sample rate (16000 Hz)
 * Uses high-precision linear interpolation with clipping protection
 */
export function resampleAudio(
  sourceBuffer: Float32Array,
  sourceRate: number,
  targetRate: number = 16000
): Float32Array {
  if (sourceRate === targetRate || sourceBuffer.length === 0) {
    return sourceBuffer;
  }

  const ratio = sourceRate / targetRate;
  const newLength = Math.round(sourceBuffer.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const indexFloor = Math.floor(srcIndex);
    const indexCeil = Math.min(sourceBuffer.length - 1, indexFloor + 1);
    const weight = srcIndex - indexFloor;
    const val = sourceBuffer[indexFloor] * (1 - weight) + sourceBuffer[indexCeil] * weight;
    result[i] = Math.max(-1.0, Math.min(1.0, val));
  }

  return result;
}

/**
 * Converts Float32Array [-1.0, 1.0] to 16-bit signed PCM ArrayBuffer (Little Endian)
 */
export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1.0, Math.min(1.0, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

/**
 * Fast ArrayBuffer to Base64 encoder avoiding call stack overflow
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;

  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    const chunk = bytes.subarray(i, end);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }

  return btoa(binary);
}

/**
 * Decodes 24kHz 16-bit PCM Little Endian base64 string into Float32Array
 * Maintains carry-over state to ensure 100% 2-byte sample alignment across network chunks
 */
export function decodePCM16ToFloat32(
  base64Data: string,
  state: PCMDecodeState
): Float32Array {
  const binaryString = atob(base64Data);
  let totalBytes = binaryString.length;

  // Include leftover byte from previous chunk if present
  let hasLeftover = state.leftoverByte !== null;
  if (hasLeftover) {
    totalBytes += 1;
  }

  const sampleCount = Math.floor(totalBytes / 2);
  const float32Data = new Float32Array(sampleCount);

  let byteOffset = 0;
  let sampleIndex = 0;

  // Handle previous leftover byte + first byte of this chunk
  if (hasLeftover && totalBytes >= 2) {
    const byte1 = state.leftoverByte!;
    const byte2 = binaryString.charCodeAt(0);
    state.leftoverByte = null;

    const uint16 = (byte2 << 8) | byte1;
    const int16 = uint16 >= 0x8000 ? uint16 - 0x10000 : uint16;
    float32Data[sampleIndex++] = int16 / 32768.0;
    byteOffset = 1; // Used 1 byte from binaryString
  }

  // Process pairs of bytes
  const limit = binaryString.length - ((binaryString.length - byteOffset) % 2);
  for (; byteOffset < limit; byteOffset += 2) {
    const byte1 = binaryString.charCodeAt(byteOffset);
    const byte2 = binaryString.charCodeAt(byteOffset + 1);
    const uint16 = (byte2 << 8) | byte1;
    const int16 = uint16 >= 0x8000 ? uint16 - 0x10000 : uint16;
    float32Data[sampleIndex++] = int16 / 32768.0;
  }

  // Save trailing odd byte if any
  if (byteOffset < binaryString.length) {
    state.leftoverByte = binaryString.charCodeAt(byteOffset);
  }

  return float32Data;
}

/**
 * Creates an AudioBuffer from Float32Array at the specified sample rate
 * Optionally applies micro edge fade-in/out (1ms) to eliminate boundary clicks if desired
 */
export function createAudioBufferFromFloat32(
  audioCtx: AudioContext,
  float32Data: Float32Array,
  sampleRate: number = 24000,
  applyEdgeSmoothing: boolean = false
): AudioBuffer {
  const buffer = audioCtx.createBuffer(1, float32Data.length, sampleRate);

  if (applyEdgeSmoothing && float32Data.length > 32) {
    // 16 samples fade-in and fade-out to prevent pop artifacts on underruns
    const fadeSamples = Math.min(24, Math.floor(float32Data.length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const factor = i / fadeSamples;
      float32Data[i] *= factor;
      float32Data[float32Data.length - 1 - i] *= factor;
    }
  }

  buffer.getChannelData(0).set(float32Data);
  return buffer;
}

/**
 * Computes root-mean-square (RMS) volume from float32 samples
 */
export function calculateRMS(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}
