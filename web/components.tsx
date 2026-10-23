import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, Check, ExternalLink, Globe2, LoaderCircle, X, BookOpen } from 'lucide-react'
import { useLanguage } from './api.js'
import {
  defaultSettings,
  mediaTitle,
  mediaURL,
  safeImage,
  type GuildSettings,
  type MediaCard,
} from '../shared/domain.js'
import { demoMedia } from '../shared/example-media.js'
import { t } from '../shared/i18n.js'
const example = demoMedia[0]!
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Branilist Bot">
      <img src="/favicon.svg" alt="" width="38" height="38" />
      {!compact && (
        <span>
          Branilist <strong>Bot</strong>
        </span>
      )}
    </Link>
  )
}
export function LanguagePicker() {
  const { locale, setLocale, tr } = useLanguage()
  return (
    <label className="language-picker">
      <Globe2 size={16} aria-hidden="true" />
      <span className="sr-only">{tr('language')}</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
        <option value="pt-BR">Português</option>
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </label>
  )
}
export function DemoNotice() {
  const { tr } = useLanguage()
  return (
    <div className="demo-notice">
      <span>{tr('demo')}</span>
      <p>{tr('demoNotice')}</p>
    </div>
  )
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  useEffect(() => {
    document.title = `${title} · Branilist Bot`
  }, [title])
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  )
}
export function Loading() {
  const { tr } = useLanguage()
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spinner" size={22} aria-hidden="true" />
      {tr('loading')}
    </div>
  )
}
export function Notice({
  children,
  kind = 'info',
}: {
  children: ReactNode
  kind?: 'info' | 'error' | 'success'
}) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'success' ? (
        <Check size={18} aria-hidden="true" />
      ) : (
        <AlertCircle size={18} aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  )
}
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <BookOpen size={32} aria-hidden="true" />
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {action}
    </div>
  )
}
export function Avatar({
  name,
  image,
  large = false,
}: {
  name: string
  image?: string | null
  large?: boolean
}) {
  return (
    <span className={`avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {safeImage(image) ? (
        <img src={safeImage(image)} alt="" width={large ? 64 : 36} height={large ? 64 : 36} />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  )
}
export function Cover({ media, className = '' }: { media: MediaCard; className?: string }) {
  const image = useRef<HTMLImageElement>(null)
  return (
    <div className={`cover ${className}`}>
      <span aria-hidden="true">{media.title.romaji.slice(0, 1)}</span>
      {safeImage(media.coverImage) && (
        <img
          ref={image}
          src={safeImage(media.coverImage)}
          alt={media.title.romaji}
          width="230"
          height="326"
          loading={className.includes('embed-cover') ? 'eager' : 'lazy'}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}
export function MediaTile({
  media,
  onDetails,
}: {
  media: MediaCard
  onDetails?: (media: MediaCard) => void
}) {
  const { tr } = useLanguage()
  return (
    <article className="media-tile">
      <a
        href={mediaURL(media)}
        target="_blank"
        rel="noreferrer"
        className="cover-link"
        aria-label={media.title.romaji}
      >
        <Cover media={media} />
      </a>
      <div className="media-tile-body">
        <span className="muted media-meta">
          {media.type} · {media.seasonYear ?? '—'}
        </span>
        <h2>
          <a href={mediaURL(media)} target="_blank" rel="noreferrer">
            {media.title.romaji}
          </a>
        </h2>
        {onDetails && (
          <button className="text-button" onClick={() => onDetails(media)}>
            {tr('details')}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  )
}
export function DiscordPreview({
  settings = defaultSettings,
  media = example,
  large = false,
}: {
  settings?: GuildSettings
  media?: MediaCard
  large?: boolean
}) {
  const { tr } = useLanguage()
  if (!media) return null
  return (
    <div
      className={`discord-preview ${large ? 'large-preview' : ''}`}
      style={{ '--embed-accent': settings.embedColor } as CSSProperties}
    >
      <div className="discord-channel">
        <span>#</span> anime-e-manga <span className="channel-dot" />
      </div>
      <div className="discord-request">
        <Avatar name="HM" />
        <div>
          <strong>
            Hanami <span>{tr('today')}</span>
          </strong>
          <p>
            <code>{settings.prefix}anime Frieren</code>
          </p>
        </div>
      </div>
      <div className="discord-response">
        <img className="bot-avatar" src="/favicon.svg" alt="" width="36" height="36" />
        <div className="discord-response-body">
          <div className="discord-author">
            <strong>{settings.nickname || 'Branilist Bot'}</strong>
            <span className="app-tag">APP</span>
            <time>14:32</time>
          </div>
          <div className="discord-embed">
            <div className="embed-copy">
              <a href={mediaURL(media)} target="_blank" rel="noreferrer">
                {mediaTitle(media, settings.titleLanguage)}
              </a>
              {settings.showDescriptions && (
                <p>
                  {(media.description || t(settings.locale, 'noDescription'))
                    .replace(/<[^>]*>/g, ' ')
                    .slice(0, settings.compactResults ? 90 : 240)}
                </p>
              )}
              <div className="embed-fields">
                <span>
                  {t(settings.locale, 'episodes')}
                  <strong>{media.episodes ?? '—'}</strong>
                </span>
                <span>
                  {t(settings.locale, 'score')}
                  <strong>{media.averageScore === null ? '—' : `${media.averageScore}/100`}</strong>
                </span>
              </div>
            </div>
            {settings.showCovers && (
              <Cover
                media={media}
                className={settings.compactResults ? 'embed-cover compact-cover' : 'embed-cover'}
              />
            )}
          </div>
          <a className="discord-link" href={mediaURL(media)} target="_blank" rel="noreferrer">
            {t(settings.locale, 'openBranilist')}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  )
}
export function ConfirmDialog({
  open,
  title,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean
  title: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { tr } = useLanguage()
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    if (!open && ref.current?.open) ref.current.close()
  }, [open])
  return (
    <dialog
      className="confirm-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title">{title}</h2>
      <div className="dialog-actions">
        <button className="button secondary" onClick={onCancel} disabled={busy}>
          {tr('cancel')}
        </button>
        <button className="button danger" onClick={onConfirm} disabled={busy}>
          {busy ? tr('saving') : tr('confirm')}
        </button>
      </div>
    </dialog>
  )
}
export function DetailDialog({ media, onClose }: { media: MediaCard | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { tr } = useLanguage()
  useEffect(() => {
    if (media && !ref.current?.open) ref.current?.showModal()
    if (!media && ref.current?.open) ref.current.close()
  }, [media])
  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close()
      }}
      aria-labelledby="media-title"
    >
      <button
        className="icon-button dialog-close"
        onClick={() => ref.current?.close()}
        aria-label={tr('close')}
      >
        <X size={20} />
      </button>
      {media && (
        <>
          <Cover media={media} />
          <div>
            <span className="media-meta">
              {media.type} · {media.seasonYear ?? '—'}
            </span>
            <h2 id="media-title">{media.title.romaji}</h2>
            <p>{(media.description || tr('noDescription')).replace(/<[^>]*>/g, ' ')}</p>
            <a className="button primary" href={mediaURL(media)} target="_blank" rel="noreferrer">
              {tr('openBranilist')}
              <ExternalLink size={16} />
            </a>
          </div>
        </>
      )}
    </dialog>
  )
}
