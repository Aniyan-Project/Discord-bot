import { useState } from 'react'
import { useTicketUnsaved } from './unsaved.js'
import { Save } from 'lucide-react'
import type { TicketSettings } from '../../shared/tickets.js'
import { useTickets } from './context.js'
import { Btn, Input, Field, Select, Roles, Toggle, Section } from './primitives.js'
export function TicketSettingsPage() {
  const { data, tr, run, mutate, reload } = useTickets(),
    [settings, setSettings] = useState(data.settings),
    [revision, setRevision] = useState(data.revision),
    [saved, setSaved] = useState(JSON.stringify(data.settings))
  useTicketUnsaved(JSON.stringify(settings) !== saved, tr('Sair sem salvar?'))
  function update<K extends keyof TicketSettings>(key: K, value: TicketSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }
  const toggle = (key: keyof TicketSettings, label: string) => (
    <Toggle
      key={key}
      label={label}
      value={Boolean(settings[key])}
      onChange={(v) => update(key, v as never)}
    />
  )
  async function save() {
    const value = await run(() =>
      mutate<{ settings: TicketSettings; revision: number }>('/settings', 'PUT', { settings, revision }),
    )
    if (value) {
      setRevision(value.revision)
      setSaved(JSON.stringify(settings))
      reload()
    }
  }
  return (
    <>
      <div className="settings-layout">
        <div>
          <Section title="Estrutura e limites">
            <div className="fields-two">
              <Select
                label="Categoria padrão"
                value={settings.categoryId}
                options={data.resources.categories}
                onChange={(v) => update('categoryId', v)}
              />
              <Select
                label="Canal pai da thread"
                value={settings.threadParentId}
                options={data.resources.channels}
                onChange={(v) => update('threadParentId', v)}
              />
              <Input
                label="Limite ativo no servidor"
                type="number"
                min={1}
                max={500}
                value={settings.maxActive}
                onChange={(e) => update('maxActive', Number(e.target.value))}
              />
              <Input
                label="Limite ativo por pessoa"
                type="number"
                min={1}
                max={10}
                value={settings.maxPerUser}
                onChange={(e) => update('maxPerUser', Number(e.target.value))}
              />
              <Input
                label="Intervalo entre aberturas (segundos)"
                type="number"
                min={0}
                max={86400}
                value={settings.cooldownSeconds}
                onChange={(e) => update('cooldownSeconds', Number(e.target.value))}
              />
              <Input
                label="Padrão do nome"
                value={settings.namePattern}
                onChange={(e) => update('namePattern', e.target.value)}
              />
            </div>
            {toggle('continuousNumbering', 'Numeração contínua')}
            {toggle('globalNumbering', 'Contador único por servidor')}
          </Section>
          <Section title="Distribuição e equipe">
            <Roles
              label="Cargos de suporte padrão"
              value={settings.supportRoleIds}
              onChange={(v) => update('supportRoleIds', v)}
            />
            <Roles
              label="Cargos de gestão"
              value={settings.managerRoleIds}
              onChange={(v) => update('managerRoleIds', v)}
            />
            {toggle('privateOnClaim', 'Restringir à equipe responsável ao assumir')}
            {toggle('pingOnClaim', 'Avisar o autor ao assumir')}
            {toggle('pingSupport', 'Mencionar equipe ao abrir')}
            {toggle('staffThread', 'Conversa privada da equipe')}
          </Section>
          <Section title="Encerramento e transcrições">
            <div className="fields-two">
              <Select
                label="Ao encerrar"
                empty={false}
                value={settings.closeAction}
                onChange={(v) => update('closeAction', v as 'archive' | 'delete')}
                options={[
                  { id: 'archive', name: tr('Arquivar e bloquear') },
                  { id: 'delete', name: tr('Excluir canal após transcrição') },
                ]}
              />
              <Select
                label="Fechar por inatividade"
                empty={false}
                value={settings.inactivityHours}
                onChange={(v) => update('inactivityHours', Number(v) as 0 | 24 | 48 | 168)}
                options={[
                  { id: '0', name: tr('Desativado') },
                  { id: '24', name: '24h' },
                  { id: '48', name: '48h' },
                  { id: '168', name: '7d' },
                ]}
              />
              <Select
                label="Reter transcrições (dias)"
                empty={false}
                value={settings.retentionDays}
                onChange={(v) => update('retentionDays', Number(v) as 0 | 7 | 30 | 90)}
                options={[
                  { id: '0', name: tr('Não armazenar') },
                  ...['7', '30', '90'].map((v) => ({ id: v, name: v })),
                ]}
              />
            </div>
            <small>{tr('0 significa não armazenar. Notas e respostas também expiram.')}</small>
            {toggle('dmTranscript', 'Enviar transcrição ao autor por DM')}
            {toggle('requireCloseReason', 'Exigir motivo ao encerrar')}
            {toggle('allowReopen', 'Permitir reabertura')}
            {toggle('authorTranscript', 'Permitir transcrição ao autor')}
          </Section>
          <Section title="Registros e mensagens">
            <div className="fields-two">
              <Select
                label="Canal de registros"
                value={settings.logChannelId}
                options={data.resources.channels}
                onChange={(v) => update('logChannelId', v)}
              />
              <Select
                label="Idioma das mensagens automáticas"
                value={settings.locale}
                empty={false}
                options={[
                  { id: 'pt-BR', name: 'Português' },
                  { id: 'en', name: 'English' },
                  { id: 'es', name: 'Español' },
                ]}
                onChange={(v) => update('locale', v as TicketSettings['locale'])}
              />
            </div>
            <Field label={tr('Mensagem de encerramento')}>
              <textarea
                aria-label={tr('Mensagem de encerramento')}
                value={settings.closedMessage}
                rows={3}
                maxLength={1500}
                onChange={(e) => update('closedMessage', e.target.value)}
              />
            </Field>
            <code>{'{{user}} {{server}} {{ticketId}} {{topic}} {{staff}} {{number}}'}</code>
          </Section>
        </div>
        <aside className="settings-guide">
          <h2>{tr('Permissões e auditoria')}</h2>
          <p>
            {tr(
              'O bot precisa de Gerenciar canais e Gerenciar threads. Transcrições completas exigem Message Content Intent.',
            )}
          </p>
          {!data.contentEnabled && <p className="error">Message Content Intent: {tr('Desativado')}</p>}
          <div className="side-note">
            <p>{tr('Notas internas são visíveis apenas à equipe.')}</p>
          </div>
        </aside>
      </div>
      <div className="save-bar">
        <span>{tr('Configurações de tickets')}</span>
        <Btn primary icon={Save} onClick={() => void save()}>
          {tr('Salvar configurações')}
        </Btn>
      </div>
    </>
  )
}
