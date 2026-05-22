"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js";

/**
 * Markdown renderer with syntax highlighting for code blocks
 * and a copy-to-clipboard button on each code fence.
 */
export function MarkdownInner({ content }: { content: string }) {
  return (
    <div className="text-xs text-[--text-secondary] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            if (isInline) {
              return (
                <code
                  className="bg-[--accent-primary]/10 text-[--accent-soft] px-1.5 py-0.5 rounded text-[10px] font-mono border border-[--border-secondary]/30"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match[1]}>{children}</CodeBlock>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, children }: { language: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const codeString = String(children).replace(/\n$/, "");

  // Try highlight.js; fall back to plaintext
  let highlighted = codeString;
  try {
    if (language && hljs.getLanguage(language)) {
      highlighted = hljs.highlight(codeString, { language }).value;
    }
  } catch {
    // fall through
  }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silently fail
    }
  }, [codeString]);

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-[--terminal-border] bg-[--terminal-bg] shadow-sm shadow-black/30">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[--terminal-panel] border-b border-[--terminal-border]">
        <span className="text-[10px] font-mono text-[--text-muted] uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated] rounded-md transition-all"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-3 text-[11px] leading-relaxed font-mono">
          {language ? (
            <code
              className={`hljs language-${language}`}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          ) : (
            <code className="text-[--text-secondary]">{codeString}</code>
          )}
        </pre>
      </div>
    </div>
  );
}
