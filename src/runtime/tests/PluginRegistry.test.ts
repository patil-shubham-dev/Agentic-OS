import { describe, it, expect, beforeEach } from "vitest"
import { PluginRegistry } from "../plugins/PluginRegistry"
import type { RuntimePlugin } from "../plugins/RuntimePlugin"

function makePlugin(name: string, overrides?: Partial<RuntimePlugin>): RuntimePlugin {
  return {
    name,
    description: `Plugin ${name}`,
    version: "1.0.0",
    capabilities: [],
    enabled: true,
    ...overrides,
  }
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = new PluginRegistry()
  })

  describe("register / unregister", () => {
    it("registers a plugin", () => {
      registry.register(makePlugin("test-plugin"))
      expect(registry.get("test-plugin")).toBeDefined()
      expect(registry.size()).toBe(1)
    })

    it("enables plugin on registration when plugin.enabled is true", () => {
      registry.register(makePlugin("active", { enabled: true }))
      expect(registry.isEnabled("active")).toBe(true)
    })

    it("does not enable plugin when plugin.enabled is false", () => {
      registry.register(makePlugin("inactive", { enabled: false }))
      expect(registry.isEnabled("inactive")).toBe(false)
    })

    it("unregisters a plugin", () => {
      registry.register(makePlugin("temp"))
      expect(registry.unregister("temp")).toBe(true)
      expect(registry.get("temp")).toBeUndefined()
      expect(registry.size()).toBe(0)
    })

    it("returns false on unregister for unknown plugin", () => {
      expect(registry.unregister("nonexistent")).toBe(false)
    })
  })

  describe("enable / disable", () => {
    it("enables a registered plugin", () => {
      registry.register(makePlugin("p", { enabled: false }))
      expect(registry.enable("p")).toBe(true)
      expect(registry.isEnabled("p")).toBe(true)
    })

    it("disables a registered plugin", () => {
      registry.register(makePlugin("p"))
      expect(registry.disable("p")).toBe(true)
      expect(registry.isEnabled("p")).toBe(false)
    })

    it("returns false enabling unknown plugin", () => {
      expect(registry.enable("nope")).toBe(false)
    })

    it("returns false disabling unknown plugin", () => {
      expect(registry.disable("nope")).toBe(false)
    })
  })

  describe("getAll / getEnabled / getDisabled", () => {
    it("returns all plugins", () => {
      registry.register(makePlugin("a"))
      registry.register(makePlugin("b"))
      expect(registry.getAll()).toHaveLength(2)
    })

    it("returns only enabled plugins", () => {
      registry.register(makePlugin("a", { enabled: true }))
      registry.register(makePlugin("b", { enabled: false }))
      const enabled = registry.getEnabled()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].name).toBe("a")
    })

    it("returns only disabled plugins", () => {
      registry.register(makePlugin("a", { enabled: true }))
      registry.register(makePlugin("b", { enabled: false }))
      const disabled = registry.getDisabled()
      expect(disabled).toHaveLength(1)
      expect(disabled[0].name).toBe("b")
    })
  })

  describe("capability filtering", () => {
    it("filters plugins by capability", () => {
      registry.register(makePlugin("tools-plugin", { capabilities: ["tools"] }))
      registry.register(makePlugin("skills-plugin", { capabilities: ["skills"] }))
      const toolsPlugins = registry.getByCapability("tools")
      expect(toolsPlugins).toHaveLength(1)
      expect(toolsPlugins[0].name).toBe("tools-plugin")
    })

    it("only returns enabled plugins for capability queries", () => {
      registry.register(makePlugin("tools1", { capabilities: ["tools"], enabled: true }))
      registry.register(makePlugin("tools2", { capabilities: ["tools"], enabled: false }))
      expect(registry.getByCapability("tools")).toHaveLength(1)
    })
  })

  describe("specialized getters", () => {
    it("getTools returns plugins with 'tools' capability and tools array", () => {
      registry.register(makePlugin("tool-provider", {
        capabilities: ["tools"],
        tools: [{ name: "my_tool", description: "", inputSchema: { type: "object", properties: {} }, execute: async () => ({ data: null }), permissions: async () => ({ behavior: "allow" }), isReadOnly: () => true, isConcurrencySafe: () => true, isEnabled: () => true, supportedModes: () => [""], requiredCapabilities: () => [] }],
      }))
      registry.register(makePlugin("empty-tools", { capabilities: ["tools"] }))
      expect(registry.getTools()).toHaveLength(1)
    })

    it("getSkills returns plugins with 'skills' capability and skills array", () => {
      registry.register(makePlugin("skill-provider", {
        capabilities: ["skills"],
        skills: [{
          name: "test-skill",
          description: "",
          allowedTools: [],
          getPromptForCommand: async () => "",
        }],
      }))
      registry.register(makePlugin("no-skills", { capabilities: ["skills"] }))
      expect(registry.getSkills()).toHaveLength(1)
    })

    it("getMcpServers returns plugins with 'mcp-servers' capability and mcpServers array", () => {
      registry.register(makePlugin("mcp-provider", {
        capabilities: ["mcp-servers"],
        mcpServers: [{ name: "my-mcp", transport: { type: "stdio", command: "node" } }],
      }))
      expect(registry.getMcpServers()).toHaveLength(1)
    })

    it("getPromptSections returns plugins with 'prompt-sections' capability and promptSections array", () => {
      registry.register(makePlugin("prompt-plugin", {
        capabilities: ["prompt-sections"],
        promptSections: [{ id: "section1", category: "core" as any, importance: "medium" as any, priority: 50, compute: async () => "test" }],
      }))
      expect(registry.getPromptSections()).toHaveLength(1)
    })
  })

  describe("clear", () => {
    it("clears all plugins", () => {
      registry.register(makePlugin("a"))
      registry.register(makePlugin("b"))
      registry.register(makePlugin("c"))
      registry.clear()
      expect(registry.size()).toBe(0)
      expect(registry.getAll()).toHaveLength(0)
      expect(registry.getEnabled()).toHaveLength(0)
    })
  })
})
