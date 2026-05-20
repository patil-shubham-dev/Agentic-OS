import * as fs from "fs";
import * as path from "path";

// Hardcoded fallbacks in case file reading fails at runtime
const BASE_PROMPT_FALLBACK = `You are AgentOS, a production-grade autonomous development agent.
# Core Persona
- You are helpful, precise, fast, and direct.
- You write production-grade code that is clean, well-tested, and adheres to the best software engineering practices.
- You avoid fluff, conversational filler, and verbose explanations.
# Workspace Awareness
- You have direct access to the files and command terminal of the active workspace.
- The current working directory is the root of the user's workspace.
- When performing file system operations or terminal commands, ALWAYS assume they run relative to the workspace root.`;

const HERMES_PLANNING_FALLBACK = `# Multi-Step Planning and Reasoning Protocol
## 1. Planning Phase
- When presented with a task, start by formulating a clear, step-by-step plan.
- Identify target files, dependencies, and testing/validation commands.
## 2. Prerequisite Checks
- Before editing or writing code, ALWAYS verify the files and dependency configurations first.`;

const DESIGN_RULES_FALLBACK = `# Design and UI Generation Directives
- Avoid Generic Styling: Use modern visual assets and palettes.
- Hover and Interactive States: Add responsive hover animations and transitions.`;

export interface SystemPromptContext {
  cwd: string;
  osType: string;
  homeDir: string;
  userProfile?: string;
  securitySettings?: {
    allowTerminal: boolean;
    allowFilesystem: boolean;
    requireApprovalForDestructive: boolean;
  };
}

/**
 * Loads prompt templates from disk (with hardcoded fallbacks) and compiles them
 * into a single unified system prompt populated with dynamic workspace info.
 */
export function getUnifiedSystemPrompt(context: SystemPromptContext): string {
  const baseDir = __dirname;
  
  let basePrompt = BASE_PROMPT_FALLBACK;
  let hermesPlanning = HERMES_PLANNING_FALLBACK;
  let designRules = DESIGN_RULES_FALLBACK;

  try {
    const basePromptPath = path.join(baseDir, "base_prompt.txt");
    if (fs.existsSync(basePromptPath)) {
      basePrompt = fs.readFileSync(basePromptPath, "utf-8");
    }
  } catch (err) {
    // Ignore and use fallback
  }

  try {
    const planningPath = path.join(baseDir, "hermes_planning.txt");
    if (fs.existsSync(planningPath)) {
      hermesPlanning = fs.readFileSync(planningPath, "utf-8");
    }
  } catch (err) {
    // Ignore and use fallback
  }

  try {
    const designPath = path.join(baseDir, "design_rules.txt");
    if (fs.existsSync(designPath)) {
      designRules = fs.readFileSync(designPath, "utf-8");
    }
  } catch (err) {
    // Ignore and use fallback
  }

  const securityInfo = context.securitySettings 
    ? `
# Security Constraints
- Filesystem Writes: ${context.securitySettings.allowFilesystem ? "ENABLED" : "DISABLED"}
- Terminal Commands: ${context.securitySettings.allowTerminal ? "ENABLED" : "DISABLED"}
- Destructive Action Safety: ${context.securitySettings.requireApprovalForDestructive ? "REQUIRES USER APPROVAL" : "AUTO-APPROVED"}
`
    : "";

  const systemContext = `
# Current Execution Environment
- Operating System: ${context.osType}
- Workspace Root: ${context.cwd}
- User Home Directory: ${context.homeDir}
${securityInfo}
${context.userProfile ? `# User Profile & Preferences\n${context.userProfile}` : ""}
`;

  return [
    basePrompt,
    hermesPlanning,
    designRules,
    systemContext
  ].join("\n\n");
}
