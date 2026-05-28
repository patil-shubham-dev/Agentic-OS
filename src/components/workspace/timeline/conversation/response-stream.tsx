import { memo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
  const match = /language-(\w+)/.exec(className ?? "")
  const code = String(children ?? "").replace(/\n$/, "")
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  if (!match) {
    return <code className="code-inline" {...props}>{children}</code>
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
          <button onClick={() => setCollapsed(!collapsed)} className="text-foreground/20 hover:text-foreground/50 transition-colors">
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <span className="code-block-lang">{match[1]}</span>
          <span className="text-[9px] text-foreground/20 font-mono">{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={handleCopy} className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] transition-all",
            copied ? "text-emerald-400/60 bg-emerald-500/10" : "text-foreground/30 hover:text-foreground/60 hover:bg-white/[0.04]",
          )}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="code-block-content">
          <pre className="m-0"><code className={className}>{code}</code></pre>
        </div>
      )}
    </div>
  )
}

interface ResponseStreamProps {
  text: string
  isStreaming: boolean
}

export const ResponseStream = memo(function ResponseStream({ text, isStreaming }: ResponseStreamProps) {
  if (!text && !isStreaming) return null

  return (
    <div className="prose-claude animate-fade-in">
      {text ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code({ className, children, ...props }) {
              const inline = !className
              if (inline) {
                return <code className="code-inline" {...props}>{children}</code>
              }
              return <CodeBlock className={className} {...props}>{children}</CodeBlock>
            },
          }}
        >
          {text}
        </ReactMarkdown>
      ) : null}
      {isStreaming && <span className="streaming-cursor" />}
    </div>
  )
})
