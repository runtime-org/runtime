import { v4 as uuidv4 } from 'uuid';

import { callLLM } from "./llm.engine";
// @ts-ignore
import { handlePuppeteerAction } from "./pptr";
import { systemPrompt } from "./prompt";
import { ActionDeclarations } from "./tools";
import { PromptContext } from './prompt.schema';
import { RunOptions } from "./task.execution.schemas";
import { 
    getFnCall, 
    emit, 
    trimHistory, 
    semanticExplanation,
    semanticPptrExplanation
} from "./task.execution.helpers";

export async function runSequentialTask(opts: RunOptions) {
    const {
        originalQuery, subQuery, taskId,
        browserInstance, pageManager,
        model = 'gemini-2.5-flash'
    } = opts;

    let history: any[] = [];

    /*
    ** emit
    */
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
    */
    while (step < 30) {
        /*
        ** prepare the request payload
        */
        const contents = [
            { role: "user", parts: [ { text: subQuery } ] },
            ...trimHistory(history)
        ]

        const config = {
            temperature: 0.0,
            maxOutputTokens: 2048,
            mode: 'ANY',
            systemInstruction: systemPrompt(promptContext),
            tools: [{ functionDeclarations: [ActionDeclarations] }]
        };

        /*
        ** thinking
        ** send LLM action generation request with Action Declarations as tools
        */
        const llmActionId = uuidv4();
        emit('task_action_start', { taskId, action: '__thinking__', speakToUser: 'Thinking...', actionId: llmActionId });
        const response = await callLLM({ modelId: model, contents, config });
        console.log("response", response)
        emit('task_action_complete', { taskId, action: '__thinking__', speakToUser: 'Thinking...', actionId: llmActionId, status: 'success' });

        /*
        ** process the response
        */
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
        */
        if (fn.name === 'done') {
            emit('task_action_complete', { taskId, action:'done', parameters:fn.args, status:'completed' });
            opts.onDone?.(fn.args?.text ?? '');
            // await currentPage.close();
            return fn.args?.text;
        }

        /*
        ** execute pptr action
        */
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
        */
        if (!puppeteerRes.success) {
            opts.onError?.(puppeteerRes.error || 'browser action failed');
            return;
        }
        if (puppeteerRes?.data?.visibleText) {
            console.log("visibleText", puppeteerRes?.data?.visibleText)
        }

        const semanticPptrResult = semanticPptrExplanation(fn.name, fn.args);
        history.push(
            { role:'assistant', parts:[ { functionCall: { name: fn.name, args: fn.args } } ] },
            { role:'user', parts:[{text: semanticPptrResult}] }
        );

        /*
        ** cap to 20 messages
        */
        let cloneHistory = JSON.parse(JSON.stringify(history));
        if (cloneHistory.length > 20) {
            cloneHistory = cloneHistory.slice(-20);
            history = cloneHistory;
        }
    
        step += 1;
    }

    // console.log(`--- speakToUser: done executing`);
    // emit('task_action_complete', {
    //     taskId, action: 'done',
    //     status: 'success',
    //     speakToUser: 'success',
    //     error:  null
    // });
}