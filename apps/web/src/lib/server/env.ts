// Environment configuration

export const REQUIRED_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY", 
  "GOOGLE_API_KEY",
];

export function getRequiredEnvKeys(): string[] {
  return [...REQUIRED_ENV_KEYS];
}

export function isEnvSet(key: string): boolean {
  return !!process.env[key];
}