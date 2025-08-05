import { emit, detectDomains, serializeResult, summariseSegment } from "./task.browser.helpers";
import { 
    BrowserRunOptions
} from "./task.browser.schemas";

import { SkillRegistry } from "./task.browser.skill.registry";
import { handler } from "./task.helpers";
import { generateMacroPlan } from "./task.browser.skill.resolver";
import { executeMacroPlan } from "./task.browser.executor";
import { synthesizeResultsBrowsing } from "./task.execution.llm";
import { v4 as uuidv4 } from 'uuid';
import { useAppState } from "../hooks/useAppState";

/*
** run a browser task
*/
export async function runBrowserAction(opts: BrowserRunOptions) {
    const { 
        taskId, 
        originalQuery, 
        browserInstance, 
        pageManager, 
        steps
    } = opts;

    const { setSynthesisInProgress } = useAppState.getState();

    const currentPage = await pageManager();

    const payload_detect_website_intent = {
        taskId,
        action: "detect_website_intent",
        status: "running",
        speakToUser: "Identifying the website you want to interact with, it will help me to understand your request better."
    }

    /*
    ** domain detection
    */
    const { 
        response: response_detect_website_intent,
        error: error_detect_website_intent,
        // actionId
    } = await handler(
        async () => await detectDomains({query: originalQuery, steps}),
        payload_detect_website_intent
    );

    if (error_detect_website_intent) return;

    console.log("domains", response_detect_website_intent);
    const domains = response_detect_website_intent;


    let remainingQuery = originalQuery;
    console.log("remainingQuery", remainingQuery);
    let globalHistory: Record<string, unknown> = {};


    /* 
    ** process each domains sequentially
    */
    for (const domain of domains) {
        const skillMaps = await new SkillRegistry().byDomains([domain]);

        /*
        ** generate the macro plan
        */
        const plan = await generateMacroPlan({
            sites: skillMaps,
            query: remainingQuery,
            context: globalHistory
        });
        console.log("plan", plan);

        const segmentHistory = await executeMacroPlan({
            taskId,
            browser: browserInstance,
            pageManager,
            plan,
            skillMaps
        });
        Object.assign(globalHistory, segmentHistory);

        /*
        ** summarize and refine for next domain
        */
        if (domain !== domains.at(-1)) {            // only if more sites remain
            const summary = await summariseSegment({
              query: remainingQuery,
              segmentHistory,
              model: "gemini-2.5-flash"
            });
      
            if (summary.next_query?.trim()) {
                remainingQuery = summary.next_query.trim();
            }
        }
    }

    /*
    ** serialize the result
    */
    setSynthesisInProgress(taskId, true);
    const serializedResults = Object
        .entries(globalHistory)
        .map(([k, v]) => serializeResult(k, v));

    /*
    ** synthesize the result
    */
    const finalResult = await synthesizeResultsBrowsing(
        originalQuery, 
        serializedResults,
        "gemini-2.5-flash"
    );

    setSynthesisInProgress(taskId, false);

    emit("workflow_update", { 
        taskId, 
        action: "done", 
        status: "completed", 
        speakToUser: finalResult,
        error: null
    });

}
