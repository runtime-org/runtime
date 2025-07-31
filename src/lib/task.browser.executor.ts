import { v4 as uuidv4 } from "uuid";
import { ExecOps } from "./task.browser.schemas";
import { actionDesc, StepRunnerRegistry } from "./task.browser.runner";
import { emit } from "./task.browser.helpers";
// import { Browser } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";

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
        **  build params map visible to a single skill page
        */
        const stepParams: Record<string, unknown> = {
            ...step.parameters,
            ...history
        };

        if ("text" in stepParams) stepParams.text = stepParams.text as string;
        if ("number" in stepParams) stepParams.number = stepParams.number as number;

        console.log("stepParams", stepParams);

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
                ** run the step
                */
                const result = await StepRunnerRegistry[step.action](step, { 
                    page, 
                    params: stepParams,
                    browser
                });
                console.log("result", result);

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