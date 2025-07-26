
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
export function addPlanToTask({
    tasks, 
    taskId, 
    newPlan, 
    action, 
    url
}: {
    tasks: any[],
    taskId: string,
    newPlan: any,
    action: string,
    url: string
}) {

    return tasks.map(t => {
        if (t.taskId !== taskId) return t;

        const next: any = {
            ...t,
            plans: [...t.plans, newPlan]
        }

        if (action === "go_to_url") {
            console.log("url", url);
            next.tabs = [...t.tabs, url]
        }
        return next;
    })
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