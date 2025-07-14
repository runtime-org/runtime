export interface RunOptions {
    originalQuery: string;
    queries: string[];
    dependencies: {
        query_index: number;
        depends_on: number[];
    }[];
    taskId: string;
    sessionId: string;
    browserInstance: any;
    pageManager: any;

    model?: string;
    onDone?: (text: any) => void;
    onError?: (error: any) => void;
}

/*
** extend RunOptions so the workflow runner can pass queries + deps
*/
export interface SeqRunOptions extends RunOptions {
    queries: string[];
    dependencies: {
        query_index: number;
        depends_on: number[];
    }[];
}