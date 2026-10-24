import { useState } from 'react'
import { useQuery } from '../api.js'
import {
  Search,
  ChevronRight,
  UserCheck,
  UserRound,
  Archive,
  Download,
  RotateCcw,
  Plus,
  ExternalLink,
} from 'lucide-react'
import { type TicketRecord, type Transcript, type TicketStatus } from '../../shared/tickets.js'
import { ticketStatusText } from '../../shared/ticket-i18n.js'
import { useTickets } from './context.js'
import { Btn, Input, Field, Modal, download } from './primitives.js'
type Summary = Omit<TicketRecord, 'notes' | 'answers' | 'settings'> & { noteCount: number }
export interface TicketListData {
  tickets: Summary[]
  total: number
  active: Array<{ status: TicketStatus }>
  offset: number
  audit: Array<{ actor: string; action: string; target: string; at: number }>
}
function Badge({ status }: { status: TicketStatus }) {
  const { tr } = useTickets()
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {tr(ticketStatusText[status])}
    </span>
  )
}
export function TicketHistory({
  overview = false,
  auditOnly = false,
}: {
  overview?: boolean
  auditOnly?: boolean
}) {
  const { base, tr, locale, run, get } = useTickets(),
    [offset, setOffset] = useState(0),
    query = useQuery<TicketListData>(base + `?offset=${offset}`),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<{ ticket: TicketRecord; transcript: Transcript | null } | null>(null)
  const tickets = (query.data?.tickets ?? []).filter(
    (t) =>
      (status === 'all' || t.status === status) &&
      `${t.number} ${t.authorName} ${t.topic.name}`.toLowerCase().includes(search.toLowerCase()),
  )
  async function detail(id: string) {
    const value = await run(() => get<{ ticket: TicketRecord; transcript: Transcript | null }>('/' + id), '')
    if (value) setSelected(value)
  }
  if (!query.data)
    return (
      <p role={query.error ? 'alert' : 'status'}>
        {tr(
          query.error ? 'Falha ao executar a ação. Revise as permissões e tente novamente.' : 'Carregando…',
        )}
      </p>
    )
  if (auditOnly)
    return (
      <div className="audit-list">
        {query.data.audit.length ? (
          query.data.audit.map((a, i) => (
            <div key={i}>
              <time>{new Date(a.at).toLocaleString(locale)}</time>
              <span>
                <strong>{a.action}</strong>
                <small>
                  {a.actor} • {a.target}
                </small>
              </span>
            </div>
          ))
        ) : (
          <p>{tr('Nenhum registro ainda')}</p>
        )}
      </div>
    )
  return (
    <>
      {overview && (
        <div className="summary-strip">
          {(['open', 'progress', 'closed'] as const).map((s) => (
            <button type="button" key={s} onClick={() => setStatus(s)}>
              <span>{tr(ticketStatusText[s])}</span>
              <strong>
                {s === 'closed'
                  ? query.data!.total - query.data!.active.length
                  : query.data!.active.filter((t) => t.status === s).length}
              </strong>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      )}
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label={tr('Buscar')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('Buscar')}
          />
        </div>
        <Field label={tr('Status')}>
          <select aria-label={tr('Status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{tr('Todos')}</option>
            {Object.entries(ticketStatusText).map(([k, l]) => (
              <option key={k} value={k}>
                {tr(l)}
              </option>
            ))}
          </select>
        </Field>
        <Btn onClick={query.reload}>{tr('Atualizar')}</Btn>
      </div>
      <div className="history-meta">
        <span>
          {query.data.total ? offset + 1 : 0}–{Math.min(offset + 100, query.data.total)} / {query.data.total}
        </span>
      </div>
      <div className="table-wrap ticket-table">
        <table>
          <thead>
            <tr>
              {['Atendimento', 'Assunto', 'Status', 'Responsável', 'Abertura'].map((h) => (
                <th key={h}>{tr(h)}</th>
              ))}
              <th>
                <span className="sr-only">{tr('Atendimento')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>
                  <button className="ticket-link" onClick={() => void detail(t.id)}>
                    #{t.number}
                    <span>{t.authorName}</span>
                  </button>
                </td>
                <td>
                  {t.topic.emoji} {t.topic.name}
                </td>
                <td>
                  <Badge status={t.status} />
                </td>
                <td>{t.staffId || '—'}</td>
                <td>{new Date(t.createdAt).toLocaleString(locale)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={tr('Atendimento') + ' ' + t.number}
                    onClick={() => void detail(t.id)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!tickets.length && (
        <div className="empty">
          <h2>{tr('Nenhum atendimento ainda')}</h2>
          <Btn
            onClick={() => {
              setSearch('')
              setStatus('all')
            }}
          >
            {tr('Limpar filtros')}
          </Btn>
        </div>
      )}
      <div className="pagination">
        <Btn disabled={!offset} onClick={() => setOffset((n) => Math.max(0, n - 100))}>
          {tr('Anterior')}
        </Btn>
        <Btn disabled={offset + 100 >= query.data.total} onClick={() => setOffset((n) => n + 100)}>
          {tr('Próxima')}
        </Btn>
      </div>
      {selected && (
        <TicketDetail initial={selected} onClose={() => setSelected(null)} onChange={query.reload} />
      )}
    </>
  )
}
function TicketDetail({
  initial,
  onClose,
  onChange,
}: {
  initial: { ticket: TicketRecord; transcript: Transcript | null }
  onClose: () => void
  onChange: () => void
}) {
  const { tr, locale, guildId, run, mutate, get } = useTickets(),
    [state, setState] = useState(initial),
    [action, setAction] = useState(''),
    [value, setValue] = useState(''),
    [note, setNote] = useState('')
  const t = state.ticket
  async function perform(kind: string, v = '') {
    const result = await run(
      () =>
        mutate<TicketRecord>('/' + t.id + '/actions', 'POST', {
          action: kind,
          value: v,
          revision: t.revision,
        }),
      'Ação concluída.',
    )
    if (result) {
      setState({ ...state, ticket: result })
      setAction('')
      setValue('')
      setNote('')
      onChange()
    }
  }
  return (
    <Modal wide title={`${tr('Atendimento')} #${t.number}`} onClose={onClose}>
      <div className="detail-meta">
        <Badge status={t.status} />
        <span>{t.topic.name}</span>
        <span>
          {tr('Prioridade')}: {tr({ normal: 'Normal', high: 'Alta', low: 'Baixa' }[t.topic.priority])}
        </span>
      </div>
      <div className="detail-layout">
        <div>
          <div className="conversation">
            <p>{tr('A conversa acontece no canal privado do Discord.')}</p>
            {t.channelId && (
              <a
                className="btn"
                href={`https://discord.com/channels/${guildId}/${t.channelId}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                {tr('Abrir no Discord')}
              </a>
            )}
            {Object.entries(t.answers).map(([id, answer]) => (
              <div className="answer" key={id}>
                <strong>{t.topic.questions.find((q) => q.id === id)?.label}</strong>
                <p>{answer}</p>
              </div>
            ))}
          </div>
          {state.transcript && (
            <p className="small">
              {state.transcript.messages.length} {tr('Transcrição')} •{' '}
              {new Date(state.transcript.capturedAt).toLocaleString(locale)}
            </p>
          )}
          <div className="internal-notes">
            <h3>{tr('Notas internas')}</h3>
            {t.notes.map((n, i) => (
              <div className="internal-note" key={i}>
                <small>
                  {n.actor} • {new Date(n.at).toLocaleString(locale)}
                </small>
                <p>{n.text}</p>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void perform('note', note)
              }}
            >
              <Field label={tr('Nota interna')}>
                <textarea
                  aria-label={tr('Nota interna')}
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                />
              </Field>
              <Btn type="submit" icon={Plus}>
                {tr('Adicionar nota')}
              </Btn>
            </form>
          </div>
        </div>
        <aside className="ticket-actions">
          <div className="review-line">
            <span>{tr('Autor')}</span>
            <strong>{t.authorName}</strong>
          </div>
          {['error', 'creating'].includes(t.status) && (
            <>
              <Btn onClick={() => void perform('recover')}>{tr('Recuperar atendimento')}</Btn>
              <Btn
                danger
                onClick={() => {
                  if (
                    window.confirm(
                      tr('Conferi o Discord e nenhum canal foi criado para este ticket. Cancelar a reserva?'),
                    )
                  )
                    void perform('recover', 'cancel')
                }}
              >
                {tr('Cancelar reserva sem canal')}
              </Btn>
            </>
          )}
          <div className="review-line">
            <span>{tr('Responsável')}</span>
            <strong>{t.staffId || '—'}</strong>
          </div>
          {['open', 'progress'].includes(t.status) && (
            <>
              <Btn primary icon={UserCheck} onClick={() => void perform('claim')}>
                {tr('Assumir ticket')}
              </Btn>
              <Btn
                icon={UserRound}
                onClick={() => {
                  setAction('transfer')
                  setValue('')
                }}
              >
                {tr('Transferir atendimento')}
              </Btn>
              <Btn
                icon={Archive}
                onClick={() => {
                  setAction('close')
                  setValue('')
                }}
              >
                {tr('Encerrar ticket')}
              </Btn>
            </>
          )}
          {t.status === 'closing' && (
            <Btn
              onClick={() => {
                setAction('close')
                setValue(t.reason)
              }}
            >
              {tr('Encerrar ticket')}
            </Btn>
          )}
          {t.status === 'closed' && t.settings.allowReopen && t.settings.closeAction !== 'delete' && (
            <Btn icon={RotateCcw} onClick={() => void perform('reopen')}>
              {tr('Reabrir ticket')}
            </Btn>
          )}
          <Btn
            icon={Download}
            onClick={() =>
              void run(async () => {
                const transcript = await get<Transcript>('/' + t.id + '/transcript')
                download(transcript, `ticket-${t.number}.json`)
                return transcript
              }, 'Ação concluída.')
            }
          >
            {tr('Exportar transcrição')}
          </Btn>
          {action && (
            <form
              className="transfer-form"
              onSubmit={(e) => {
                e.preventDefault()
                void perform(action, value)
              }}
            >
              {action === 'transfer' ? (
                <Input
                  label="Novo responsável (ID Discord)"
                  required
                  pattern="\d{17,20}"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              ) : (
                <Field label={tr('Motivo do encerramento')}>
                  <textarea
                    aria-label={tr('Motivo do encerramento')}
                    required={t.settings.requireCloseReason}
                    maxLength={1000}
                    rows={3}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </Field>
              )}
              <Btn primary type="submit">
                {tr(action === 'transfer' ? 'Confirmar transferência' : 'Encerrar ticket')}
              </Btn>
              <Btn onClick={() => setAction('')}>{tr('Cancelar')}</Btn>
            </form>
          )}
        </aside>
      </div>
    </Modal>
  )
}
