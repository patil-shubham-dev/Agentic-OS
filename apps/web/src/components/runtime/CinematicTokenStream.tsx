import { useEffect, useRef, useState, useCallback } from "react"

interface TokenChunk {
  text: string
  index: number
  timestamp: number
}

interface CinematicTokenStreamProps {
  tokens?: string[]
  speed?: number
  onComplete?: () => void
  className?: string
}

const CHARS_PER_FRAME = 3
const FRAME_MS = 16

export function CinematicTokenStream({ tokens, speed = 1, onComplete, className }: CinematicTokenStreamProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const queueRef = useRef<TokenChunk[]>([])
  const rafRef = useRef<number | null>(null)
  const indexRef = useRef(0)
  const charsPerFrame = Math.max(1, Math.round(CHARS_PER_FRAME * speed))

  const flushQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    const chunk = queueRef.current.shift()!
    setDisplayedText((prev) => prev + chunk.text)

    rafRef.current = requestAnimationFrame(flushQueue)
  }, [])

  useEffect(() => {
    if (!tokens || tokens.length === 0) {
      setIsComplete(true)
      onComplete?.()
      return
    }

    setIsComplete(false)
    setDisplayedText("")
    queueRef.current = tokens.map((text, i) => ({
      text,
      index: i,
      timestamp: Date.now() + i * FRAME_MS * charsPerFrame,
    }))

    rafRef.current = requestAnimationFrame(flushQueue)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [tokens, charsPerFrame, flushQueue, onComplete])

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <span className="inline-block w-[2px] h-[1em] bg-blue-400/60 animate-pulse ml-[1px] align-middle" />
      )}
    </span>
  )
}
