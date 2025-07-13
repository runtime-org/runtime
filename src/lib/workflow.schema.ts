export type WorkflowStatus  = 'pending' | 'running' | 'completed' | 'failed';
export type SubTaskStatus   = 'pending' | 'running' | 'completed' | 'failed';

export interface SubTask {
  id: string;
  query: string;
  queryIndex: number;
  status: SubTaskStatus;
  dependsOn: number[];
  actualTaskId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
}

export interface Workflow {
  workflowId: string;
  originalQuery: string;
  sessionId: string;
  status: WorkflowStatus;
  subTasks: Record<string, SubTask>;
  metadata: {
    totalTasks: number;
    completedCount: number;
    failedCount: number;
    runningCount: number;
    concurrency: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  results: Record<string, unknown>;
}

export interface RunnerOptions {
  originalQuery: string;
  sessionId: string;
  queries: string[];
  concurrency?: number;
  browserInstance: any;
}
