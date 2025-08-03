import { v4 as uuidv4 } from "uuid";
import { emit } from "./task.browser.helpers";

/*
** handler for coupling task with event emitter
*/
export async function handler(
    task: () => Promise<any>, 
    payload: any
): Promise<{actionId: string, response: any, error: string | null}> {

    const actionId = uuidv4();
    let response: any = null;

    /*
    ** emit start
    */
    emit("task_action_start", {
        actionId,
        ...payload
    });

    /*
    ** run the task
    */
    try {
        response = await task();

        /*
        ** emit success
        */
        emit("task_action_complete", {
            actionId,
            ...payload,
            status: "success"
        });
    } catch (error) {
        /*
        ** emit error
        */
        console.log("error", error.message);
        emit("task_action_error", {
            actionId,
            ...payload,
            error: error.message,
            status: "error"
        });
        return {
            actionId,
            response,
            error: error.message
        };
    }

    /*
    ** return the response
    */
    return {
        actionId,
        response,
        error: null
    };
}