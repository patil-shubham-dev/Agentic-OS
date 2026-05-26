import { useState, useEffect, useRef, memo } from "react"
import { cn } from "@/lib/utils"
import { renderCodeBlocks } from "../CodeBlockWithActions"

/**
 * Character-level streaming animation with eased typewriter effect.
 * Reveals text character by character with a speed curve — fast at start, slow near end.
 * Includes IntersectionObserver-based scroll anchoring: auto-scroll pauses when the user scrolls up.
 */
function StreamingText({ text, isRunning }: { text: string; isRunning: boolean }) {
  const textRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [displayedText, setDisplayedText] = useState("")
  const prevLenRef = useRef(0)
  const animRef = useRef<number | null>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  // IntersectionObserver for scroll anchoring — if user scrolls up, pause auto-scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShouldAutoScroll(entry.isIntersecting)
      },
      { root: textRef.current, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll only if user hasn't scrolled up
  useEffect(() => {
    if (textRef.current && isRunning && shouldAutoScroll) {
      textRef.current.scrollTop = textRef.current.scrollHeight
    }
  }, [displayedText, isRunning, shouldAutoScroll])

  // Eased character-level reveal — faster at start, slower near end for natural feel
  useEffect(() => {
    if (!isRunning) {
      setDisplayedText(text)
      prevLenRef.current = text.length
      return
    }

    const targetLen = text.length
    const startLen = prevLenRef.current
    if (targetLen <= startLen) {
      setDisplayedText(text)
      prevLenRef.current = targetLen
      return
    }

    let currentIdx = startLen
    // Eased reveal: faster at start, slower near end
    const getCharsPerFrame = (progress: number) => {
      if (progress < 0.3) return 5  // fast start
      if (progress < 0.7) return 3  // medium
      return 2                     // slow end for natural feel
    }

    const animate = () => {
      const progress = (currentIdx - startLen) / (targetLen - startLen)
      currentIdx = Math.min(currentIdx + getCharsPerFrame(progress), targetLen)
      setDisplayedText(text.slice(0, currentIdx))
      if (currentIdx < targetLen) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        prevLenRef.current = targetLen
      }
    }

    animRef.current = requestAnimationFrame(animate)
    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
      prevLenRef.current = targetLen
    }
  }, [text, isRunning])

  if (!text) return null

  const displayText = isRunning ? displayedText : text
  if (!displayText) return null

  const hasCodeBlock = text.includes("```")

  return (
    <div
      ref={textRef}
      className={cn(
        "px-3 py-2 text-[11px] leading-relaxed overflow-y-auto text-white/80 whitespace-pre-wrap",
        hasCodeBlock ? "max-h-80" : "max-h-48",
      )}
    >
      {hasCodeBlock ? (
        renderCodeBlocks(displayText, {
          onApply: (block) => {
            console.log("Apply code block:", block.filePath || "unknown")
          },
        })
      ) : (
        <>
          {displayText.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && "\n"}
            </span>
          ))}
        </>
      )}

      {/* Scroll anchor sentinel — at the bottom so auto-scroll pauses when user scrolls up */}
      <div ref={sentinelRef} className="h-0" />

      {isRunning && (
        <span className="inline-block w-0.5 h-[14px] bg-blue-400 animate-pulse ml-0.5 align-middle rounded-sm" />
      )}
    </div>
  )
}

export const StreamingTextMem = memo(StreamingText)
