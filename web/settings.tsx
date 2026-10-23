import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useBlocker } from 'react-router-dom'
import { Check, Eye, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useAuth, useGuild, useLanguage, errorText } from './api.js'
import { DiscordPreview, Notice, PageTitle } from './components.js'
import { commandIds, guildSettingsSchema, type GuildSettings } from '../shared/domain.js'
import { commandDescriptions, t } from '../shared/i18n.js'
function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  )
}
function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="settings-section">
      <legend>{title}</legend>
      {description && <p className="fieldset-description">{description}</p>}
      {children}
    </fieldset>
  )
}
export function SettingsPage() {
  const { data, setData, reload } = useGuild()
  const current = data!
  const { tr, locale } = useLanguage()
  const { mutate } = useAuth()
  const [draft, setDraft] = useState<GuildSettings>(() => structuredClone(current.settings))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [success, setSuccess] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(current.settings)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(tr('discardConfirm'))) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker, tr])
  useEffect(() => {
    setDraft(structuredClone(current.settings))
    setError(null)
  }, [current.guild.id, current.revision])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [dirty])
  function update<K extends keyof GuildSettings>(key: K, value: GuildSettings[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }))
    setSuccess(false)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = guildSettingsSchema.safeParse(draft)
    if (!parsed.success) {
      setError(new Error('invalidInput'))
      return
    }
    setBusy(true)
    try {
      const result = await mutate<{ settings: GuildSettings; revision: number }>(
        `/api/guilds/${current.guild.id}/settings`,
        'PUT',
        { settings: parsed.data, revision: current.revision },
      )
      setData({ ...current, ...result })
      setDraft(structuredClone(result.settings))
      setSuccess(true)
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title={tr('configuration')}
        description={tr('settingsBody')}
        action={
          <span className="page-icon">
            <SlidersHorizontal size={22} aria-hidden="true" />
          </span>
        }
      />
      {success && <Notice kind="success">{tr('savedSuccess')}</Notice>}
      {!!error && (
        <Notice kind="error">
          {error instanceof Error && error.message === 'invalidInput'
            ? tr('invalidInput')
            : errorText(error, locale)}{' '}
          <button className="text-button" onClick={reload}>
            {tr('retry')}
          </button>
        </Notice>
      )}
      <div className="settings-layout">
        <form id="settings-form" onSubmit={save} className="settings-form">
          <Section title={tr('identity')} description={tr('identityBody')}>
            <div className="field-grid">
              <label className="field">
                <span>{tr('nickname')}</span>
                <input
                  value={draft.nickname}
                  maxLength={32}
                  placeholder="Branilist Bot"
                  onChange={(e) => update('nickname', e.target.value)}
                />
                <small>{tr('nicknameHelp')}</small>
              </label>
              <label className="field">
                <span>{tr('language')}</span>
                <select
                  value={draft.locale}
                  onChange={(e) => update('locale', e.target.value as typeof draft.locale)}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
                <small>{tr('languageHelp')}</small>
              </label>
            </div>
          </Section>
          <Section title={tr('commandModes')}>
            <label className="field prefix-field">
              <span>{tr('prefix')}</span>
              <div className="prefix-input">
                <span aria-hidden="true">
                  <span>&gt;</span>_
                </span>
                <input
                  value={draft.prefix}
                  required
                  minLength={1}
                  maxLength={8}
                  onChange={(e) => update('prefix', e.target.value)}
                  aria-describedby="prefix-help"
                />
              </div>
              <small id="prefix-help">{tr('prefixHelp')}</small>
            </label>
            <div className="switch-list">
              <Toggle
                label={tr('prefixMode')}
                hint={tr('prefixModeBody')}
                checked={draft.prefixEnabled}
                onChange={(v) => update('prefixEnabled', v)}
                disabled={!current.prefixAvailable}
              />
              <Toggle
                label={tr('slashMode')}
                hint={tr('slashModeBody')}
                checked={draft.slashEnabled}
                onChange={(v) => update('slashEnabled', v)}
              />
            </div>
            {!current.prefixAvailable && <Notice>{tr('messageIntentDisabled')}</Notice>}
            <label className="field cooldown-field">
              <span>{tr('cooldown')}</span>
              <div className="inline-input">
                <input
                  type="number"
                  min={2}
                  max={60}
                  required
                  value={draft.cooldownSeconds}
                  onChange={(e) => update('cooldownSeconds', Number(e.target.value))}
                />
                <span>{tr('seconds')}</span>
              </div>
            </label>
          </Section>
          <Section title={tr('responses')}>
            <div className="field-grid">
              <label className="field">
                <span>{tr('accent')}</span>
                <div className="color-control">
                  <input
                    type="color"
                    value={draft.embedColor}
                    onChange={(e) => update('embedColor', e.target.value)}
                  />
                  <code aria-hidden="true">{draft.embedColor.toUpperCase()}</code>
                </div>
              </label>
              <label className="field">
                <span>{tr('titleLanguage')}</span>
                <select
                  value={draft.titleLanguage}
                  onChange={(e) => update('titleLanguage', e.target.value as typeof draft.titleLanguage)}
                >
                  <option value="romaji">Romaji</option>
                  <option value="english">English</option>
                  <option value="portuguese">Português</option>
                  <option value="native">日本語 / Native</option>
                </select>
              </label>
            </div>
            <div className="switch-list">
              <Toggle
                label={tr('showCovers')}
                checked={draft.showCovers}
                onChange={(v) => update('showCovers', v)}
              />
              <Toggle
                label={tr('showDescriptions')}
                checked={draft.showDescriptions}
                onChange={(v) => update('showDescriptions', v)}
              />
              <Toggle
                label={tr('compact')}
                checked={draft.compactResults}
                onChange={(v) => update('compactResults', v)}
              />
            </div>
          </Section>
          <Section title={tr('channels')} description={tr('channelsHelp')}>
            <div className="channel-options">
              {current.channels.map((channel) => (
                <label key={channel.id}>
                  <input
                    type="checkbox"
                    checked={draft.allowedChannelIds.includes(channel.id)}
                    onChange={(event) =>
                      update(
                        'allowedChannelIds',
                        current.channels
                          .filter((c) =>
                            c.id === channel.id
                              ? event.target.checked
                              : draft.allowedChannelIds.includes(c.id),
                          )
                          .map((c) => c.id),
                      )
                    }
                  />
                  <span>
                    <span aria-hidden="true">#</span> {channel.name}
                  </span>
                </label>
              ))}
            </div>
          </Section>
          <Section title={tr('enabledCommands')} description={tr('enabledCommandsHelp')}>
            <div className="command-switches">
              {commandIds.map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={!draft.disabledCommands.includes(id)}
                    onChange={(event) =>
                      update(
                        'disabledCommands',
                        commandIds.filter((command) =>
                          command === id ? !event.target.checked : draft.disabledCommands.includes(command),
                        ),
                      )
                    }
                  />
                  <span>
                    <code>/{id}</code>
                    <small>{t(locale, commandDescriptions[id])}</small>
                  </span>
                </label>
              ))}
            </div>
          </Section>
        </form>
        <aside className="preview-sidebar">
          <div className="preview-heading">
            <Eye size={18} aria-hidden="true" />
            <h2>{tr('livePreview')}</h2>
            <span className="preview-live-dot" />
          </div>
          <p>{tr('livePreviewBody')}</p>
          <DiscordPreview settings={draft} />
          <div className="safety-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>{tr('adultSafety')}</p>
          </div>
          <div className="settings-meta">
            <Check size={15} aria-hidden="true" />
            <span>{dirty ? tr('unsaved') : tr('saved')}</span>
          </div>
        </aside>
      </div>
      {dirty && (
        <div className="save-bar">
          <span>
            <i aria-hidden="true" />
            {tr('unsaved')}
          </span>
          <div>
            <button
              className="button quiet"
              disabled={busy}
              onClick={() => {
                setDraft(structuredClone(current.settings))
                setError(null)
              }}
            >
              {tr('discard')}
            </button>
            <button className="button primary" type="submit" form="settings-form" disabled={busy}>
              <Save size={17} aria-hidden="true" />
              {busy ? tr('saving') : tr('save')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
