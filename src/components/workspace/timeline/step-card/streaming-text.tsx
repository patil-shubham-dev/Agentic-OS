import { useState, useEffect, useRef, memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { cn } from "@/lib/utils"
import { Copy, Check, FileDown } from "lucide-react"

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
  const match = /language-(\w+)/.exec(className ?? "")
  const code = String(children ?? "").replace(/\n$/, "")
  const [copied, setCopied] = useState(false)

  if (!match) {
    return (
      <code className="px-1 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-blue-300/80 border border-white/[0.06]" {...props}>
        {children}
      </code>
    )
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-2 rounded-lg border border-white/[0.08] bg-[#0d0d0e] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.06]">
        <span className="text-[10px] font-semibold font-mono text-blue-400">{match[1]}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] transition-all",
            copied ? "text-emerald-400/70 bg-emerald-500/10" : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]",
          )}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <pre className="px-3 py-3 text-[11px] leading-relaxed font-mono overflow-x-auto">
        <code className={className}>{code}</code>
      </pre>
    </div>
  )
}

function StreamingText({ text, isRunning }: { text: string; isRunning: boolean }) {
  const textRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [displayedText, setDisplayedText] = useState("")
  const prevLenRef = useRef(0)
  const animRef = useRef<number | null>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [pendingToken, setPendingToken] = useState("")

  // IntersectionObserver for scroll anchoring
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setShouldAutoScroll(entry.isIntersecting),
      { root: textRef.current, threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (textRef.current && isRunning && shouldAutoScroll) {
      textRef.current.scrollTop = textRef.current.scrollHeight
    }
  }, [displayedText, isRunning, shouldAutoScroll])

  // Delta-only reveal: only process new tokens since last render
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
    const getCharsPerFrame = (progress: number) => {
      if (progress < 0.3) return 6
      if (progress < 0.7) return 4
      return 2
    }

    const animate = () => {
      const totalDelta = targetLen - startLen
      const done = currentIdx - startLen
      const progress = totalDelta > 0 ? done / totalDelta : 1
      const steps = getCharsPerFrame(progress)
      currentIdx = Math.min(currentIdx + steps, targetLen)
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
      prevLenRef.current = Math.max(prevLenRef.current, currentIdx)
    }
  }, [text, isRunning])

  if (!text) return null

  const displayText = isRunning ? displayedText : text
  if (!displayText) return null

  return (
    <div
      ref={textRef}
      className="px-3 py-2 text-[11px] leading-relaxed overflow-y-auto max-h-96 text-white/80"
    >
      <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-[11px] [&_blockquote]:border-l-2 [&_blockquote]:border-white/10 [&_blockquote]:pl-2 [&_blockquote]:text-white/50 [&_table]:text-[10px] [&_th]:text-white/60 [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_a]:text-blue-400 [&_a]:underline [&_hr]:border-white/10 [&_strong]:text-white/90">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code({ className, children, ...props }) {
              const inline = !className
              if (inline) {
                return (
                  <code className="px-1 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-blue-300/80 border border-white/[0.06]" {...props}>
                    {children}
                  </code>
                )
              }
              return <CodeBlock className={className} {...props}>{children}</CodeBlock>
            },
          }}
        >
          {displayText}
        </ReactMarkdown>
      </div>

      <div ref={sentinelRef} className="h-0" />

      {isRunning && (
        <span className="inline-block w-0.5 h-[14px] bg-blue-400 animate-pulse ml-0.5 align-middle rounded-sm" />
      )}
    </div>
  )
}

export const StreamingTextMem = memo(StreamingText)
