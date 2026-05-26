export interface ToolSchema {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, SchemaProperty>
    required: string[]
  }
}

interface SchemaProperty {
  type: string
  description?: string
  enum?: string[]
  items?: SchemaProperty
  properties?: Record<string, SchemaProperty>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class ToolSchemaValidator {
  private schemas: Map<string, ToolSchema> = new Map()

  register(schema: ToolSchema): void {
    this.schemas.set(schema.name, schema)
  }

  registerBatch(schemas: ToolSchema[]): void {
    for (const schema of schemas) {
      this.schemas.set(schema.name, schema)
    }
  }

  unregister(name: string): void {
    this.schemas.delete(name)
  }

  clear(): void {
    this.schemas.clear()
  }

  validate(toolName: string, args: Record<string, unknown>): ValidationResult {
    const schema = this.schemas.get(toolName)
    if (!schema) {
      return { valid: false, errors: [`Unknown tool: "${toolName}". No schema registered.`] }
    }

    const errors: string[] = []

    for (const required of schema.parameters.required) {
      if (!(required in args) || args[required] === undefined || args[required] === null) {
        errors.push(`Missing required parameter: "${required}"`)
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const prop = schema.parameters.properties[key]
      if (!prop) {
        errors.push(`Unknown parameter: "${key}"`)
        continue
      }

      if (value === null || value === undefined) continue

      if (!this.typeMatches(prop.type, value)) {
        errors.push(`Parameter "${key}": expected type "${prop.type}", got "${typeof value}"`)
      }

      if (prop.type === "string" && prop.enum && typeof value === "string") {
        if (!prop.enum.includes(value)) {
          errors.push(`Parameter "${key}": value "${value}" not in enum [${prop.enum.join(", ")}]`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  validateBatch(toolCalls: { name: string; arguments: Record<string, unknown> }[]): ValidationResult[] {
    return toolCalls.map((tc) => this.validate(tc.name, tc.arguments))
  }

  getSchema(name: string): ToolSchema | undefined {
    return this.schemas.get(name)
  }

  hasSchema(name: string): boolean {
    return this.schemas.has(name)
  }

  getAllSchemas(): ToolSchema[] {
    return Array.from(this.schemas.values())
  }

  private typeMatches(expected: string, value: unknown): boolean {
    switch (expected) {
      case "string":
        return typeof value === "string"
      case "number":
        return typeof value === "number"
      case "integer":
        return typeof value === "number" && Number.isInteger(value)
      case "boolean":
        return typeof value === "boolean"
      case "array":
        return Array.isArray(value)
      case "object":
        return typeof value === "object" && !Array.isArray(value) && value !== null
      case "null":
        return value === null
      default:
        return true
    }
  }
}
