export interface SSEEvent {
  data: string
  event: string
  id: string | null
  retry: number | null
}

export class SSEParser {
  private buffer = ""
  private currentEvent: Partial<SSEEvent> = {}
  private onEvent: (event: SSEEvent) => void
  private onParseError: (error: Error) => void

  constructor(
    onEvent: (event: SSEEvent) => void,
    onParseError?: (error: Error) => void,
  ) {
    this.onEvent = onEvent
    this.onParseError = onParseError ?? (() => {})
  }

  push(chunk: string): void {
    this.buffer += chunk

    while (true) {
      const lineEnd = this.buffer.indexOf("\n")
      if (lineEnd === -1) break

      const rawLine = this.buffer.slice(0, lineEnd)
      this.buffer = this.buffer.slice(lineEnd + 1)

      this.processLine(rawLine)
    }
  }

  private processLine(raw: string): void {
    const line = raw.replace(/\r$/, "")

    if (line === "") {
      this.flushEvent()
      return
    }

    if (line.startsWith(":")) {
      return
    }

    const colonIdx = line.indexOf(":")
    let field: string
    let value: string

    if (colonIdx === -1) {
      field = line
      value = ""
    } else {
      field = line.slice(0, colonIdx)
      value = line.slice(colonIdx + 1)
      if (value.startsWith(" ")) {
        value = value.slice(1)
      }
    }

    switch (field) {
      case "event":
        this.currentEvent.event = value
        break
      case "data":
        if (this.currentEvent.data === undefined) {
          this.currentEvent.data = value
        } else {
          this.currentEvent.data += "\n" + value
        }
        break
      case "id":
        if (!value.includes("\0")) {
          this.currentEvent.id = value
        }
        break
      case "retry":
        const parsed = parseInt(value, 10)
        if (!isNaN(parsed)) {
          this.currentEvent.retry = parsed
        }
        break
    }
  }

  private flushEvent(): void {
    if (this.currentEvent.data === undefined) {
      this.currentEvent = {}
      return
    }

    const event: SSEEvent = {
      data: this.currentEvent.data ?? "",
      event: this.currentEvent.event ?? "message",
      id: this.currentEvent.id ?? null,
      retry: this.currentEvent.retry ?? null,
    }

    this.currentEvent = {}
    this.onEvent(event)
  }

  flush(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer)
      this.flushEvent()
    }
    this.buffer = ""
  }
}

export function extractOpenAIDelta(data: string): string | null {
  try {
    const parsed = JSON.parse(data)
    if (parsed.choices?.[0]?.delta?.content) {
      return parsed.choices[0].delta.content
    }
    if (parsed.choices?.[0]?.text) {
      return parsed.choices[0].text
    }
    return null
  } catch {
    return null
  }
}

export function isDoneSignal(data: string): boolean {
  return data.trim() === "[DONE]"
}
