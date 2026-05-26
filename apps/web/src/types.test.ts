import { describe, it, expect } from "vitest"
import { isValidTransition } from "./lib/state-manager"

describe("state types", () => {
  it("allows transitions from idle to each active state", () => {
    expect(isValidTransition("idle", "coding")).toBe(true)
    expect(isValidTransition("idle", "designing")).toBe(true)
    expect(isValidTransition("idle", "testing")).toBe(true)
  })

  it("blocks self-transition", () => {
    expect(isValidTransition("idle", "idle")).toBe(false)
  })
})
