import { supabase } from '@/lib/supabase';

type RedirectResult = Awaited<ReturnType<typeof exchangeAuthRedirect>>;
const callbackExchanges = new Map<string, Promise<RedirectResult>>();

export function completeAuthRedirect(url: string) {
  const existing = callbackExchanges.get(url);
  if (existing) return existing;
  const exchange = exchangeAuthRedirect(url);
  callbackExchanges.set(url, exchange);
  void exchange.then(
    () => setTimeout(() => callbackExchanges.delete(url), 30_000),
    () => setTimeout(() => callbackExchanges.delete(url), 30_000),
  );
  return exchange;
}

async function exchangeAuthRedirect(url: string) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const type = query.get('type') || hash.get('type');
  const errorDescription = query.get('error_description') || hash.get('error_description');
  if (errorDescription) throw new Error(errorDescription.replace(/\+/g, ' '));

  const code = query.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return { session: data.session, type };
  }
  const accessToken = hash.get('access_token') || query.get('access_token');
  const refreshToken = hash.get('refresh_token') || query.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return { session: data.session, type };
  }
  throw new Error('The sign-in link is incomplete or expired. Request a new one.');
}
