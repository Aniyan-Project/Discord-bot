import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  normalizeLocale,
  type Locale,
  type SessionView,
  type GuildSettings,
  type GuildSummary,
} from '../shared/domain.js'
import { hasMessage, t, type MessageKey } from '../shared/i18n.js'
export class APIError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new APIError(response.status, body.error ?? 'requestFailed')
  return body as T
}
export function useQuery<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(!!url),
    [error, setError] = useState<unknown>(null),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    apiFetch<T>(url, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [url, revision])
  return { data, loading, error, reload: () => setRevision((v) => v + 1), setData }
}
interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  tr: (key: MessageKey, params?: Record<string, string | number>) => string
}
const LanguageContext = createContext<LanguageContextValue>(null!)
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, update] = useState<Locale>(() => {
    try {
      const query = new URLSearchParams(location.search).get('lang')
      return normalizeLocale(query || localStorage.getItem('branilist.bot.locale') || navigator.language)
    } catch {
      return 'pt-BR'
    }
  })
  useEffect(() => {
    document.documentElement.lang = locale
    try {
      localStorage.setItem('branilist.bot.locale', locale)
    } catch {}
  }, [locale])
  return (
    <LanguageContext.Provider
      value={{ locale, setLocale: update, tr: (key, params) => t(locale, key, params) }}
    >
      {children}
    </LanguageContext.Provider>
  )
}
export const useLanguage = () => useContext(LanguageContext)
interface AuthContextValue {
  session: SessionView | null
  loading: boolean
  error: unknown
  refresh: () => Promise<void>
  mutate: <T>(url: string, method: string, body?: unknown) => Promise<T>
}
const AuthContext = createContext<AuthContextValue>(null!)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionView | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null)
  async function refresh() {
    try {
      const value = await apiFetch<SessionView>('/api/session')
      setSession(value)
      setError(null)
    } catch (error) {
      setError(error)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [])
  async function mutate<T>(url: string, method: string, body?: unknown): Promise<T> {
    if (!session?.csrfToken) throw new APIError(401, 'unauthorized')
    return apiFetch<T>(url, {
      method,
      headers: { 'X-CSRF-Token': session.csrfToken },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  }
  return (
    <AuthContext.Provider value={{ session, loading, error, refresh, mutate }}>
      {children}
    </AuthContext.Provider>
  )
}
export const useAuth = () => useContext(AuthContext)
export function errorText(error: unknown, locale: Locale): string {
  return t(locale, error instanceof APIError && hasMessage(error.code) ? error.code : 'requestFailed')
}
export interface GuildData {
  guild: GuildSummary
  settings: GuildSettings
  revision: number
  stats: { total: number; today: number; successful: number }
  bot: { online: boolean; latency: number | null; servers: number }
  channels: Array<{ id: string; name: string }>
  inviteUrl: string | null
  prefixAvailable: boolean
}
interface GuildContextValue {
  data: GuildData | null
  loading: boolean
  error: unknown
  reload: () => void
  setData: (value: GuildData) => void
}
export const GuildContext = createContext<GuildContextValue | null>(null)
export const useGuildOptional = () => useContext(GuildContext)
export function useGuild() {
  const context = useGuildOptional()
  if (!context) throw Error('Guild context missing')
  return context
}
