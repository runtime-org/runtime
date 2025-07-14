/*
** shared memory
*/
export interface SharedMemory {
  get:  (k: string) => any;
  set:  (k: string, v: any) => void;
  clear: () => void;
}
  
/*
** make memory
*/
export function makeMemory(): SharedMemory {
  const m = new Map<string, any>();
  return {
    get: k => m.get(k),
    set: (k, v) => m.set(k, v),
    clear: () => m.clear()
  };
}
  