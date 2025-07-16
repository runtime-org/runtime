import { v4 as uuidv4 } from 'uuid';

import { handlePuppeteerAction } from "./pptr";
import { SeqRunOptions } from "./task.execution.schemas";
import { 
    emit, 
    pushHistory, 
    // trimHistory, 
    semanticExplanation,
    semanticPptrExplanation
} from "./task.execution.helpers";
import { makeMemory, SharedMemory } from "./task.execution.memory";
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
    const mem: SharedMemory = makeMemory();

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
            results: queries.map((_, i) => mem.get(`SQ${i}:result`))
        });
        // console.log("steps", steps);

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
            // console.log(`sentence: ${sentence} -> toolCall: ${JSON.stringify(toolCall)}`);

            if (!toolCall) {
                console.log(`Translator failed at step ${s} for ${subQuery}`);
                opts.onError?.(`Translator failed at step ${s} for ${subQuery}`);
                return;
            }

            if (toolCall.name === 'done') {
                console.log("emit task_action_complete", {
                    taskId,
                    action: 'done',
                    status: 'completed',
                    speakToUser: toolCall.args?.text ?? '',
                    error: null
                })
                emit("task_action_complete", {
                    taskId,
                    action: 'done',
                    status: 'completed',
                    speakToUser: toolCall.args?.text ?? '',
                    error: null
                })
                if (toolCall.args?.text) {
                    mem.set(`SQ${qIdx}:result`, toolCall.args?.text);
                }
                break;
            }

            /*
            ** run puppeteer action with one retry
            */
            // const explanation = semanticExplanation(toolCall.name, toolCall.args);
            const actionId = uuidv4();
            console.log("emit task_action_start", {
                taskId,
                action: toolCall.name,
                speakToUser: sentence,
                actionId
            })
            emit("task_action_start", {
                taskId,
                action: toolCall.name,
                speakToUser: sentence,
                actionId
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

            console.log("emit task_action_complete", {
                taskId,
                action: toolCall.name,
                speakToUser: sentence,
                status: pptrRes.success ? 'success' : 'failed',
                error: pptrRes.success ? undefined : pptrRes.error,
                actionId
            })

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

    /*
    ** emit completion
    */
    console.log("emit task_action_complete", {
        taskId,
        action: 'done',
        status: 'completed',
        speakToUser: 'success',
        error: null
    })
    emit("task_action_complete", {
        taskId, 
        action: 'done', 
        status: 'completed', 
        speakToUser: 'success', 
        error: null 
    });
    opts.onDone?.("Workflow finished");
}