import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ToolCall } from "@agentic-os/providers"

// Mock Tauri invoke — tool-executor tries dynamic import("@tauri-apps/api/core")
// which fails in node, so every Tauri-invoked tool returns an error.
// We test the non-Tauri paths: unknown tool, design store tools, default error.

// Pre-import zustand stores so they are available when tool-executor loads
import { useDesignStore } from "@/stores/design-store"
import { useToastStore } from "@/stores/toast-store"
import { useLedgerStore } from "@/stores/ledger-store"
import { RuntimeCleanupManager } from "@/runtime/RuntimeCleanupManager"
import { RuntimeOS } from "@/runtime/RuntimeOS"

// Dynamic import of the module under test
async function loadExecutor() {
  return import("./tool-executor")
}

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "call_1",
    type: "function",
    function: {
      name: "unknown_tool",
      arguments: "{}",
    },
    ...overrides,
  }
}

describe("tool-executor", () => {
  beforeEach(async () => {
    // Reset RuntimeOS singleton so each test starts cleanly, preventing
    // cross-test contamination from full-suite runs where a prior test
    // may have initialized RuntimeOS with registered tools. Without this,
    // executeToolCall() routes through the live RuntimeOS pipeline instead
    // of the fallback dispatch, causing hangs/timeouts in Node.js.
    await RuntimeOS.destroy().catch(() => {/* no-op */})
    RuntimeCleanupManager.getInstance().reset()

    useDesignStore.setState({
      artifacts: [],
      currentArtifactId: null,
      applyToCode: { isApplying: false, targetPath: null, progress: "", result: "idle", errorMessage: null },
    })
    useToastStore.setState({ toasts: [] })
    useLedgerStore.setState({ entries: [] })
  })


  describe("unknown / default tool", () => {
    it("returns error message for unknown tool name", async () => {
      const { executeToolCall } = await loadExecutor()
      const result = await executeToolCall(makeToolCall())
      expect(result.role).toBe("tool")
      expect(result.content).toContain("Unknown tool: unknown_tool")
    })
  })

  describe("design_create_artifact", () => {
    it("creates an artifact and a version in the design store", async () => {
      const { executeToolCall } = await loadExecutor()

      expect(useDesignStore.getState().artifacts).toHaveLength(0)

      const result = await executeToolCall(
        makeToolCall({
          function: {
            name: "design_create_artifact",
            arguments: JSON.stringify({
              name: "Test Button",
              description: "A primary button component",
              code: "<button className=\"bg-blue-500\">Click</button>",
              label: "Initial design",
              tags: ["ui", "button"],
            }),
          },
        }),
      )

      expect(result.role).toBe("tool")
      expect(result.content).toContain("Design artifact")
      expect(result.content).toContain("Test Button")

      const store = useDesignStore.getState()
      expect(store.artifacts).toHaveLength(1)
      expect(store.artifacts[0].name).toBe("Test Button")
      expect(store.artifacts[0].tags).toEqual(["ui", "button"])

      expect(store.artifacts[0].versions).toHaveLength(1)
      expect(store.artifacts[0].versions[0].label).toBe("Initial design")
      expect(store.artifacts[0].versions[0].code).toBe("<button className=\"bg-blue-500\">Click</button>")
      expect(store.artifacts[0].currentVersion).toBe(1)

      expect(useToastStore.getState().toasts).toHaveLength(1)
      expect(useToastStore.getState().toasts[0].message).toContain("Test Button")
    })

    it("uses default tags when none provided", async () => {
      const { executeToolCall } = await loadExecutor()

      await executeToolCall(
        makeToolCall({
          function: {
            name: "design_create_artifact",
            arguments: JSON.stringify({
              name: "No Tags",
              description: "No tags provided",
              code: "<div>test</div>",
              label: "v1",
            }),
          },
        }),
      )

      const store = useDesignStore.getState()
      expect(store.artifacts[0].tags).toEqual(["ai-generated"])
    })

    it("uses description as changes fallback when no changes provided", async () => {
      const { executeToolCall } = await loadExecutor()

      await executeToolCall(
        makeToolCall({
          function: {
            name: "design_create_artifact",
            arguments: JSON.stringify({
              name: "Fallback Test",
              description: "My fallback description",
              code: "<div>test</div>",
              label: "v1",
            }),
          },
        }),
      )

      const store = useDesignStore.getState()
      expect(store.artifacts[0].versions[0].changes).toBe("My fallback description")
    })
  })

  describe("design_add_version", () => {
    it("adds a new version to an existing artifact", async () => {
      const { executeToolCall } = await loadExecutor()

      const createId = useDesignStore.getState().addArtifact({
        name: "My Component",
        description: "A component",
        tags: ["ui"],
      })
      useDesignStore.getState().addVersion(createId, {
        label: "v1",
        code: "<div>v1</div>",
        changes: "Initial",
      })
      expect(useDesignStore.getState().artifacts[0].versions).toHaveLength(1)

      const result = await executeToolCall(
        makeToolCall({
          function: {
            name: "design_add_version",
            arguments: JSON.stringify({
              artifact_id: createId,
              code: "<div>v2</div>",
              label: "Redesigned",
              changes: "Updated styling",
            }),
          },
        }),
      )

      expect(result.role).toBe("tool")
      expect(result.content).toContain("Redesigned")
      expect(result.content).toContain(createId)

      const store = useDesignStore.getState()
      expect(store.artifacts[0].versions).toHaveLength(2)
      expect(store.artifacts[0].versions[1].label).toBe("Redesigned")
      expect(store.artifacts[0].versions[1].code).toBe("<div>v2</div>")
      expect(store.artifacts[0].currentVersion).toBe(2)
    })
  })

  describe("design_generate_preview", () => {
    it("returns an HTML preview string with HTML-escaped code", async () => {
      const { executeToolCall } = await loadExecutor()

      const result = await executeToolCall(
        makeToolCall({
          function: {
            name: "design_generate_preview",
            arguments: JSON.stringify({
              code: "<button>Click & Submit</button>",
            }),
          },
        }),
      )

      // The tool escapes < and > but not &
      expect(result.role).toBe("tool")
      expect(result.content).toContain("<!DOCTYPE html>")
      expect(result.content).toContain("tailwindcss.com")
      expect(result.content).toContain("&lt;button&gt;")
      expect(result.content).toContain("&lt;/button&gt;")
      expect(result.content).toContain("Click & Submit") // & is not escaped
    })
  })

  describe("error handling", () => {
    it("catches and returns Tauri invoke errors gracefully", async () => {
      const { executeToolCall } = await loadExecutor()

      const result = await executeToolCall(
        makeToolCall({
          function: {
            name: "grep_files",
            arguments: JSON.stringify({ pattern: "test" }),
          },
        }),
      )

      expect(result.role).toBe("tool")
      expect(result.content).toContain("Error executing")
      expect(result.content).toContain("grep_files")
    })

    it("handles malformed JSON arguments gracefully", async () => {
      const { executeToolCall } = await loadExecutor()

      const tc = makeToolCall({
        function: {
          name: "design_create_artifact",
          arguments: "not valid json{",
        },
      })

      const result = await executeToolCall(tc)
      expect(result.role).toBe("tool")
      expect(result.content).toContain("Error executing")
      expect(result.content).toContain("Invalid JSON")
    })
  })
})
