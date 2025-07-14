export interface PlanOrchestratorOptions {
    /*
    ** the sub-query to plan for
    */
    subQuery: string;
    /*
    ** full list of sub queries SQ1, SQ2, ... SQn
    */
    queries: string[];
    /*
    ** dependencies list as returned by query.splitter
    */
    dependencies: {
        query_index: number;
        depends_on: number[];
    }[];
    /*
    ** array of result already obtained.
    ** results[i] === undefined -> SQi not executed yet
    ** results[i] === string -> plain text answer of SQi
    */
    results: (string | undefined)[];
}