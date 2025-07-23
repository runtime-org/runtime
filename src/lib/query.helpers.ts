/*
** build a digest of the recent conversation
*/
const MAX_HISTORY_PAIRS = 12;
export function buildHistoryDigest(msgs: any[]): string {
    const pairs: string[] = [];
    let pendingUser: string | null = null;

    for (const m of msgs) {
        if (m.type === 'user') {
            pendingUser = m.text?.trim() ?? '';
        } else if ( m.type === 'system' && m.text?.trim() ) {
            if (pendingUser) {
                pairs.push(`User: ${pendingUser}\nAssistant: ${m.text.trim()}`);
                pendingUser = null;
            }
        }
    }

  return pairs.slice(-MAX_HISTORY_PAIRS).join('\n\n');
}

/*
** add and update plan to task
*/
export function addPlanToTask({tasks, taskId, newPlan}) {
    return tasks.map(t => 
        t.taskId === taskId ? { ...t, plans: [...t.plans, newPlan] } : t
    )
}
export function updatePlanInTask({tasks, taskId, actionId, status, error}) {
    return tasks.map(t => 
        t.taskId === taskId 
        ? {
            ...t,
            plans: t.plans.map(p => 
                p.id === actionId ? { ...p, status, error } : p
            )
            }
        : t
    )
}