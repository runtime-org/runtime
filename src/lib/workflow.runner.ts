import { v4 as uuidv4 } from 'uuid';

// import { makeWorkflow } from "./workflow.helpers";
import { createPagePool } from "./page.manager";
import { runSequentialTask } from "./task.execution";
import { emit } from "./task.execution.helpers";
import { RunnerOptions } from "./workflow.schema";
import { runBrowserAction } from "./task.browser";
import { runTabQuery } from "./task.tab";

export async function runWorkflow(opts: RunnerOptions) {
  const { 
    mode,
    originalQuery, 
    sessionId, 
    queries, 
    dependencies,
    browserInstance,
    researchFlags,
    steps,
    pages
  } = opts;

  console.log("pages", pages);

  const pageManager = createPagePool({ browser: browserInstance });
  /* 
  ** emit
  */
  const taskId = uuidv4();
  emit('workflow_update', { taskId, action: 'CREATE_WORKFLOW', speakToUser: "Starting the task", status: 'initial' });

  /*
  ** check if we have pages to analyze
  */
  if (pages && pages.length > 0) {
      await runTabQuery({
        taskId,
        originalQuery,
        pages,
    });
  } else {

    if (mode === "browser_action") {
      /*
      ** create and run a runner for the browser action
      */
      console.log("steps", steps);
      await runBrowserAction({
        taskId,
        originalQuery,
        pageManager,
        browserInstance,
        steps
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
}


