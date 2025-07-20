/*
** history digest builder
*/
const MAX_HISTORY_PAIRS = 20;
export function buildHistoryDigest(msgs: any[]) {
  /*
  ** keep only user + completed system messages
  */
  const pairs: string[] = [];
  for (let i = msgs.length - 1; i >= 0 && pairs.length < MAX_HISTORY_PAIRS; i--) {
    const m = msgs[i];
    if (m.type === 'system' && m.status === 'complete' && m.text) {
      /*
      ** we expect the user message to be right before this system message
      */
      const user = msgs[i - 1];
      if (user && user.type === 'user') {
        pairs.unshift(`User: ${user.text}\nAssistant: ${m.text}`);
      }
    }
  }
  return pairs.join('\n\n');
}