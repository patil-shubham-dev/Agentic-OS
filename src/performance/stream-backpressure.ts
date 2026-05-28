import { getRuntimeConfig } from "@/runtime/config/runtime-mode"

const LOG_PREFIX = "[StreamBackpressure]"

interface FrameBatch {
  tokens: string[]
  reasoning: string[]
  flushToken: AbortController
}

let currentBatch: FrameBatch | null = null
let rafId: number | null = null
let frameCount = 0
let droppedFrames = 0
let lastFrameTime = 0

const TARGET_FPS = 60
const FRAME_MS = 1000 / TARGET_FPS

type FrameCallback = (tokens: string[], reasoning: string[]) => void

let frameCallback: FrameCallback | null = null

export function setStreamFrameCallback(cb: FrameCallback | null): void {
  frameCallback = cb
}

function flushFrame(timestamp: number): void {
  rafId = null

  if (!currentBatch || currentBatch.tokens.length === 0) {
    lastFrameTime = timestamp
    return
  }

  const elapsed = timestamp - lastFrameTime
  if (elapsed < FRAME_MS - 2) {
    droppedFrames++
    scheduleNext()
    return
  }

  frameCount++
  lastFrameTime = timestamp

  const batch = currentBatch
  currentBatch = null

  try {
    frameCallback?.(batch.tokens, batch.reasoning)
  } catch {
    // consumer error silently swallowed
  }

  batch.flushToken.abort()
}

function scheduleNext(): void {
  if (rafId !== null) return
  rafId = requestAnimationFrame(flushFrame)
}

export function pushStreamToken(token: string, reasoning: string | null = null): AbortSignal {
  if (!currentBatch) {
    currentBatch = {
      tokens: [],
      reasoning: [],
      flushToken: new AbortController(),
    }
  }

  currentBatch.tokens.push(token)
  if (reasoning !== null) {
    currentBatch.reasoning.push(reasoning)
  }

  if (rafId === null) {
    rafId = requestAnimationFrame(flushFrame)
  }

  return currentBatch.flushToken.signal
}

export function flushNow(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  if (currentBatch && currentBatch.tokens.length > 0) {
    const batch = currentBatch
    currentBatch = null
    frameCallback?.(batch.tokens, batch.reasoning)
    batch.flushToken.abort()
  }
}

export function getBackpressureStats(): {
  frameCount: number
  droppedFrames: number
  dropRate: number
  fps: number
} {
  const total = frameCount + droppedFrames
  return {
    frameCount,
    droppedFrames,
    dropRate: total > 0 ? (droppedFrames / total) * 100 : 0,
    fps: frameCount > 0 && lastFrameTime > 0
      ? (frameCount / (performance.now() - lastFrameTime)) * 1000
      : 0,
  }
}

export function resetBackpressure(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  currentBatch = null
  frameCount = 0
  droppedFrames = 0
  lastFrameTime = 0
}

export function getDroppedFrameRate(): number {
  const total = frameCount + droppedFrames
  return total > 0 ? (droppedFrames / total) * 100 : 0
}
