import { ConnectionError } from './connectionError.ts';

/** All redirects are chosen from server configuration; client origins are not trusted. */
export function connectionCallback(body: Record<string, unknown>) {
  const native = Deno.env.get('TOOL_NATIVE_CALLBACK_URL') || 'tarsai://tools';
  const web = Deno.env.get('TOOL_WEB_CALLBACK_URL');
  const allowed = (Deno.env.get('TOOL_CALLBACK_URLS') || native).split(',').map(value => value.trim()).filter(Boolean);
  const validate = (value: string) => {
    let url: URL;
    try { url = new URL(value); } catch { throw new ConnectionError(400, 'The connection return URL is invalid.'); }
    if (url.username || url.password || url.hash || url.search || !allowed.includes(url.href)) throw new ConnectionError(400, 'This connection callback is not allowed. Configure TOOL_CALLBACK_URLS on the server.');
    if (!['https:', 'tarsai:'].includes(url.protocol) && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new ConnectionError(400, 'Use a configured app return URL or HTTPS callback.');
    return url.href;
  };
  // Validate legacy client input as well. Never silently accept an arbitrary URL.
  if (body.callbackUrl !== undefined) {
    if (typeof body.callbackUrl !== 'string') throw new ConnectionError(400, 'The connection return URL is invalid.');
    return validate(body.callbackUrl);
  }
  if (body.callbackTarget === 'hosted') return undefined;
  if (body.callbackTarget === 'web') return web ? validate(web) : undefined;
  if (body.callbackTarget !== undefined && body.callbackTarget !== 'native') throw new ConnectionError(400, 'Choose a supported connection return target.');
  return validate(native);
}
