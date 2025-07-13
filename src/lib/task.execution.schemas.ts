export interface RunOptions {
    originalQuery: string;
    subQuery: string;
    taskId: string;
    sessionId: string;
    browserInstance: any;
    pageManager: any;

    model?: string;
    onDone?: (text: any) => void;
    onError?: (error: any) => void;
}