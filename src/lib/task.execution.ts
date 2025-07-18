import { v4 as uuidv4 } from 'uuid';

import { handlePuppeteerAction } from "./pptr";
import { SeqRunOptions } from "./task.execution.schemas";
import { 
    emit, 
    pushHistory,
} from "./task.execution.helpers";
import { synthesizeResults } from "./task.execution.llm";
import { stepTranslator, planGenerator, evalEngine } from "./plan.orchestrator";


export async function runSequentialTask(opts: SeqRunOptions) {
    const {
        taskId,
        queries, 
        dependencies, 
        pageManager,
        originalQuery, 
        browserInstance, 
        model = 'gemini-2.5-flash'
    } = opts;

    /*
    ** shared memory across queries tasks
    */
    const results: (string | undefined)[] = Array(queries.length).fill(undefined);

    /*
    ** iterate through SQ1, SQ2, ... SQn
    */
    for (let qIdx = 0; qIdx < queries.length; qIdx++) {
        const subQuery = queries[qIdx];
        console.log(`SQ${qIdx}: ${subQuery}`);
        let feedback   = "";
        let attempts   = 0;
        let planDone   = false;

        /*
        ** build a deterministic plan -> steps 
        */
        while (!planDone && attempts < 5) {
            attempts++;

            const steps = await planGenerator({
                subQuery,
                queries,
                dependencies,
                results,
                feedback
            });

        
            if (!steps.length) {
                opts.onError?.(`Empty plan for SQ${qIdx}`);
                console.log(`SQ${qIdx} failed: empty plan`);
                continue;
            }

            /*
            ** conversation context for stepTranslator
            */
            let history: any[] = [];
            const currentPage = await pageManager();
            let finalAnswer   = "";

            /* 
            ** run steps
            */
            for (let s = 0; s < steps.length; s++) {
                const sentence = steps[s];
                const toolCall = await stepTranslator(sentence, history);

                if (!toolCall) {
                    opts.onError?.(`Translator failed at step ${s} of SQ${qIdx}`);
                    console.log(`SQ${qIdx} failed: translator failed at step ${s}`);
                    continue;
                }

                /* 
                ** plan is done
                */
                if (toolCall.name === "done") {
                    finalAnswer = toolCall.args?.text ?? "";
                    console.log(`SQ${qIdx} done: ${finalAnswer}`);
                    emit("task_action_complete", {
                        taskId,
                        action : "done",
                        status : "success",
                        speakToUser: finalAnswer,
                        error  : null,
                        actionId: uuidv4()
                    });
                    break;
                }

                /* 
                ** run Puppeteer action with one retry
                */
                const actionId = uuidv4();
                emit("task_action_start", { 
                    taskId, 
                    action: toolCall.name, 
                    speakToUser: sentence, 
                    actionId, 
                    status:"running" 
                });

                let pptrRes = await handlePuppeteerAction({
                    actionDetails: { 
                        action: toolCall.name, 
                        parameters: toolCall.args, 
                        taskId 
                    },
                    currentPage,
                    browserInstance
                });
                
                if (!pptrRes.success) {
                    /*
                    ** retry once after a delay (2s)
                    */
                    await new Promise(r => setTimeout(r, 2000));
                    pptrRes = await handlePuppeteerAction({
                        actionDetails: { 
                            action: toolCall.name, 
                            parameters: toolCall.args, 
                            taskId 
                        },
                        currentPage,
                        browserInstance
                    });
                }

                emit("task_action_complete", {
                    taskId,
                    action: toolCall.name,
                    speakToUser: sentence,
                    status: pptrRes.success ? "success" : "failed",
                    error: pptrRes.success ? undefined : pptrRes.error,
                    actionId
                });

                /*
                ** in case of pptr failure, do not emit error, retry again the task
                */
                if (!pptrRes.success) {
                    console.log(`SQ${qIdx} failed: ${pptrRes.error}`);
                    finalAnswer = "failed execution, retry again";
                } 

                /* store visible text if this step might answer the SQ directly */
                // if (pptrRes.data?.visibleText && !finalAnswer)
                //    finalAnswer = pptrRes.data.visibleText.slice(0, 10048);
                // }

                /* 
                ** push action generated and the result to history
                */
                pushHistory(history, toolCall.name, toolCall.args, pptrRes.data);
            
                /*
                ** cap to 20 messages
                */
                if (history.length > 20) history = history.slice(-20);
            }

            /*
            ** evaluate completeness of the current plan
            */
            const evalRes = await evalEngine({
                originalQuery,
                subQuery,
                answer: finalAnswer
            });
            if (evalRes.complete) {
                results[qIdx] = finalAnswer;
                planDone      = true;
            } else {
                feedback = evalRes.feedback || "(answer incomplete)";
                console.log(`SQ${qIdx} failed: ${feedback}`);
                //   emit("task_action_complete", {
                //     taskId,
                //     action : "evaluation",
                //     status : "error",
                //     speakToUser: `Retrying SQ${qIdx}: ${feedback}`,
                //     error  : feedback,
                //     actionId: uuidv4()
                //   });
            }
        }

        /*
        ** if the plan is not done or error, avoid retruning an error
        */
        if (!planDone) {
            console.log(`SQ${qIdx} failed after 5 retries`);
            results[qIdx] = "failed execution, retry again";
            planDone = true;
        }
    }

    console.log("results", results);
    const finalResult = await synthesizeResults(originalQuery, results, model);

    /*
    ** emit completion
    */
    emit("workflow_update", {
        taskId, 
        action: 'done', 
        status: 'completed', 
        speakToUser: finalResult, 
        error: null 
    });
    opts.onDone?.(finalResult);
}