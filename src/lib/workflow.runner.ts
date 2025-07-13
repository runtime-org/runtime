import { v4 as uuidv4 } from 'uuid';

import { makeWorkflow } from "./workflow.helpers";
import { createPagePool } from "./page.manager";
import { runSequentialTask } from "./task.execution";
import { emit } from "./task.execution.helpers";
import { RunnerOptions } from "./workflow.schema";

export async function runWorkflow(opts: RunnerOptions) {
  const { 
    originalQuery, 
    sessionId, 
    queries, 
    concurrency = queries.length, 
    browserInstance,
  } = opts;

  const pageManager = createPagePool({ browser: browserInstance, maxTabs: concurrency });

  /*  
  ** create workflow
  */
  const wf = makeWorkflow({ originalQuery, sessionId, queries, concurrency });

  /* 
  ** emit
  */
  const taskId = uuidv4();
  emit('workflow_update', { taskId, action: 'CREATE_WORKFLOW', speakToUser: "Starting the task", status: 'initial' });

  /*
  ** create and run a runner for each sub-query
  */
  let running = 0, idx = 0;
  const next = async () => {
    if (idx >= queries.length) return;
    if (running >= concurrency) return;

    const subQuery = queries[idx++];

    running++;
    await runSequentialTask({
      originalQuery,
      subQuery,
      taskId,
      sessionId,
      pageManager,
      browserInstance
    });

    running--;
    await next();
  };

  /*
  ** start
  */
  const starters = Array.from({ length: concurrency }).map(() => next());
  await Promise.all(starters);

  /*
  ** update
  */

  // emit('workflow_update', { taskId, action:'COMPLETE_WORKFLOW', speakToUser: "Task completed", status: 'completed' });
}


