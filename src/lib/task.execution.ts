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
            console.log(`sentence: ${sentence} -> toolCall: ${JSON.stringify(toolCall)}`);

            if (!toolCall) {
                console.log(`Translator failed at step ${s} for ${subQuery}`);
                opts.onError?.(`Translator failed at step ${s} for ${subQuery}`);
                return;
            }

            if (toolCall.name === 'done') {
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
            const explanation = semanticExplanation(toolCall.name, toolCall.args);
            const actionId = uuidv4();
            emit("task_action_start", {
                taskId,
                action: toolCall.name,
                speakToUser: explanation,
                actionId
            })
            console.log(`running ${toolCall.name} with args: ${JSON.stringify(toolCall.args)}`);
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

            emit("task_action_complete", {
                taskId,
                action: toolCall.name,
                speakToUser: semanticPptrExplanation(toolCall.name, toolCall.args),
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
    emit("task_action_complete", {
        taskId, 
        action: 'done', 
        status: 'completed', 
        speakToUser: 'success', 
        error: null 
    });
    opts.onDone?.("Workflow finished");
}


















    // --------------------------------------------------------------------------

    /*
    /*
    ** emit

    emit('task_update', { 
        taskId, action: "start", speakToUser: subQuery, status: "initial"
    });
    console.log(`initial -> ${subQuery}`);

    let step = 0;
    const currentPage = await pageManager();
    const promptContext: PromptContext = {
        originalQuery,
        subQuery,
        currentUrl: currentPage?.url() ?? '',
    }

    /*
    ** run the cycle -> start the sub task
    *
    while (step < 30) {
        /*
        ** prepare the request payload
        *
        const contents = [
            { role: "user", parts: [ { text: subQuery } ] },
            ...trimHistory(history)
        ]

        const config = {
            temperature: 0.0,
            : 2048,
            mode: 'ANY',
            systemInstruction: systemPrompt(promptContext),
            tools: [{ functionDeclarations: [ActionDeclarations] }]
        };

        /*
        ** thinking
        ** send LLM action generation request with Action Declarations as tools
        *
        const llmActionId = uuidv4();
        emit('task_action_start', { taskId, action: '__thinking__', speakToUser: 'Thinking...', actionId: llmActionId });
        const response = await callLLM({ modelId: model, contents, config });
        console.log("response", response)
        emit('task_action_complete', { taskId, action: '__thinking__', speakToUser: 'Thinking...', actionId: llmActionId, status: 'success' });

        /*
        ** process the response
        *
        const fn = getFnCall(response);
        
        if (!fn) {
            const msg = 'LLM response contained no function call';
            console.log("msg", msg)
            emit('task_action_error', { taskId, action:'llm_missing_call', error: msg, actionId: llmActionId });
            opts.onError?.(msg);
            return;
        }

        /*
        ** terminal call
        *
        if (fn.name === 'done') {
            emit('task_action_complete', { taskId, action:'done', parameters:fn.args, status:'completed' });
            opts.onDone?.(fn.args?.text ?? '');
            // await currentPage.close();
            return fn.args?.text;
        }

        /*
        ** execute pptr action
        *
        const explanation = semanticExplanation(fn.name, fn.args);
        const pptrActionId = uuidv4();
        emit('task_action_start', { taskId, action: fn.name, speakToUser: explanation, actionId: pptrActionId });
        const puppeteerRes = await handlePuppeteerAction({
            actionDetails: { action: fn.name, parameters: fn.args, taskId },
            currentPage,
            browserInstance
        });
        console.log("puppeteerRes", puppeteerRes)
        emit('task_action_complete', { taskId, action: fn.name, speakToUser: explanation, status:'success', actionId: pptrActionId });

        /*
        ** error on browser failure
        *
        if (!puppeteerRes.success) {
            opts.onError?.(puppeteerRes.error || 'browser action failed');
            return;
        }

        const semanticPptrResult = semanticPptrExplanation(fn.name, fn.args);
        mem.push(`SQ${qIdx}:result`, puppeteerRes.result);

        /*
        ** cap to 20 messages
        *
        let cloneHistory = JSON.parse(JSON.stringify(history));
        if (cloneHistory.length > 20) {
            cloneHistory = cloneHistory.slice(-20);
            history = cloneHistory;
        }
    
        step += 1;
    }
    */
