import { v4 as uuidv4 } from 'uuid';

import { handlePuppeteerAction } from "./pptr";
import { SeqRunOptions } from "./task.execution.schemas";
import { 
    emit, 
    pushHistory,
} from "./task.execution.helpers";
import { synthesizeResults } from "./task.execution.llm";
import { stepTranslator, planGenerator } from "./plan.orchestrator";


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

        /*
        ** build a deterministic step list
        */

        const steps = await planGenerator({ 
            subQuery, 
            queries, 
            dependencies, 
            results
        });
        console.log("steps", steps);

        /*
        ** conversation context for stepTranslator
        */
        let history: any[] = [];

        const currentPage = await pageManager();

        /*
        ** run steps
        */
        for (let s=0; s<steps.length; s++) {
            const sentence = steps[s];

            const toolCall = await stepTranslator(sentence, history);

            if (!toolCall) {
                console.log(`Translator failed at step ${s} for ${subQuery}`);
                opts.onError?.(`Translator failed at step ${s} for ${subQuery}`);
                return;
            }

            if (toolCall.name === 'done') {
                console.log("toolCall", toolCall);
                results[qIdx] = toolCall.args?.text;
                emit("task_action_complete", {
                    taskId,
                    action: 'done',
                    status: 'completed',
                    speakToUser: toolCall.args?.text ?? '',
                    error: null
                })
                break;
            }

            /*
            ** run puppeteer action with one retry
            */
            const actionId = uuidv4();
            emit("task_action_start", {
                taskId,
                action: toolCall.name,
                speakToUser: sentence,
                actionId,
                status: 'running'
            })

            let pptrRes = await handlePuppeteerAction({
                actionDetails: {
                    action: toolCall.name,
                    parameters: toolCall.args,
                    taskId
                },
                currentPage,
                browserInstance
            })
            if (toolCall.name === 'get_simplified_page_context') {
                console.log("pptrRes", pptrRes);
            }

            if (!pptrRes.success) {
                /*
                ** retry once after 2s
                */
                await new Promise(resolve => setTimeout(resolve, 2000));
                pptrRes = await handlePuppeteerAction({
                    actionDetails: {
                        action: toolCall.name,
                        parameters: toolCall.args,
                        taskId
                    },
                    currentPage,
                    browserInstance
                })
            }

            emit("task_action_complete", {
                taskId,
                action: toolCall.name,
                speakToUser: sentence,
                status: pptrRes.success ? 'success' : 'failed',
                error: pptrRes.success ? undefined : pptrRes.error,
                actionId
            })

            if (!pptrRes.success) {
                opts.onError?.(pptrRes.error || 'browser action failed');
                return;
            }

            /* store visible text if this step might answer the SQ directly */
            if (pptrRes.data?.visibleText && !results[qIdx]) {
                results[qIdx] = pptrRes.data.visibleText.slice(0, 10048);
              }

            /*
            ** push action generated and the result to history
            */
            pushHistory(history, toolCall.name, toolCall.args, pptrRes.data);

            /*
            ** cap to 20 messages
            */
            if (history.length > 20) history = history.slice(-20);
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