import { v4 as uuidv4 } from "uuid";
import { ExecOps } from "./task.browser.schemas";
import { actionDesc, StepRunnerRegistry } from "./task.browser.runner";
import { emit } from "./task.browser.helpers";
// import { Browser } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";

function findValidUrl(list: any[]) {
    // go through the list and find the first valid raw element
    for (const item of list) {
        if (item.link && item.link.startsWith("https://")) {
            return item;
        }
    }
    return undefined;
}

export async function executeMacroPlan({
    taskId,
    pageManager,
    browser,
    plan,
    skillMaps
}: ExecOps) {
    const page = await pageManager();
    const history: Record<string, unknown> = {};

    for (const step of plan.skills) {
        /*
        ** find the skill definition
        */
        const skillDef = skillMaps
            .flatMap(s => s.skills)
            .find(s => s.name === step.skill);

        /*
        ** build params map visible to a single skill page
        */
        let stepParams: Record<string, unknown> = {
            ...step.parameters,
            ...history
        };

        if ("text" in stepParams) stepParams.text = stepParams.text as string;
        if ("number" in stepParams) stepParams.number = stepParams.number as number;
        if ("times" in stepParams) stepParams.times = stepParams.times as number;
        
        /*
        ** original text for splitting
        */
        const originalText = stepParams.text;

        const planId = uuidv4();
        emit("task_action_start", {
            taskId,
            action: "plan_execution",
            speakToUser: "Executing the user request",
            status: "running",
            actionId: planId
        });

        /*
        ** run every low level step
        */
        if (skillDef?.name === "open_result_by_index") {
            const list = history.results as { link?: string; selector?: string }[] | undefined;
            const idx = (stepParams.index ?? 0) as number;

            if (list?.[idx]?.link) {
                const element = findValidUrl(list);
                stepParams.url_override = element?.link;
                // console.log("+++++>", element);
            } else if (list?.[idx]?.selector) {
                stepParams.selector_override = list[idx]!.selector; 
            } else {
                throw new Error(`Result list empty or index ${idx} missing`);
            }
        }
        for (const step of skillDef?.steps || []) {
            const actionId = uuidv4();

            emit("task_action_start", {
                taskId,
                action: step.action,
                speakToUser: actionDesc(step.action),
                status: "running",
                actionId
            });

            try {
                /*
                ** handle text splitting for split parameters
                */
                if (step.split && originalText && typeof originalText === "string") {
                    const [title, body] = (originalText as string).split("<<<rt-space>>>", 2);
                    
                    if (step.split === "before") {
                        stepParams.text = title.trim();
                    } else if (step.split === "after") {
                        stepParams.text = body?.trim() ?? "";
                    }
                }

                /*
                ** run the step
                */
                /*
                ** in case use the current url is https://mail.google.com, then split the query and join using OR
                ** and only add the OR if the step is type and the selector is input[name='q']
                */
                if (step.action === "type" && stepParams.text) {
                    const url = new URL(page.url());
                    if (url.hostname === "mail.google.com" && step.selector === "input[name='q']") {
                        stepParams.text = (stepParams.text as string).split(" ").join(" OR ");
                    }
                }
                const result = await StepRunnerRegistry[step.action](step, { 
                    page, 
                    params: stepParams,
                    browser
                });
                console.log("------->", step.action, result);

                if (step.output_key)  history[step.output_key] = (result as { success: true, data: unknown }).data;

                emit("task_action_complete", {
                    taskId,
                    action: step.action,
                    status: "success",
                    actionId
                });
            } catch (error) {
                emit("task_action_end", {
                    taskId,
                    action: step.action,
                    status: "error",
                    actionId,
                    error: error.message
                });
                throw error;
            }
        }

        emit("task_action_complete", {
            taskId,
            action: "plan_execution",
            status: "success",
            actionId: planId
        });
    }

    return history;
}