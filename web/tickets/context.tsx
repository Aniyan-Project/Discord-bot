import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAuth, useGuild, useLanguage, useQuery, APIError, apiFetch } from '../api.js'
import { tt } from '../../shared/ticket-i18n.js'
import type { TicketSettings, PanelView, TicketPanel, TicketResources } from '../../shared/tickets.js'
export interface TicketContextData {
  settings: TicketSettings
  revision: number
  panels: PanelView[]
  templates: TicketPanel[]
  resources: TicketResources
  demo: boolean
  contentEnabled: boolean
}
interface Context {
  data: TicketContextData
  base: string
  guildId: string
  locale: string
  tr: (s: string) => string
  busy: boolean
  error: string
  notice: string
  clear: () => void
  reload: () => void
  run: <T>(action: () => Promise<T>, notice?: string) => Promise<T | undefined>
  mutate: <T>(path: string, method: string, body?: unknown) => Promise<T>
  get: <T>(path: string) => Promise<T>
}
const TicketsContext = createContext<Context>(null!)
export const useTickets = () => useContext(TicketsContext)
export function TicketsProvider({ children }: { children: ReactNode }) {
  const { data: guild } = useGuild(),
    { locale } = useLanguage(),
    { mutate } = useAuth(),
    id = guild!.guild.id,
    base = `/api/guilds/${id}/tickets`,
    query = useQuery<TicketContextData>(base + '/context')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const tr = (s: string) => tt(locale, s)
  async function run<T>(action: () => Promise<T>, message = 'Salvo.') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const value = await action()
      setNotice(tr(message))
      return value
    } catch (e) {
      const code = e instanceof APIError ? e.code : ''
      setError(
        tr(
          code === 'revisionConflict'
            ? 'Conflito de edição. Recarregue antes de salvar.'
            : code === 'ticketUncertain'
              ? 'Não foi possível confirmar a operação no Discord. Verifique o canal antes de tentar novamente.'
              : code === 'ticketNotConfigured'
                ? 'Configure categoria, equipe e canal antes de publicar.'
                : code === 'ticketTranscriptExpired'
                  ? 'Transcrição indisponível ou expirada.'
                  : code === 'ticketPrivateLog'
                    ? 'O canal de registros deve ser privado.'
                    : code === 'ticketFormatChange'
                      ? 'Para mudar entre clássico e V2, duplique o painel e publique uma nova mensagem.'
                      : 'Falha ao executar a ação. Revise as permissões e tente novamente.',
        ),
      )
      return undefined
    } finally {
      setBusy(false)
    }
  }
  if (!query.data)
    return (
      <div className="tickets-page">
        <p role={query.error ? 'alert' : 'status'}>
          {tr(
            query.error ? 'Falha ao executar a ação. Revise as permissões e tente novamente.' : 'Carregando…',
          )}
        </p>
        {!!query.error && (
          <button className="button secondary" onClick={query.reload}>
            {tr('Atualizar')}
          </button>
        )}
      </div>
    )
  return (
    <TicketsContext.Provider
      value={{
        data: query.data,
        base,
        guildId: id,
        locale,
        tr,
        busy,
        error,
        notice,
        clear: () => {
          setError('')
          setNotice('')
        },
        reload: query.reload,
        run,
        mutate: (path, method, body) => mutate(base + path, method, body),
        get: (path) => apiFetch(base + path),
      }}
    >
      {children}
    </TicketsContext.Provider>
  )
}
