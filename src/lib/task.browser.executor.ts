import { v4 as uuidv4 } from "uuid";
import { ExecOps } from "./task.browser.schemas";
import { actionDesc, StepRunnerRegistry } from "./task.browser.runner";
import { emit } from "./task.browser.helpers";

const MAX_ATTEMPTS = 3;

function findValidUrl(list: any[]) {
    // go through the list and find the first valid raw element
    for (const item of list) if (item.link?.startsWith("https://")) return item;
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
    const historyLog: Array<{
        stepName: string;
        attempt: number;
        status: "success" | "error";
        timestamp: number;
        error?: string;
    }> = [];

    for (const skillCall of plan.skills) {
        /*
        ** find the skill definition
        */
        const skillDef = skillMaps.flatMap(s => s.skills).find(s => s.name === skillCall.skill);
        if (!skillDef) throw new Error(`Skill "${skillCall.skill}" not found`);

        /*
        ** build params map visible to a single skill page
        */
        const baseParams: Record<string, unknown> = {
            ...skillCall.parameters,
            ...history,
            __history: historyLog
        };

        if ("text" in baseParams) baseParams.text = baseParams.text as string;
        if ("number" in baseParams) baseParams.number = baseParams.number as number;
        if ("times" in baseParams) baseParams.times = baseParams.times as number;

        /*
        ** original text for splitting
        */
        const originalText = baseParams.text as string | undefined;

        const planActionId = uuidv4();
        emit("task_action_start", {
            taskId,
            action: "plan_execution",
            speakToUser: "Executing the user request",
            status: "running",
            actionId: planActionId
        });

        /*
        ** run every low level step
        */
        if (skillDef.name === "open_result_by_index") {
            const list = history.results as Array<{ link?: string; selector?: string }> | undefined;
            const idx = (baseParams.index ?? 0) as number;

            if (list?.[idx]) {
                const elem = findValidUrl(list) ?? list[idx];
                if (elem.link) baseParams.url_override = elem.link;
                else baseParams.selector_override = elem.selector;
                // console.log("+++++>", elem);
            } else {
                throw new Error(`Result list empty or index ${idx} missing`);
            }
        }

        for (const step of skillDef.steps || []) {
            let attempt = 0;
            let success = false;
            let lastError: unknown;

            while (attempt < MAX_ATTEMPTS && !success) {
                ++attempt;
                const actionId = uuidv4();

                if (attempt === 1) {
                    emit("task_action_start", {
                        taskId,
                        action: step.action,
                        speakToUser: actionDesc(step.action),
                        status: "running",
                        actionId
                    });
                } 

                const stepParams = { ...baseParams };

                try {
                    /*
                    ** handle text splitting for split parameters
                    */
                    if (step.split && originalText) {
                        const [title, body] = originalText.split("<<<rt-space>>>", 2);
                        if (step.split === "before") stepParams.text = title.trim();
                        if (step.split === "after") stepParams.text = (body ?? "").trim();
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

                    if (result && typeof result === "object" && "success" in result && !(result as {success: boolean}).success) {
                        throw new Error("Step returned success: false");
                    }

                    if (step.output_key) history[step.output_key] = (result as any).data;
                    success = true;

                    emit("task_action_complete", {
                        taskId,
                        action: step.action,
                        status: "success",
                        actionId
                    });

                    historyLog.push({
                        stepName: step.action,
                        attempt,
                        status: "success",
                        timestamp: Date.now()
                    });
                } catch (err: unknown) {
                    lastError = err;
                    historyLog.push({
                        stepName: step.action,
                        attempt,
                        status: "error",
                        timestamp: Date.now(),
                        error: (err as Error).message
                    });

                    if (attempt >= MAX_ATTEMPTS) {
                        emit("task_action_end", {
                            taskId,
                            action: step.action,
                            status: "error",
                            actionId,
                            error: (err as Error).message
                        });
                        throw err;
                    }
                }
            }
        }

        emit("task_action_complete", {
            taskId,
            action: "plan_execution",
            status: "success",
            actionId: planActionId
        });
    }

    return history;
}