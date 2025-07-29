import { v4 as uuidv4 } from 'uuid';

// import { makeWorkflow } from "./workflow.helpers";
import { createPagePool } from "./page.manager";
import { runSequentialTask } from "./task.execution";
import { emit } from "./task.execution.helpers";
import { RunnerOptions } from "./workflow.schema";
import { runBrowserAction } from "./legacy/task.browser.legacy";

export async function runWorkflow(opts: RunnerOptions) {
  const { 
    mode,
    originalQuery, 
    sessionId, 
    queries, 
    dependencies,
    browserInstance,
    researchFlags,
    steps
  } = opts;


  const pageManager = createPagePool({ browser: browserInstance });
  /* 
  ** emit
  */
  const taskId = uuidv4();
  emit('workflow_update', { taskId, action: 'CREATE_WORKFLOW', speakToUser: "Starting the task", status: 'initial' });

  if (mode === "browser_action") {
    /*
    ** create and run a runner for the browser action
    */
    console.log("steps", steps);
    await runBrowserAction({
      taskId,
      sessionId,
      steps,
      originalQuery,
      pageManager,
      browserInstance,
    });
  } else if (mode === "analysis") {
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

  }
}


