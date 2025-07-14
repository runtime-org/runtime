
import { v4 as uuid } from 'uuid';
import { Workflow, SubTask } from './workflow.schema';

export function makeWorkflow(args: {
  originalQuery: string;
  sessionId: string;
  queries: string[];
  dependencies?: {
    query_index: number;
    depends_on: number[];
  }[];
}): Workflow {
  const { originalQuery, sessionId, queries, dependencies } = args;

  // create sub tasks
  const subTasks: Record<string, SubTask> = {};
  queries.forEach((q, i) => {
    const id = uuid();
    subTasks[id] = {
      id,
      query: q,
      queryIndex: i,
      status: 'pending',
      dependsOn: dependencies?.find(d => d.query_index === i) ? [i] : []
    };
  });

  return {
    workflowId: uuid(),
    originalQuery,
    sessionId,
    status: 'pending',
    subTasks,
    metadata: {
      totalTasks: queries.length,
      completedCount: 0,
      failedCount: 0,
      runningCount: 0
    },
    createdAt: new Date().toISOString(),
    results: {}
  };
}
