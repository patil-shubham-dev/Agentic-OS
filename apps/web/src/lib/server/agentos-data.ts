// AgentOS data layer - placeholder for server-side operations

export const DEFAULT_PROJECT_ID = "default-project";

export interface ProductAgent {
  id: string;
  name: string;
  description: string;
  role: string;
  model?: string;
  instructions?: string;
  tools?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductAutomation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAgents(projectId: string): Promise<ProductAgent[]> {
  return [];
}

export async function createAgent(data: Omit<ProductAgent, "id" | "createdAt" | "updatedAt">): Promise<ProductAgent> {
  return {
    ...data,
    id: "new-agent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updateAgent(id: string, data: Partial<ProductAgent>): Promise<ProductAgent> {
  return {} as ProductAgent;
}

export async function deleteAgent(id: string): Promise<void> {
  return;
}

export async function getAutomations(projectId: string): Promise<ProductAutomation[]> {
  return [];
}

export async function getFiles(projectId: string): Promise<any[]> {
  return [];
}

export async function upsertFile(projectId: string, file: any): Promise<any> {
  return file;
}

export async function getDashboardData(projectId: string): Promise<any> {
  return {
    projectId,
    agents: [],
    chats: [],
    automations: [],
    files: [],
  };
}

export async function getProviders(projectId: string): Promise<any[]> {
  return [];
}

export async function upsertProvider(projectId: string, provider: any): Promise<any> {
  return provider;
}