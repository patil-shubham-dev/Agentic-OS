import { memo } from "react"
import { UserMessage } from "./user-message"
import { LiveResponse } from "./live-response"
import type { UserMessageEvent } from "../types"
import type { AgentSession } from "../timeline-store"

interface ConversationTurnProps {
  userEvent: UserMessageEvent | null
  sessions: AgentSession[]
  onFollowUpSelect?: (prompt: string) => void
}

export const ConversationTurn = memo(function ConversationTurn({
  userEvent,
  sessions,
  onFollowUpSelect,
}: ConversationTurnProps) {
  return (
    <div className="space-y-2">
      {/* User message */}
      {userEvent && (
        <UserMessage
          content={userEvent.content}
          timestamp={userEvent.timestamp}
        />
      )}

      {/* Assistant response */}
      {sessions.map((session) => (
        <div key={session.stepId}>
          <LiveResponse
            streamingText={session.streamingText}
            toolCalls={session.toolCalls}
            fileEdits={session.fileEdits}
            terminalOutputs={session.terminalOutputs}
            status={session.status}
            startedAt={session.startedAt}
            modelName={session.modelName}
            onFollowUpSelect={onFollowUpSelect}
          />
        </div>
      ))}
    </div>
  )
})
