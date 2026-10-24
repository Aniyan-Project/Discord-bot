import { useState } from 'react'
import { useTicketUnsaved } from './unsaved.js'
import { Plus, Trash2, ArrowUp, Save, Download, ArrowLeft, Send } from 'lucide-react'
import {
  panelSchema,
  questionSchema,
  type TicketPanel,
  type PanelView,
  type TicketQuestion,
} from '../../shared/tickets.js'
import { fieldTypes } from '../../shared/ticket-forms.js'
import { useTickets } from './context.js'
import { Btn, Field, Input, Select, Roles, Toggle, Modal, download } from './primitives.js'
import { TicketPreview } from './preview.js'
import { TicketFormField } from './form-field.js'
import { QuestionEditor } from './form-editor.js'
export function TicketEditor({
  initial,
  onExit,
  onPublish,
}: {
  initial: PanelView
  onExit: () => void
  onPublish: (view: PanelView) => void
}) {
  const { tr, data, run, mutate, reload } = useTickets(),
    [view, setView] = useState(initial),
    [panel, setPanel] = useState(initial.panel),
    [dirty, setDirty] = useState(false),
    [tab, setTab] = useState('content'),
    [topicId, setTopicId] = useState(panel.topics[0]!.id),
    [topicTab, setTopicTab] = useState('general'),
    [form, setForm] = useState<import('../../shared/tickets.js').TicketTopic | null>(null),
    [validation, setValidation] = useState(''),
    [newType, setNewType] = useState<TicketQuestion['style']>('long'),
    [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({})
  useTicketUnsaved(dirty, tr('Sair sem salvar?'))
  const topic = panel.topics.find((t) => t.id === topicId) ?? panel.topics[0]!
  function update<K extends keyof TicketPanel>(key: K, value: TicketPanel[K]) {
    setPanel((p) => ({ ...p, [key]: value }))
    setDirty(true)
  }
  function topicUpdate(key: string, value: unknown) {
    update(
      'topics',
      panel.topics.map((t) => (t.id === topic.id ? { ...t, [key]: value } : t)),
    )
  }
  function exit() {
    if (!dirty || window.confirm(tr('Sair sem salvar?'))) onExit()
  }
  async function save() {
    const parsed = panelSchema.safeParse(panel)
    if (!parsed.success) {
      setValidation(tr('Revise os campos obrigatórios, limites e a URL HTTPS da imagem.'))
      return
    }
    setValidation('')
    const result = await run(() =>
      mutate<PanelView>('/panels', 'PUT', { panel: parsed.data, revision: view.revision }),
    )
    if (result) {
      setView(result)
      setDirty(false)
      reload()
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <button className="back-link" onClick={exit}>
            <ArrowLeft size={15} />
            {tr('Painéis de abertura')}
          </button>
          <h1>{panel.name}</h1>
        </div>
        <span className="badge">{tr(dirty ? 'Alterações não salvas' : 'Sem alterações pendentes')}</span>
      </div>
      {validation && (
        <p role="alert" className="error">
          {validation}
        </p>
      )}
      <div className="editor-layout">
        <section className="editor-settings">
          <div className="tabs">
            {[
              ['content', 'Mensagem'],
              ['topics', 'Assuntos e formulário'],
              ['delivery', 'Publicação'],
            ].map(([k, l]) => (
              <button type="button" className={tab === k ? 'active' : ''} key={k} onClick={() => setTab(k!)}>
                {tr(l!)}
              </button>
            ))}
          </div>
          {tab === 'content' && (
            <div className="form-content">
              <Input
                label="Nome interno do painel"
                value={panel.name}
                maxLength={80}
                onChange={(e) => update('name', e.target.value)}
              />
              <div className="segmented">
                {(['classic', 'v2'] as const).map((v) => (
                  <button
                    type="button"
                    className={panel.format === v ? 'active' : ''}
                    key={v}
                    onClick={() => update('format', v)}
                  >
                    {v === 'classic' ? tr('Embed clássico') : 'Components V2'}
                  </button>
                ))}
              </div>
              <Input
                label="Título"
                value={panel.title}
                maxLength={256}
                onChange={(e) => update('title', e.target.value)}
              />
              <Field label={tr('Descrição')}>
                <textarea
                  aria-label={tr('Descrição')}
                  rows={4}
                  maxLength={2000}
                  value={panel.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </Field>
              <div className="fields-two">
                <Input
                  label="Cor de destaque"
                  type="color"
                  value={panel.color}
                  onChange={(e) => update('color', e.target.value)}
                />
                <Select
                  label="Atendimento"
                  value={panel.style}
                  empty={false}
                  options={[
                    { id: 'select', name: tr('Menu de seleção') },
                    { id: 'buttons', name: tr('Botões') },
                  ]}
                  onChange={(v) => update('style', v as 'select' | 'buttons')}
                />
              </div>
              <Input
                label="Rodapé"
                value={panel.footer}
                maxLength={200}
                onChange={(e) => update('footer', e.target.value)}
              />
              <Input
                label="Imagem (URL HTTPS)"
                value={panel.image}
                type="url"
                onChange={(e) => update('image', e.target.value)}
              />
            </div>
          )}
          {tab === 'topics' && (
            <div className="form-content">
              <div className="section-heading">
                <h2>{tr('Assuntos de atendimento')}</h2>
                <Btn
                  icon={Plus}
                  aria-label={tr('Adicionar assunto')}
                  disabled={panel.topics.length >= 5}
                  onClick={() => {
                    const id = crypto.randomUUID()
                    update('topics', [
                      ...panel.topics,
                      {
                        id,
                        name: tr('Assunto'),
                        emoji: '💬',
                        description: '',
                        categoryId: '',
                        supportRoleIds: [],
                        welcome: '{{user}}',
                        questions: [],
                        priority: 'normal',
                        style: 'channel',
                        threadParentId: '',
                        maxPerUser: 1,
                        pingSupport: false,
                        staffThread: false,
                      },
                    ])
                    setTopicId(id)
                  }}
                />
              </div>
              <div className="topic-picker">
                {panel.topics.map((t, i) => (
                  <div key={t.id} className={topic.id === t.id ? 'selected' : ''}>
                    <button type="button" onClick={() => setTopicId(t.id)}>
                      {t.emoji} {t.name}
                    </button>
                    <button
                      type="button"
                      aria-label={tr('Assunto') + ' ↑'}
                      disabled={!i}
                      onClick={() => {
                        const ts = [...panel.topics]
                        ;[ts[i - 1], ts[i]] = [ts[i]!, ts[i - 1]!]
                        update('topics', ts)
                      }}
                    >
                      <ArrowUp size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="tabs sub-tabs">
                {[
                  ['general', 'Geral'],
                  ['questions', 'Formulário'],
                  ['advanced', 'Avançado'],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    className={topicTab === k ? 'active' : ''}
                    onClick={() => setTopicTab(k!)}
                  >
                    {tr(l!)}
                  </button>
                ))}
              </div>
              {topicTab === 'general' && (
                <>
                  <div className="fields-two emoji-name">
                    <Input
                      label="Emoji"
                      value={topic.emoji}
                      maxLength={16}
                      onChange={(e) => topicUpdate('emoji', e.target.value)}
                    />
                    <Input
                      label="Nome do assunto"
                      value={topic.name}
                      maxLength={80}
                      onChange={(e) => topicUpdate('name', e.target.value)}
                    />
                  </div>
                  <Input
                    label="Descrição"
                    value={topic.description}
                    maxLength={100}
                    onChange={(e) => topicUpdate('description', e.target.value)}
                  />
                  <Select
                    label="Categoria de destino"
                    value={topic.categoryId}
                    options={data.resources.categories}
                    onChange={(v) => topicUpdate('categoryId', v)}
                  />
                  <Roles
                    label="Cargos da equipe"
                    value={topic.supportRoleIds}
                    onChange={(v) => topicUpdate('supportRoleIds', v)}
                  />
                  <Field label={tr('Mensagem de boas-vindas')}>
                    <textarea
                      aria-label={tr('Mensagem de boas-vindas')}
                      rows={3}
                      maxLength={1500}
                      value={topic.welcome}
                      onChange={(e) => topicUpdate('welcome', e.target.value)}
                    />
                  </Field>
                  <div className="variable-row">
                    {['{{user}}', '{{server}}', '{{ticketId}}', '{{topic}}', '{{number}}'].map((v) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => topicUpdate('welcome', topic.welcome + ' ' + v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {topicTab === 'questions' && (
                <>
                  <p className="small">
                    {tr(
                      'Até cinco campos por formulário. Salve e republique o painel para atualizar o Discord.',
                    )}
                  </p>
                  {topic.questions.map((q, i) => (
                    <QuestionEditor
                      key={q.id}
                      question={q}
                      index={i}
                      count={topic.questions.length}
                      onChange={(next) =>
                        topicUpdate(
                          'questions',
                          topic.questions.map((x) => (x.id === q.id ? next : x)),
                        )
                      }
                      onRemove={() =>
                        topicUpdate(
                          'questions',
                          topic.questions.filter((x) => x.id !== q.id),
                        )
                      }
                      onMove={(offset) => {
                        const next = [...topic.questions]
                        ;[next[i], next[i + offset]] = [next[i + offset]!, next[i]!]
                        topicUpdate('questions', next)
                      }}
                    />
                  ))}
                  <div className="form-add-field">
                    <Select
                      label="Novo campo"
                      value={newType}
                      empty={false}
                      options={Object.entries(fieldTypes).map(([id, name]) => ({ id, name: tr(name) }))}
                      onChange={(v) => setNewType(v as TicketQuestion['style'])}
                    />
                    <Btn
                      icon={Plus}
                      disabled={topic.questions.length >= 5}
                      onClick={() =>
                        topicUpdate('questions', [
                          ...topic.questions,
                          questionSchema.parse({
                            id: crypto.randomUUID(),
                            label: tr('Campo'),
                            style: newType,
                            options: ['select', 'multi', 'radio', 'checkboxes'].includes(newType)
                              ? [tr('Opção 1'), tr('Opção 2')]
                              : [],
                          }),
                        ])
                      }
                    >
                      {tr('Adicionar campo')}
                    </Btn>
                  </div>
                </>
              )}
              {topicTab === 'advanced' && (
                <>
                  <Select
                    label="Prioridade"
                    empty={false}
                    value={topic.priority}
                    onChange={(v) => topicUpdate('priority', v)}
                    options={[
                      { id: 'normal', name: tr('Normal') },
                      { id: 'high', name: tr('Alta') },
                      { id: 'low', name: tr('Baixa') },
                    ]}
                  />
                  <Select
                    label="Atendimento"
                    empty={false}
                    value={topic.style}
                    onChange={(v) => topicUpdate('style', v)}
                    options={[
                      { id: 'channel', name: tr('Canal privado') },
                      { id: 'thread', name: tr('Thread privada') },
                    ]}
                  />
                  {topic.style === 'thread' && (
                    <Select
                      label="Canal pai da thread"
                      value={topic.threadParentId}
                      options={data.resources.channels}
                      onChange={(v) => topicUpdate('threadParentId', v)}
                    />
                  )}
                  <Input
                    label="Limite por pessoa neste assunto"
                    type="number"
                    min={1}
                    max={10}
                    value={topic.maxPerUser}
                    onChange={(e) => topicUpdate('maxPerUser', Number(e.target.value))}
                  />
                  <Toggle
                    label="Mencionar equipe ao abrir"
                    value={topic.pingSupport}
                    onChange={(v) => topicUpdate('pingSupport', v)}
                  />
                  <Toggle
                    label="Conversa privada da equipe"
                    value={topic.staffThread}
                    onChange={(v) => topicUpdate('staffThread', v)}
                  />
                  <Btn
                    danger
                    icon={Trash2}
                    disabled={panel.topics.length === 1}
                    onClick={() => {
                      update(
                        'topics',
                        panel.topics.filter((t) => t.id !== topic.id),
                      )
                      setTopicId(panel.topics.find((t) => t.id !== topic.id)!.id)
                    }}
                  >
                    {tr('Excluir')} {tr('Assunto')}
                  </Btn>
                </>
              )}
            </div>
          )}
          {tab === 'delivery' && (
            <div className="form-content">
              <Select
                label="Canal do painel"
                value={panel.channelId}
                onChange={(v) => update('channelId', v)}
                options={data.resources.channels}
              />
              <p>
                {tr(
                  'O bot precisa de Gerenciar canais e Gerenciar threads. Transcrições completas exigem Message Content Intent.',
                )}
              </p>
              <Btn primary icon={Send} disabled={dirty || !view.revision} onClick={() => onPublish(view)}>
                {tr('Revisar publicação')}
              </Btn>
              <small>{tr('Salvar antes de publicar.')}</small>
            </div>
          )}
        </section>
        <aside className="preview-column">
          <div className="section-heading">
            <h2>{tr('O que a comunidade verá')}</h2>
            <span className="badge">{panel.format === 'v2' ? 'Components V2' : tr('Embed clássico')}</span>
          </div>
          <TicketPreview panel={panel} onTest={setForm} />
          <button className="preview-test" type="button" onClick={() => setForm(topic)}>
            {tr('Formulário de atendimento')}
          </button>
        </aside>
      </div>
      <div className="save-bar">
        <span>{tr(dirty ? 'Alterações não salvas' : 'Sem alterações pendentes')}</span>
        <div>
          <Btn
            icon={Download}
            onClick={() =>
              download({ version: 1, kind: 'branilist-ticket-panel', panel }, 'branilist-ticket-panel.json')
            }
          >
            {tr('Exportar JSON')}
          </Btn>
          <Btn primary icon={Save} onClick={() => void save()}>
            {tr('Salvar rascunho')}
          </Btn>
        </div>
      </div>
      {form && (
        <Modal title={tr('Formulário de atendimento')} onClose={() => setForm(null)}>
          <p>
            {tr('Salvar antes de publicar.')} {tr('Selecione o assunto e preencha o formulário.')}
          </p>
          {form.questions.map((q) => (
            <TicketFormField
              key={q.id}
              question={q}
              value={previewAnswers[q.id] ?? ''}
              onChange={(value) => setPreviewAnswers((a) => ({ ...a, [q.id]: value }))}
            />
          ))}
        </Modal>
      )}
    </>
  )
}
