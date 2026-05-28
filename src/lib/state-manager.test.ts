import { describe, it, expect, beforeEach } from "vitest"
import {
  isValidTransition,
  transitionTo,
  lockFile,
  unlockFile,
  isFileLocked,
  clearAllLocks,
  acquireExecutionLock,
  releaseExecutionLock,
  getExecutionLockOwner,
} from "./state-manager"

describe("state-manager", () => {
  beforeEach(() => {
    clearAllLocks()
    releaseExecutionLock("coder")
    // Reset state to idle
    transitionTo("idle")
  })

  describe("isValidTransition", () => {
    it("allows idle -> coding", () => {
      expect(isValidTransition("idle", "coding")).toBe(true)
    })

    it("allows idle -> designing", () => {
      expect(isValidTransition("idle", "designing")).toBe(true)
    })

    it("allows idle -> testing", () => {
      expect(isValidTransition("idle", "testing")).toBe(true)
    })

    it("allows coding -> idle", () => {
      expect(isValidTransition("coding", "idle")).toBe(true)
    })

    it("allows coding -> designing (bidirectional active states)", () => {
      expect(isValidTransition("coding", "designing")).toBe(true)
    })

    it("blocks idle -> idle", () => {
      expect(isValidTransition("idle", "idle")).toBe(false)
    })
  })

  describe("transitionTo", () => {
    it("transitions to valid state", () => {
      expect(transitionTo("coding")).toBe(true)
    })

    it("rejects idle -> idle transition", () => {
      expect(transitionTo("idle")).toBe(false)
    })
  })

  describe("file locking", () => {
    it("locks and unlocks a file", () => {
      expect(lockFile("src/main.ts", "coder")).toBe(true)
      expect(isFileLocked("src/main.ts")).toBe(true)
      unlockFile("src/main.ts")
      expect(isFileLocked("src/main.ts")).toBe(false)
    })

    it("prevents double lock", () => {
      expect(lockFile("src/main.ts", "coder")).toBe(true)
      expect(lockFile("src/main.ts", "design")).toBe(false)
    })
  })

  describe("execution locking", () => {
    it("acquires and releases execution lock", () => {
      expect(acquireExecutionLock("coder")).toBe(true)
      expect(getExecutionLockOwner()).toBe("coder")
      releaseExecutionLock("coder")
      expect(getExecutionLockOwner()).toBeNull()
    })

    it("prevents concurrent execution", () => {
      acquireExecutionLock("coder")
      expect(acquireExecutionLock("design")).toBe(false)
    })

    it("prevents concurrent execution", () => {
      acquireExecutionLock("coder")
      expect(acquireExecutionLock("design")).toBe(false)
    })
  })
})
