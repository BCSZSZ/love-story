import { useCallback, useEffect, useState } from 'react';

interface AdminAuthSettings {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  redirectUri?: string;
  scope?: string;
}

interface StoredTokens {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_KEY = 'tls:admin:tokens:v1';
const PKCE_KEY = 'tls:admin:pkce:v1';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function challenge(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

function readTokens(): StoredTokens | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as StoredTokens | null;
    return value && value.expiresAt > Date.now() + 30_000 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function useAdminAuth() {
  const [settings, setSettings] = useState<AdminAuthSettings>();
  const [tokens, setTokens] = useState<StoredTokens | undefined>(readTokens);
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'exchanging' | 'signed-in' | 'local' | 'error'>('loading');
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/v2/config/admin-auth', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('settings_failed');
        const next = await response.json() as AdminAuthSettings;
        setSettings(next);
        if (!next.enabled) {
          setStatus('local');
          return;
        }
        if (readTokens()) setStatus('signed-in');
        else setStatus('signed-out');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('error');
          setMessage('无法读取管理员登录配置。');
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!settings?.enabled || !settings.tokenEndpoint || !settings.clientId || !settings.redirectUri) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    if (params.has('error')) {
      sessionStorage.removeItem(PKCE_KEY);
      setStatus('error');
      setMessage('管理员登录未完成，请重新发起登录。');
      window.history.replaceState({}, '', `${window.location.pathname}#/admin`);
      return;
    }
    if (!code) return;
    setStatus('exchanging');
    const saved = (() => {
      try { return JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? 'null') as { verifier: string; state: string } | null; }
      catch { return null; }
    })();
    if (!saved || returnedState !== saved.state) {
      setStatus('error');
      setMessage('登录回调校验失败，请重新登录。');
      return;
    }
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: settings.clientId,
      code,
      redirect_uri: settings.redirectUri,
      code_verifier: saved.verifier,
    });
    void fetch(settings.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    }).then(async (response) => {
      if (!response.ok) throw new Error('exchange_failed');
      const payload = await response.json() as { access_token?: string; expires_in?: number };
      if (!payload.access_token) throw new Error('missing_token');
      const next = { accessToken: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(next));
      sessionStorage.removeItem(PKCE_KEY);
      setTokens(next);
      setStatus('signed-in');
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash || '#/admin'}`);
    }).catch(() => {
      setStatus('error');
      setMessage('登录授权码交换失败，请重新登录。');
    });
  }, [settings]);

  const login = useCallback(async () => {
    if (!settings?.authorizationEndpoint || !settings.clientId || !settings.redirectUri) return;
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
    const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
    const url = new URL(settings.authorizationEndpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      scope: settings.scope ?? 'openid config/write',
      state,
      code_challenge: await challenge(verifier),
      code_challenge_method: 'S256',
    }).toString();
    window.location.assign(url);
  }, [settings]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setTokens(undefined);
    setStatus(settings?.enabled ? 'signed-out' : 'local');
  }, [settings]);

  const adminFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (tokens?.accessToken) headers.set('authorization', `Bearer ${tokens.accessToken}`);
    return fetch(input, { ...init, headers });
  }, [tokens]);

  return { settings, status, message, login, logout, adminFetch, authenticated: status === 'signed-in' || status === 'local' };
}
