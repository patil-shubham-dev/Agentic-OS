import { memo } from "react"

interface UserPillProps {
  content: string
  timestamp: number
}

export const UserPill = memo(function UserPill({ content, timestamp }: UserPillProps) {
  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="flex justify-end px-1 mb-1">
      <div className="max-w-[65%]">
        <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-blue-500/[0.1] to-blue-500/[0.06] border border-blue-500/10 px-3.5 py-2">
          <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>
        <div className="text-[8px] text-white/15 text-right mt-0.5 mr-0.5">
          {timeStr}
        </div>
      </div>
    </div>
  )
})
