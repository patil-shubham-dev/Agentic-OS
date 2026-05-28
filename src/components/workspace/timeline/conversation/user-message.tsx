import { memo } from "react"

interface UserMessageProps {
  content: string
  timestamp: number
}

export const UserMessage = memo(function UserMessage({ content, timestamp }: UserMessageProps) {
  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl px-3.5 py-2 bg-blue-500/10 border border-blue-500/8">
        <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">{content}</p>
        <div className="flex justify-end mt-0.5">
          <span className="text-[9px] text-foreground/15 font-mono">{timeStr}</span>
        </div>
      </div>
    </div>
  )
})
