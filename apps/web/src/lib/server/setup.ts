// Server-side setup utilities

export interface SetupStatus {
  ready: boolean;
  hasProject: boolean;
  hasConnectedProvider: boolean;
  projectName: string | null;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  // Default setup status
  return {
    ready: false,
    hasProject: false,
    hasConnectedProvider: false,
    projectName: null,
  };
}

export const REQUIRED_ENV_KEYS: string[] = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
];