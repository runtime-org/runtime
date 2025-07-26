
/*
** split query
*/
export interface SplitQueryResponse {
  kind: string;
  queries?: string[];
  dependencies?: { query_index: number, depends_on: number[] }[];
  researchFlags?: boolean[];
  reply?: string;
}
