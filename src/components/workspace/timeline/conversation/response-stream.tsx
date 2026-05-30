import { memo, useRef, useLayoutEffect, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { CopyButton } from "@/components/ui/CopyButton"
import type { Components } from "react-markdown"

interface ResponseStreamProps {
  text: string
  isStreaming: boolean
}

const codeComponents: Components = {
  code({ className, children, ...props }) {
    const isBlock = className?.includes("hljs") || className?.includes("language-")
    const codeText = String(children).replace(/\n$/, "")
    if (isBlock) {
      return (
        <div className="relative group">
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={codeText} className="px-1 py-0.5 rounded bg-black/60 border border-white/[0.06]" />
          </div>
          <code className={className} {...props}>{children}</code>
        </div>
      )
    }
    return <code className={className} {...props}>{children}</code>
  },
  pre({ children }) {
    return <pre className="relative group">{children}</pre>
  },
}

/**
 * Lightweight streaming text node.
 * During active streaming: renders plain pre/code (no markdown) — O(1) per token.
 * On stream completion: does ONE full ReactMarkdown render.
 */
export const ResponseStream = memo(function ResponseStream({ text, isStreaming }: ResponseStreamProps) {
  const preRef = useRef<HTMLPreElement>(null)
  const appendedLenRef = useRef(0)
  const textRef = useRef(text)

  // Track latest text value without causing re-render
  textRef.current = text

  // Append-only DOM update during streaming — skips React reconciliation for text content.
  // Also guards against React StrictMode double-fire and element reset.
  useEffect(() => {
    if (!isStreaming) return
    const pre = preRef.current
    if (!pre) return
    let codeEl = pre.querySelector("code")

    // First mount: create code element if missing
    if (!codeEl) {
      codeEl = document.createElement("code")
      pre.append(codeEl)
    }

    // Detect if React reset the element (e.g., reconciliation cleared children)
    const currentDomLen = codeEl.textContent?.length ?? 0
    if (currentDomLen < appendedLenRef.current) {
      // React reset — replay full text
      codeEl.textContent = ""
      codeEl.append(document.createTextNode(textRef.current))
      appendedLenRef.current = textRef.current.length
      return
    }

    // Normal delta append
    const newText = text.slice(appendedLenRef.current)
    if (newText) {
      codeEl.append(document.createTextNode(newText))
      appendedLenRef.current = text.length
    }
  })

  // Reset tracking when streaming stops
  useEffect(() => {
    if (!isStreaming) {
      appendedLenRef.current = 0
    }
  }, [isStreaming])

  if (!text && !isStreaming) return null

  if (isStreaming) {
    return (
      <div className="prose-claude streaming-text">
        <pre
          ref={preRef}
          className="streaming-pre"
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
          }}
        />
        <span className="streaming-cursor" />
      </div>
    )
  }

  // Completed — single ReactMarkdown render with full formatting
  return (
    <div className="prose-claude animate-fade-in">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={codeComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
