export type ChatStreamEvent = { type: string; delta?: string; name?: string; data?: Record<string, any>; message?: string };

/** Incremental SSE decoding, including UTF-8 and frames split across packets. */
export async function consumeChatStream(body: ReadableStream<Uint8Array>, onEvent: (event: ChatStreamEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', result: Record<string, any> | undefined;
  const frame = (value: string) => {
    const payload = value.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!payload) return;
    const event = JSON.parse(payload) as ChatStreamEvent;
    if (event.type === 'error') throw new Error(event.message || 'The reply stream was interrupted. Retry safely.');
    if (event.type === 'result') result = event.data;
    else onEvent(event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      if (buffer.length > 1000000) throw new Error('The response exceeded the stream limit. Retry safely.');
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) { frame(buffer.slice(0, end)); buffer = buffer.slice(end + 2); }
      if (done) break;
    }
    if (buffer.trim()) frame(buffer);
  } finally { reader.releaseLock(); }
  if (!result) throw new Error('The connection ended before the reply was saved. Retry safely to recover it.');
  return result;
}
