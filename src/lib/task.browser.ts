
import { emit, detectDomains } from "./task.browser.helpers";
import { 
    BrowserRunOptions
} from "./task.browser.schemas";

import { SkillRegistry } from "./task.browser.skill.registry";
import { handler } from "./task.helpers";
import { generateMacroPlan } from "./task.browser.skill.resolver";
import { executeMacroPlan } from "./task.browser.executor";

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

    const skill_maps = await new SkillRegistry().byDomains(domains)

    console.log("skillMap", skill_maps);

    /*
    ** generate the skill plan
    */
    const plan = await generateMacroPlan({sites: skill_maps, query: originalQuery});
    console.log("plan", plan);

    /*
    ** execute the macro plan
    */
    const history = await executeMacroPlan({
        taskId,
        browser: browserInstance,
        pageManager,
        plan,
        skillMaps: skill_maps
    });

    console.log("history", history);

    /*
    ** update the workflow
    */
    emit("workflow_update", {
        taskId,
        action: "done",
        status: "completed",
        speakToUser: "Task completed",
        error: null
    });




}
