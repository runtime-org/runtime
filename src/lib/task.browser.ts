
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


    /*
    ** load the skill map
    */
    const payload_load_skill_map = {
        taskId,
        action: "load_skill_map",
        status: "running",
        speakToUser: "Loading the skill map for the websites you want to interact with, it won't take long. It is blazing fast."
    }

    const {
        response: response_load_skill_map,
        error: error_load_skill_map,
        // actionId
    } = await handler(
        async () => await new SkillRegistry().byDomains(domains),
        payload_load_skill_map
    );

    if (error_load_skill_map) return;

    console.log("skillMap", response_load_skill_map);

    /*
    ** generate the skill plan
    */
    const plan = await generateMacroPlan({sites: response_load_skill_map, query: originalQuery});
    console.log("plan", plan);

    /*
    ** execute the macro plan
    */
    const history = await executeMacroPlan({
        taskId,
        browser: browserInstance,
        pageManager,
        plan,
        skillMaps: response_load_skill_map
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
