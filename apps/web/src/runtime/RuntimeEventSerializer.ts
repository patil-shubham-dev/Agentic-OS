import type {
  RuntimeEvent,
  ToolRequestedEvent,
  ToolStartedEvent,
  ToolStreamEvent,
  ToolCompletedEvent,
  ToolFailedEvent,
  VerificationStartedEvent,
  VerificationCompletedEvent,
  RepairAttemptedEvent,
  RepairFailedEvent,
  RepairResolvedEvent,
  StateTransitionEvent,
  AgentMessageEvent,
  StreamDeltaEvent,
  ExecutionErrorEvent,
  ExecutionHaltedEvent,
  EventMetadata,
  ExecutionTrace,
  TimelineSortKey,
} from "./RuntimeTypes"

export type SerializedRuntimeEvent = {
  t: string
  m: [number, number, string, string, string | null, string, number]
  p: Record<string, unknown>
}

export class RuntimeEventSerializer {
  static serialize(event: RuntimeEvent): SerializedRuntimeEvent {
    const meta = event.metadata
    const m: SerializedRuntimeEvent["m"] = [
      meta.timestamp,
      meta.stepIndex,
      meta.executionId,
      meta.agentId,
      meta.parentExecutionId,
      meta.source,
      meta.eventSequence,
    ]

    const p: Record<string, unknown> = {}

    switch (event.type) {
      case "tool_requested":
        p.tn = (event as ToolRequestedEvent).toolName
        p.a = (event as ToolRequestedEvent).args
        break
      case "tool_started":
        p.tn = (event as ToolStartedEvent).toolName
        p.ti = (event as ToolStartedEvent).toolId
        break
      case "tool_stream":
        p.tn = (event as ToolStreamEvent).toolName
        p.ti = (event as ToolStreamEvent).toolId
        p.c = (event as ToolStreamEvent).chunk
        break
      case "tool_completed":
        p.tn = (event as ToolCompletedEvent).toolName
        p.ti = (event as ToolCompletedEvent).toolId
        p.r = (event as ToolCompletedEvent).result
        p.d = (event as ToolCompletedEvent).durationMs
        break
      case "tool_failed":
        p.tn = (event as ToolFailedEvent).toolName
        p.ti = (event as ToolFailedEvent).toolId
        p.e = (event as ToolFailedEvent).error
        p.d = (event as ToolFailedEvent).durationMs
        break
      case "verification_started":
        p.s = (event as VerificationStartedEvent).scope
        break
      case "verification_completed":
        p.s = (event as VerificationCompletedEvent).scope
        p.pa = (event as VerificationCompletedEvent).passed
        p.di = (event as VerificationCompletedEvent).diagnostics
        break
      case "repair_attempted":
        p.tg = (event as RepairAttemptedEvent).target
        p.at = (event as RepairAttemptedEvent).attempt
        break
      case "repair_failed":
        p.tg = (event as RepairFailedEvent).target
        p.e = (event as RepairFailedEvent).error
        break
      case "repair_resolved":
        p.tg = (event as RepairResolvedEvent).target
        p.ra = (event as RepairResolvedEvent).repairsApplied
        break
      case "state_transition":
        p.f = (event as StateTransitionEvent).from
        p.to = (event as StateTransitionEvent).to
        break
      case "agent_message":
        p.c = (event as AgentMessageEvent).content
        p.r = (event as AgentMessageEvent).role
        break
      case "stream_delta":
        p.dt = (event as StreamDeltaEvent).deltaText
        p.rt = (event as StreamDeltaEvent).reasoningText
        p.fr = (event as StreamDeltaEvent).finishReason
        break
      case "execution_error":
        p.e = (event as ExecutionErrorEvent).error
        p.rc = (event as ExecutionErrorEvent).recoverable
        break
      case "execution_halted":
        p.r = (event as ExecutionHaltedEvent).reason
        p.rf = (event as ExecutionHaltedEvent).reflection
        break
    }

    return { t: event.type, m, p }
  }

  static deserialize(serialized: SerializedRuntimeEvent): RuntimeEvent {
    const meta: EventMetadata = {
      timestamp: serialized.m[0],
      stepIndex: serialized.m[1],
      executionId: serialized.m[2],
      agentId: serialized.m[3],
      parentExecutionId: serialized.m[4],
      source: serialized.m[5] as EventMetadata["source"],
      eventSequence: serialized.m[6],
    }

    const p = serialized.p
    const type = serialized.t

    switch (type) {
      case "tool_requested":
        return { type, metadata: meta, toolName: p.tn as string, args: p.a as string } as ToolRequestedEvent
      case "tool_started":
        return { type, metadata: meta, toolName: p.tn as string, toolId: p.ti as string } as ToolStartedEvent
      case "tool_stream":
        return { type, metadata: meta, toolName: p.tn as string, toolId: p.ti as string, chunk: p.c as string } as ToolStreamEvent
      case "tool_completed":
        return { type, metadata: meta, toolName: p.tn as string, toolId: p.ti as string, result: p.r as string, durationMs: p.d as number } as ToolCompletedEvent
      case "tool_failed":
        return { type, metadata: meta, toolName: p.tn as string, toolId: p.ti as string, error: p.e as string, durationMs: p.d as number } as ToolFailedEvent
      case "verification_started":
        return { type, metadata: meta, scope: p.s as VerificationStartedEvent["scope"] } as VerificationStartedEvent
      case "verification_completed":
        return { type, metadata: meta, scope: p.s as VerificationCompletedEvent["scope"], passed: p.pa as boolean, diagnostics: p.di as string[] } as VerificationCompletedEvent
      case "repair_attempted":
        return { type, metadata: meta, target: p.tg as string, attempt: p.at as number } as RepairAttemptedEvent
      case "repair_failed":
        return { type, metadata: meta, target: p.tg as string, error: p.e as string } as RepairFailedEvent
      case "repair_resolved":
        return { type, metadata: meta, target: p.tg as string, repairsApplied: p.ra as number } as RepairResolvedEvent
      case "state_transition":
        return { type, metadata: meta, from: p.f as string, to: p.to as string } as StateTransitionEvent
      case "agent_message":
        return { type, metadata: meta, content: p.c as string, role: p.r as AgentMessageEvent["role"] } as AgentMessageEvent
      case "stream_delta":
        return { type, metadata: meta, deltaText: p.dt as string, reasoningText: p.rt as string | null, finishReason: p.fr as string | null } as StreamDeltaEvent
      case "execution_error":
        return { type, metadata: meta, error: p.e as string, recoverable: p.rc as boolean } as ExecutionErrorEvent
      case "execution_halted":
        return { type, metadata: meta, reason: p.r as string, reflection: p.rf as string | null } as ExecutionHaltedEvent
      default:
        throw new Error(`Unknown event type: ${type}`)
    }
  }

  static serializeEvents(events: RuntimeEvent[]): string {
    return JSON.stringify(events.map(RuntimeEventSerializer.serialize))
  }

  static deserializeEvents(json: string): RuntimeEvent[] {
    const parsed: SerializedRuntimeEvent[] = JSON.parse(json)
    return parsed.map(RuntimeEventSerializer.deserialize)
  }

  static serializeTrace(trace: ExecutionTrace): string {
    return JSON.stringify({
      executionId: trace.executionId,
      agentId: trace.agentId,
      parentExecutionId: trace.parentExecutionId,
      state: trace.state,
      startedAt: trace.startedAt,
      completedAt: trace.completedAt,
      errorCount: trace.errorCount,
      toolCallCount: trace.toolCallCount,
      events: trace.events.map(RuntimeEventSerializer.serialize),
    })
  }

  static deserializeTrace(json: string): ExecutionTrace {
    const parsed = JSON.parse(json)
    return {
      executionId: parsed.executionId,
      agentId: parsed.agentId,
      parentExecutionId: parsed.parentExecutionId,
      state: parsed.state,
      startedAt: parsed.startedAt,
      completedAt: parsed.completedAt,
      errorCount: parsed.errorCount,
      toolCallCount: parsed.toolCallCount,
      events: parsed.events.map(RuntimeEventSerializer.deserialize),
    }
  }
}
