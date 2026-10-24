import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Plus,
  Upload,
  Download,
  Copy,
  Files,
  Send,
  Trash2,
  Settings2,
  Search,
  Headphones,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react'
import {
  newTicketPanel,
  panelSchema,
  type PanelView,
  type TicketPanel,
  type TicketTopic,
} from '../../shared/tickets.js'
import { TicketsProvider, useTickets } from './context.js'
import { Btn, Field, Input, Modal, download, Section } from './primitives.js'
import { TicketEditor } from './editor.js'
import { TicketPreview } from './preview.js'
import { TicketHistory } from './history.js'
import { TicketSettingsPage } from './settings.js'
import './tickets.css'
export function TicketsPage() {
  const { guildId } = useParams()
  return (
    <TicketsProvider key={guildId}>
      <TicketContent />
    </TicketsProvider>
  )
}
type Dialog =
  { type: 'publish' | 'delete' | 'open'; view: PanelView; topic?: TicketTopic } | { type: 'import' }
const titles: Record<string, string> = {
  overview: 'Visão geral dos tickets',
  panels: 'Painéis de abertura',
  templates: 'Modelos',
  history: 'Histórico de tickets',
  settings: 'Configurações de tickets',
  permissions: 'Permissões e auditoria',
}
function TicketContent() {
  const { section = 'overview', guildId } = useParams(),
    { data, tr, busy, error, notice, clear, run, mutate, reload } = useTickets(),
    [editing, setEditing] = useState<PanelView | null>(null),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [query, setQuery] = useState('')
  useEffect(() => {
    setEditing(null)
    setDialog(null)
    clear()
  }, [section])
  const create = (panel: TicketPanel = newTicketPanel()) => {
    setEditing({
      panel: { ...panel, id: crypto.randomUUID() },
      revision: 0,
      messageId: null,
      publishedAt: null,
      publishedChannelId: null,
    })
    clear()
  }
  async function remove(view: PanelView) {
    const result = await run(() => mutate('/panels/' + view.panel.id, 'DELETE'))
    if (result) {
      reload()
      setDialog(null)
    }
  }
  return (
    <div className="tickets-page">
      {data.demo && (
        <div className="preview-notice">{tr('Modo de demonstração. Nenhuma ação é enviada ao Discord.')}</div>
      )}
      {error && (
        <p role="alert" className="ticket-feedback error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="ticket-feedback">
          {notice}
        </p>
      )}
      {editing ? (
        <TicketEditor
          key={editing.panel.id}
          initial={editing}
          onExit={() => setEditing(null)}
          onPublish={(view) => {
            clear()
            setDialog({ type: 'publish', view })
          }}
        />
      ) : (
        <>
          <div className="page-title">
            <div>
              <h1>{tr(titles[section] ?? 'Tickets')}</h1>
              <p>
                {tr(
                  (
                    {
                      panels: 'Organize os pontos de entrada para sua equipe.',
                      templates: 'Reutilize painéis e formulários.',
                      settings: 'Personalize as regras de atendimento do servidor.',
                      permissions: 'Controle o acesso e acompanhe as ações da equipe.',
                    } as Record<string, string>
                  )[section] ?? 'Acompanhe sua fila de atendimento.',
                )}
              </p>
            </div>
            <div className="actions">
              {['panels', 'templates'].includes(section) && (
                <Btn
                  icon={Upload}
                  onClick={() => {
                    clear()
                    setDialog({ type: 'import' })
                  }}
                >
                  {tr('Importar JSON')}
                </Btn>
              )}
              {section === 'panels' && (
                <Btn primary icon={Plus} onClick={() => create()}>
                  {tr('Criar painel')}
                </Btn>
              )}
            </div>
          </div>
          {section === 'panels' && (
            <>
              <div className="list-toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label={tr('Buscar')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tr('Buscar')}
                  />
                </div>
                <span>
                  {data.panels.length} {tr('Painéis de abertura')}
                </span>
              </div>
              <div className="panels-layout">
                <div className="panel-list">
                  {data.panels
                    .filter((p) => p.panel.name.toLowerCase().includes(query.toLowerCase()))
                    .map((view) => (
                      <article className="panel-card" key={view.panel.id}>
                        <div className="panel-card-heading">
                          <div>
                            <div className="line">
                              <h2>{view.panel.name}</h2>
                              <span className="badge">
                                {view.messageId ? tr('Publicado') : tr('Rascunho')}
                              </span>
                            </div>
                            <p>
                              {data.resources.channels.find((c) => c.id === view.panel.channelId)?.name ||
                                tr('Canal não disponível')}{' '}
                              • {view.panel.topics.length} {tr('Assuntos de atendimento')}
                            </p>
                          </div>
                          <Btn
                            icon={Settings2}
                            onClick={() => {
                              clear()
                              setEditing(view)
                            }}
                          >
                            {tr('Editar painel')}
                          </Btn>
                        </div>
                        <TicketPreview
                          panel={view.publishedPanel ?? view.panel}
                          onTest={(topic) => {
                            clear()
                            setDialog({
                              type: 'open',
                              view: { ...view, panel: view.publishedPanel ?? view.panel },
                              topic,
                            })
                          }}
                        />
                        <div className="panel-card-footer">
                          <Btn quiet icon={Copy} onClick={() => create(view.panel)}>
                            {tr('Duplicar')}
                          </Btn>
                          <Btn
                            quiet
                            icon={Files}
                            onClick={() =>
                              void run(async () => {
                                const value = await mutate('/templates', 'POST', view.panel)
                                reload()
                                return value
                              })
                            }
                          >
                            {tr('Salvar modelo')}
                          </Btn>
                          <Btn
                            quiet
                            icon={Send}
                            onClick={() => {
                              clear()
                              setDialog({ type: 'publish', view })
                            }}
                          >
                            {tr(view.messageId ? 'Atualizar mensagem' : 'Publicar')}
                          </Btn>
                          <Btn
                            quiet
                            danger
                            icon={Trash2}
                            aria-label={tr('Excluir') + ' ' + view.panel.name}
                            onClick={() => {
                              clear()
                              setDialog({ type: 'delete', view })
                            }}
                          />
                        </div>
                      </article>
                    ))}
                  {!data.panels.length && (
                    <div className="empty">
                      <Headphones size={28} />
                      <h2>{tr('Nenhum painel ainda')}</h2>
                      <p>{tr('Crie um painel para começar a receber atendimentos.')}</p>
                      <Btn primary icon={Plus} onClick={() => create()}>
                        {tr('Criar painel')}
                      </Btn>
                    </div>
                  )}
                </div>
                <aside className="side-guide">
                  <div className="guide-icon">
                    <Headphones size={23} />
                  </div>
                  <h2>{tr('Suporte da comunidade')}</h2>
                  <p>{tr('Crie um painel para começar a receber atendimentos.')}</p>
                  <ol className="guide-steps">
                    {['Mensagem', 'Assuntos e formulário', 'Publicação'].map((s, i) => (
                      <li key={s}>
                        <span>{i + 1}</span>
                        <strong>{tr(s)}</strong>
                      </li>
                    ))}
                  </ol>
                  <Link className="text-link" to={`/dashboard/${guildId}/tickets/settings`}>
                    {tr('Configurações de tickets')}
                    <ArrowUpRight size={15} />
                  </Link>
                  <div className="side-note">
                    <ShieldCheck size={18} />
                    <p>{tr('Notas internas são visíveis apenas à equipe.')}</p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {section === 'templates' && (
            <>
              <div className="section-heading">
                <h2>{tr('Seus modelos')}</h2>
                <span>{data.templates.length}</span>
              </div>
              <div className="template-list">
                {data.templates.map((p) => (
                  <div key={p.id}>
                    <Files size={20} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.topics.length} {tr('Assuntos de atendimento')}
                      </small>
                    </span>
                    <Btn
                      icon={Download}
                      aria-label={tr('Exportar JSON')}
                      onClick={() =>
                        download(
                          { version: 1, kind: 'branilist-ticket-panel', panel: p },
                          'branilist-ticket-panel.json',
                        )
                      }
                    />
                    <Btn onClick={() => create(p)}>{tr('Usar modelo')}</Btn>
                    <Btn
                      danger
                      quiet
                      icon={Trash2}
                      aria-label={tr('Excluir') + ' ' + p.name}
                      onClick={() => {
                        if (confirm(tr('Excluir este painel? Os tickets existentes serão preservados.')))
                          void run(async () => {
                            const v = await mutate('/templates/' + p.id, 'DELETE')
                            reload()
                            return v
                          })
                      }}
                    />
                  </div>
                ))}
              </div>
              <h2 className="spaced">{tr('Pontos de partida')}</h2>
              <div className="preset-list">
                {['Suporte da comunidade', 'Relatos de bugs', 'Parcerias'].map((name) => (
                  <div key={name}>
                    <h3>{tr(name)}</h3>
                    <Btn
                      icon={Plus}
                      onClick={() => {
                        const p = newTicketPanel()
                        p.name = tr(name)
                        p.title = tr(name)
                        p.topics[0]!.name = tr(name)
                        create(p)
                      }}
                    >
                      {tr('Criar painel')}
                    </Btn>
                  </div>
                ))}
              </div>
            </>
          )}
          {section === 'overview' && <TicketHistory overview />}
          {section === 'history' && <TicketHistory />}
          {section === 'settings' && <TicketSettingsPage />}
          {section === 'permissions' && (
            <>
              <Section title="Permissões e auditoria">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {['Atendimento', 'Membro', 'Equipe', 'Gestão'].map((s) => (
                          <th key={s}>{tr(s)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Ver e conversar', 'Próprio ticket', 'Assuntos permitidos', 'Todos'],
                        ['Assumir ticket', '—', 'Assuntos permitidos', 'Todos'],
                        ['Transcrição', 'Próprio ticket', 'Assuntos permitidos', 'Todos'],
                        ['Configurar painéis', '—', '—', 'Todos'],
                      ].map((row) => (
                        <tr key={row[0]}>
                          {row.map((s, i) => (
                            <td key={i}>{tr(s)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small">{tr('Notas internas são visíveis apenas à equipe.')}</p>
              </Section>
              <Section title="Auditoria">
                <TicketHistory auditOnly />
              </Section>
            </>
          )}
        </>
      )}
      {dialog?.type === 'publish' && (
        <PublishModal
          view={dialog.view}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null)
            reload()
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <Modal title={tr('Excluir')} onClose={() => setDialog(null)}>
          <p>{tr('Excluir este painel? Os tickets existentes serão preservados.')}</p>
          <div className="dialog-actions">
            <Btn onClick={() => setDialog(null)}>{tr('Cancelar')}</Btn>
            <Btn danger icon={Trash2} onClick={() => void remove(dialog.view)}>
              {tr('Excluir')}
            </Btn>
          </div>
        </Modal>
      )}
      {dialog?.type === 'import' && (
        <ImportModal
          onClose={() => setDialog(null)}
          onImport={(panel) => {
            setDialog(null)
            create(panel)
          }}
        />
      )}
      {dialog?.type === 'open' && (
        <OpeningModal view={dialog.view} topic={dialog.topic!} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
function PublishModal({
  view,
  onClose,
  onDone,
}: {
  view: PanelView
  onClose: () => void
  onDone: () => void
}) {
  const { tr, data, run, mutate } = useTickets(),
    request = useRef(crypto.randomUUID())
  const [messageId, setMessageId] = useState(''),
    [confirmed, setConfirmed] = useState(false)
  return (
    <Modal title={tr('Revisar publicação')} onClose={onClose}>
      {data.demo && <p>{tr('Modo de demonstração. Nenhuma ação é enviada ao Discord.')}</p>}
      <div className="review-line">
        <span>{tr('Atendimento')}</span>
        <strong>{view.panel.name}</strong>
      </div>
      <div className="review-line">
        <span>{tr('Canal de destino')}</span>
        <strong>#{data.resources.channels.find((c) => c.id === view.panel.channelId)?.name ?? '—'}</strong>
      </div>
      <div className="review-line">
        <span>{tr('Mensagem')}</span>
        <strong>{view.panel.format === 'v2' ? 'Components V2' : tr('Embed clássico')}</strong>
      </div>
      <p>{tr('Configure categoria, equipe e canal antes de publicar.')}</p>
      <div className="dialog-actions">
        <Btn onClick={onClose}>{tr('Cancelar')}</Btn>
        <Btn
          primary
          icon={Send}
          disabled={!view.revision || !view.panel.channelId}
          onClick={() =>
            void run(async () => {
              const result = await mutate('/panels/' + view.panel.id + '/publish', 'POST', {
                revision: view.revision,
                requestId: request.current,
              })
              onDone()
              return result
            }, 'Painel publicado.')
          }
        >
          {tr('Confirmar publicação')}
        </Btn>
      </div>
      <details className="publication-recovery">
        <summary>{tr('Recuperar publicação')}</summary>
        <p>{tr('Verifique o canal no Discord. Aguarde 30 segundos após uma falha antes de resolver.')}</p>
        <Input
          label="ID da mensagem encontrada (opcional)"
          value={messageId}
          onChange={(e) => setMessageId(e.target.value)}
          pattern="\d{17,20}"
        />
        <label className="checkbox">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          {tr(
            'Conferi o canal: vincular a mensagem informada ou liberar uma nova tentativa se ela não existe.',
          )}
        </label>
        <Btn
          disabled={!confirmed}
          onClick={() =>
            void run(async () => {
              const result = await mutate('/panels/' + view.panel.id + '/reconcile', 'POST', {
                messageId: messageId || null,
                confirmed: true,
              })
              onDone()
              return result
            }, 'Ação concluída.')
          }
        >
          {tr('Resolver publicação')}
        </Btn>
      </details>
    </Modal>
  )
}
function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (p: TicketPanel) => void }) {
  const { tr } = useTickets(),
    [json, setJson] = useState(''),
    [error, setError] = useState('')
  return (
    <Modal title={tr('Importar JSON')} onClose={onClose}>
      <Field label={tr('Importar JSON')}>
        <input
          type="file"
          aria-label={tr('Importar JSON')}
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) {
              if (file.size > 131072) {
                setError(tr('JSON inválido.'))
                return
              }
              setJson(await file.text())
            }
          }}
        />
      </Field>
      <Field label="JSON">
        <textarea
          aria-label="JSON"
          rows={9}
          maxLength={131072}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Btn onClick={onClose}>{tr('Cancelar')}</Btn>
        <Btn
          primary
          icon={Upload}
          onClick={() => {
            try {
              const obj = JSON.parse(json)
              if (obj.version !== 1 || obj.kind !== 'branilist-ticket-panel') throw Error()
              onImport(panelSchema.parse(obj.panel))
            } catch {
              setError(tr('JSON inválido.'))
            }
          }}
        >
          {tr('Importar JSON')}
        </Btn>
      </div>
    </Modal>
  )
}
function OpeningModal({
  view,
  topic,
  onClose,
}: {
  view: PanelView
  topic: TicketTopic
  onClose: () => void
}) {
  const { tr, run, mutate, data } = useTickets(),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [created, setCreated] = useState<{ channelId: string } | null>(null)
  return (
    <Modal title={topic.name} onClose={onClose}>
      {data.demo && <p>{tr('Modo de demonstração. Nenhuma ação é enviada ao Discord.')}</p>}
      {created ? (
        <>
          <p>{tr('Seu atendimento foi criado.')}</p>
          <Btn onClick={onClose}>{tr('Voltar')}</Btn>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              const result = await mutate<{ channelId: string }>('/open', 'POST', {
                panelId: view.panel.id,
                topicId: topic.id,
                answers,
                revision: view.revision,
              })
              setCreated(result)
              return result
            }, 'Seu atendimento foi criado.')
          }}
        >
          <p>{topic.description}</p>
          {topic.questions.map((q) => (
            <Field label={q.label} key={q.id}>
              <textarea
                aria-label={q.label}
                rows={q.style === 'short' ? 1 : 3}
                maxLength={q.maxLength}
                required={q.required}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            </Field>
          ))}
          {!view.messageId && <p className="small">{tr('Salvar antes de publicar.')}</p>}
          <div className="dialog-actions">
            <Btn onClick={onClose}>{tr('Cancelar')}</Btn>
            <Btn primary type="submit" disabled={!view.messageId}>
              {tr('Criar atendimento privado')}
            </Btn>
          </div>
        </form>
      )}
    </Modal>
  )
}
