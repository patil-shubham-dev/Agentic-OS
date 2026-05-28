import { useState, useEffect, useRef, memo, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { cn } from "@/lib/utils"
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react"

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
  const match = /language-(\w+)/.exec(className ?? "")
  const code = String(children ?? "").replace(/\n$/, "")
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  if (!match) {
    return (
      <code className="code-inline" {...props}>
        {children}
      </code>
    )
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lineCount = code.split("\n").length

  return (
    <div className="code-block-premium group">
      <div className="code-block-header">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-foreground/20 hover:text-foreground/50 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          <span className="code-block-lang">{match[1]}</span>
          <span className="text-[9px] text-foreground/20 font-mono">{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] transition-all",
              copied
                ? "text-emerald-400/60 bg-emerald-500/10"
                : "text-foreground/30 hover:text-foreground/60 hover:bg-white/[0.04]",
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="code-block-content">
          <pre className="m-0">
            <code className={className}>{code}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

interface StreamingContentProps {
  text: string
  isRunning: boolean
}

export const StreamingContent = memo(function StreamingContent({
  text,
  isRunning,
}: StreamingContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [displayedText, setDisplayedText] = useState("")
  const prevLenRef = useRef(0)
  const animRef = useRef<number | null>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  // IntersectionObserver for scroll anchoring
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setShouldAutoScroll(entry.isIntersecting),
      { root: null, threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (isRunning && shouldAutoScroll) {
      const el = containerRef.current?.closest('[data-timeline-scroll]') as HTMLElement | null
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [displayedText, isRunning, shouldAutoScroll])

  // Delta-only reveal animation with variable speed
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

    const animate = () => {
      const totalDelta = targetLen - startLen
      const done = currentIdx - startLen
      const progress = totalDelta > 0 ? done / totalDelta : 1
      // Faster at the beginning, slower toward the end for smoother perception
      const charsPerFrame = progress < 0.3 ? 5 : progress < 0.7 ? 3 : 2
      currentIdx = Math.min(currentIdx + charsPerFrame, targetLen)
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
    <div ref={containerRef} className="prose-claude">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className, children, ...props }) {
            const inline = !className
            if (inline) {
              return (
                <code className="code-inline" {...props}>
                  {children}
                </code>
              )
            }
            return <CodeBlock className={className} {...props}>{children}</CodeBlock>
          },
          p({ children, ...props }) {
            return <p {...props}>{children}</p>
          },
        }}
      >
        {displayText}
      </ReactMarkdown>
      <div ref={sentinelRef} className="h-0" />
      {isRunning && (
        <span className="streaming-cursor" />
      )}
    </div>
  )
})
