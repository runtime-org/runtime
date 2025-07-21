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
    dependencies,
    browserInstance,
    researchFlags
  } = opts;

  const pageManager = createPagePool({ browser: browserInstance });

  /*  
  ** create workflow
  */
  makeWorkflow({ originalQuery, sessionId, queries, dependencies });

  /* 
  ** emit
  */
  const taskId = uuidv4();
  emit('workflow_update', { taskId, action: 'CREATE_WORKFLOW', speakToUser: "Starting the task", status: 'initial' });

  /*
  ** create and run a runner for each sub-query
  */
  const next = async () => {
    await runSequentialTask({
      originalQuery,
      queries,
      taskId,
      sessionId,
      pageManager,
      dependencies,
      researchFlags,
      browserInstance
    });

  };

  /*
  ** start
  */
  await next();

  /*
  ** update
  */

  // emit('workflow_update', { taskId, action:'COMPLETE_WORKFLOW', speakToUser: "Task completed", status: 'completed' });
}


