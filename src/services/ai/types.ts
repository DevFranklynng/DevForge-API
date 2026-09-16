export interface AiAction {
  label: string;
  href?: string;
  type?: "navigate" | "suggest" | "info";
}

export interface AiSource {
  label: string;
  href?: string;
}

export interface AiResponse {
  content: string;
  actions?: AiAction[];
  sources?: AiSource[];
  confidence?: number;
  severity?: "low" | "medium" | "high";
  isDemo: boolean;
  providerUsed?: string;
  contextTokens?: number;
}

export interface AiRequest {
  userId: string;
  message: string;
  projectId?: string | null;
}

export interface AiProvider {
  id: string;
  isAvailable(): boolean;
  ask(request: AiRequest, context: AiContext): Promise<AiResponse>;
}

export interface AiContext {
  projects: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
    openTasks: number;
    totalTasks: number;
    lastActivityDaysAgo: number;
  }>;
  tasksDueSoon: Array<{ id: string; title: string; projectId: string | null; dueDate: string | null; priority: string }>;
  failingDeployments: Array<{ id: string; projectName: string; environment: string }>;
  recentActivity: string[];
  stats: {
    totalProjects: number;
    activeProjects: number;
    openTasks: number;
    completedTasks30d: number;
    deploySuccessRate: number;
  };
  blockedFlag: boolean;
}