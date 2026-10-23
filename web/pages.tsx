import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Heart,
  LibraryBig,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlink,
  UserRound,
} from 'lucide-react'
import { useAuth, useGuild, useLanguage, useQuery, errorText } from './api.js'
import {
  Avatar,
  ConfirmDialog,
  Cover,
  DetailDialog,
  EmptyState,
  Loading,
  MediaTile,
  Notice,
  PageTitle,
} from './components.js'
import { mediaURL, type MediaCard, type ProfileCard } from '../shared/domain.js'
type CatalogResult = { nodes: MediaCard[]; pageInfo: { hasNextPage: boolean } }
export function CatalogPage() {
  const { tr, locale } = useLanguage()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [offset, setOffset] = useState(0)
  const [trending, setTrending] = useState(false)
  const [selected, setSelected] = useState<MediaCard | null>(null)
  const params = new URLSearchParams({ q: query, offset: String(offset), ...(type ? { type } : {}) })
  const result = useQuery<CatalogResult | MediaCard[]>(
    trending ? `/api/trending?type=${type || 'ANIME'}` : `/api/catalog?${params}`,
  )
  const items = result.data ? (Array.isArray(result.data) ? result.data : result.data.nodes) : []
  function search(event: FormEvent) {
    event.preventDefault()
    setOffset(0)
    setTrending(false)
    setQuery(input.trim())
  }
  return (
    <>
      <PageTitle title={tr('catalog')} description={tr('catalogBody')} />
      <form className="catalog-search" onSubmit={search}>
        <label className="search-input large-search">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">{tr('search')}</span>
          <input
            type="search"
            value={input}
            maxLength={150}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tr('searchPlaceholder')}
          />
        </label>
        <button className="button primary" type="submit">
          {tr('search')}
          <ArrowRight size={17} />
        </button>
      </form>
      <div className="catalog-toolbar">
        <div className="segmented" aria-label={tr('catalog')}>
          {[
            ['', tr('all')],
            ['ANIME', tr('anime')],
            ['MANGA', tr('manga')],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={type === value && !trending}
              onClick={() => {
                setType(value!)
                setOffset(0)
                setTrending(false)
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className={`button small ${trending ? 'secondary selected' : 'quiet'}`}
          aria-pressed={trending}
          onClick={() => {
            setTrending((v) => !v)
            setOffset(0)
          }}
        >
          <Sparkles size={16} />
          {tr('trending')}
        </button>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <>
          <Notice kind="error">{errorText(result.error, locale)}</Notice>
          <button className="button secondary" onClick={result.reload}>
            {tr('retry')}
          </button>
        </>
      ) : !items.length ? (
        <EmptyState title={tr('emptySearch')} />
      ) : (
        <div className="media-grid catalog-grid">
          {items.map((media) => (
            <MediaTile key={media.id} media={media} onDetails={setSelected} />
          ))}
        </div>
      )}
      {!trending && !result.loading && !result.error && (
        <div className="pagination">
          <button
            className="button secondary"
            onClick={() => setOffset((value) => Math.max(0, value - 12))}
            disabled={offset === 0}
          >
            <ArrowLeft size={16} />
            {tr('previous')}
          </button>
          <span>{Math.floor(offset / 12) + 1}</span>
          <button
            className="button secondary"
            onClick={() => setOffset((value) => value + 12)}
            disabled={Array.isArray(result.data) || !result.data?.pageInfo.hasNextPage || offset + 12 > 10000}
          >
            {tr('next')}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <DetailDialog media={selected} onClose={() => setSelected(null)} />
    </>
  )
}
interface LibraryItem {
  mediaId: string
  progress: number
  status: 'PLANNING' | 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED'
  score: number | null
  media: MediaCard | null
}
function LibraryRow({
  entry,
  onSaved,
  onRemove,
}: {
  entry: LibraryItem
  onSaved: () => void
  onRemove: () => void
}) {
  const { tr, locale } = useLanguage()
  const { mutate } = useAuth()
  const [progress, setProgress] = useState(entry.progress)
  const [status, setStatus] = useState(entry.status)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    setProgress(entry.progress)
    setStatus(entry.status)
  }, [entry.progress, entry.status])
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await mutate('/api/account/progress', 'PUT', { mediaId: entry.mediaId, progress, status })
      onSaved()
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="library-row">
      {entry.media ? (
        <a href={mediaURL(entry.media)} target="_blank" rel="noreferrer">
          <Cover media={entry.media} />
        </a>
      ) : (
        <div className="cover cover-placeholder" />
      )}
      <div className="library-row-body">
        <h3>{entry.media?.title.romaji || entry.mediaId}</h3>
        <span className="muted small">
          {entry.media?.type ?? '—'} · ID {entry.mediaId}
        </span>
        <form onSubmit={save}>
          <label>
            <span className="sr-only">{tr('progress')}</span>
            <input
              aria-label={`${tr('progress')} · ${entry.media?.title.romaji || entry.mediaId}`}
              type="number"
              value={progress}
              min={0}
              max={100000}
              required
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="sr-only">{tr('library')}</span>
            <select
              aria-label={`${tr('library')} · ${entry.media?.title.romaji || entry.mediaId}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {(['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'] as const).map((value) => (
                <option key={value} value={value}>
                  {tr(value)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary small"
            disabled={busy || (progress === entry.progress && status === entry.status)}
            type="submit"
          >
            {busy ? tr('saving') : tr('save')}
          </button>
          <button
            className="icon-button danger-text"
            type="button"
            onClick={onRemove}
            aria-label={`${tr('remove')} · ${entry.media?.title.romaji || entry.mediaId}`}
          >
            <Trash2 size={17} />
          </button>
        </form>
        {!!error && <Notice kind="error">{errorText(error, locale)}</Notice>}
      </div>
    </article>
  )
}
function LibraryPanel() {
  const { tr, locale } = useLanguage()
  const { mutate } = useAuth()
  const [offset, setOffset] = useState(0)
  const [filter, setFilter] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<unknown>(null)
  const result = useQuery<{ nodes: LibraryItem[]; pageInfo: { hasNextPage: boolean } }>(
    `/api/account/library?offset=${offset}${filter ? `&status=${filter}` : ''}`,
  )
  async function remove() {
    if (!removeId) return
    setBusy(true)
    setError(null)
    try {
      await mutate(`/api/account/library/${removeId}`, 'DELETE')
      setRemoveId(null)
      setNotice(tr('removed'))
      result.reload()
    } catch (error) {
      setError(error)
      setRemoveId(null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="library-toolbar">
        <label className="field">
          <span className="sr-only">{tr('library')}</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">{tr('all')}</option>
            {(['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'] as const).map((status) => (
              <option key={status} value={status}>
                {tr(status)}
              </option>
            ))}
          </select>
        </label>
        <span className="privacy-inline">
          <ShieldCheck size={15} />
          {tr('privateReplies')}
        </span>
      </div>
      {notice && <Notice kind="success">{notice}</Notice>}
      {!!error && <Notice kind="error">{errorText(error, locale)}</Notice>}
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Notice kind="error">{errorText(result.error, locale)}</Notice>
      ) : result.data?.nodes.length ? (
        <div className="library-list">
          {result.data.nodes.map((entry) => (
            <LibraryRow
              key={entry.mediaId}
              entry={entry}
              onSaved={() => {
                setNotice(tr('progressSaved'))
                result.reload()
              }}
              onRemove={() => setRemoveId(entry.mediaId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={tr('emptyLibrary')} />
      )}
      <div className="pagination">
        <button
          className="button secondary"
          disabled={offset === 0 || result.loading}
          onClick={() => setOffset((v) => Math.max(0, v - 12))}
        >
          <ArrowLeft size={16} />
          {tr('previous')}
        </button>
        <span>{Math.floor(offset / 12) + 1}</span>
        <button
          className="button secondary"
          disabled={!result.data?.pageInfo.hasNextPage || result.loading || offset + 12 > 10000}
          onClick={() => setOffset((v) => v + 12)}
        >
          {tr('next')}
          <ArrowRight size={16} />
        </button>
      </div>
      <ConfirmDialog
        open={!!removeId}
        title={tr('confirmRemove')}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => void remove()}
        busy={busy}
      />
    </>
  )
}
function FavouritesPanel() {
  const { tr, locale } = useLanguage()
  const result = useQuery<MediaCard[]>('/api/account/favourites')
  return result.loading ? (
    <Loading />
  ) : result.error ? (
    <Notice kind="error">{errorText(result.error, locale)}</Notice>
  ) : result.data?.length ? (
    <div className="media-grid catalog-grid">
      {result.data.map((media) => (
        <MediaTile key={media.id} media={media} />
      ))}
    </div>
  ) : (
    <EmptyState title={tr('noData')} />
  )
}
function CollectionsPanel() {
  const { tr, locale } = useLanguage()
  const result =
    useQuery<Array<{ id: string; name: string; itemCount: number; visibility: string }>>(
      '/api/account/collections',
    )
  return result.loading ? (
    <Loading />
  ) : result.error ? (
    <Notice kind="error">{errorText(result.error, locale)}</Notice>
  ) : result.data?.length ? (
    <div className="collection-list">
      {result.data.map((c) => (
        <article key={c.id}>
          <LibraryBig size={24} />
          <div>
            <h3>{c.name}</h3>
            <p>
              {c.itemCount} · {c.visibility}
            </p>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState title={tr('noData')} />
  )
}
export function AccountPage() {
  const { tr, locale } = useLanguage()
  const { session, refresh, mutate } = useAuth()
  const [tab, setTab] = useState('library')
  const [unlink, setUnlink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const profile = useQuery<ProfileCard>(session?.linked ? '/api/account/profile' : null)
  async function disconnect() {
    setBusy(true)
    setError(null)
    try {
      await mutate('/api/account/unlink', 'POST')
      setUnlink(false)
      await refresh()
    } catch (error) {
      setError(error)
      setUnlink(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle title={tr('account')} description={tr('accountBody')} />
      {new URLSearchParams(location.search).get('error') && <Notice kind="error">{tr('oauthFailed')}</Notice>}
      {!!error && <Notice kind="error">{errorText(error, locale)}</Notice>}
      <section className="account-connection">
        <Avatar large name={session?.linked?.displayName || 'B'} image={session?.linked?.avatarUrl} />
        <div>
          <span className={`status-badge ${session?.linked ? 'online' : ''}`}>
            <span />
            {tr(session?.linked ? 'linked' : 'notLinked')}
          </span>
          <h2>{session?.linked?.displayName || 'Branilist'}</h2>
          {session?.linked && (
            <a
              href={`https://branilist.com/user/${encodeURIComponent(session.linked.username)}`}
              target="_blank"
              rel="noreferrer"
            >
              @{session.linked.username}
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="connection-actions">
          {session?.linked ? (
            <>
              <button className="button quiet danger-text" onClick={() => setUnlink(true)}>
                <Unlink size={16} />
                {tr('unlinkAccount')}
              </button>
              {session.configured.branilist && (
                <a className="text-button" href="/auth/branilist">
                  {tr('linkAccount')}
                  <ArrowRight size={15} />
                </a>
              )}
            </>
          ) : session?.configured.branilist ? (
            <a className="button primary" href="/auth/branilist">
              <Link2 size={17} />
              {tr('linkAccount')}
            </a>
          ) : (
            <span className="muted">{tr('oauthUnavailable')}</span>
          )}
        </div>
      </section>
      <div className="privacy-note">
        <ShieldCheck size={18} />
        <p>{tr('privacyNote')}</p>
      </div>
      {session?.linked && (
        <>
          {profile.data?.bio && <p className="profile-bio">{profile.data.bio.replace(/<[^>]*>/g, ' ')}</p>}
          <div className="account-tabs" role="group" aria-label={tr('account')}>
            {[
              ['library', LibraryBig],
              ['favourites', Heart],
              ['collections', BookIcon],
            ].map(([value, Icon]) => {
              const TabIcon = Icon as typeof Heart
              const key = value as 'library' | 'favourites' | 'collections'
              return (
                <button
                  key={key}
                  className={tab === key ? 'active' : ''}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                >
                  <TabIcon size={18} />
                  {tr(key)}
                </button>
              )
            })}
          </div>
          {tab === 'library' ? (
            <LibraryPanel />
          ) : tab === 'favourites' ? (
            <FavouritesPanel />
          ) : (
            <CollectionsPanel />
          )}
        </>
      )}
      <ConfirmDialog
        open={unlink}
        title={tr('unlinkConfirm')}
        onConfirm={() => void disconnect()}
        onCancel={() => setUnlink(false)}
        busy={busy}
      />
    </>
  )
}
const BookIcon = LibraryBig
export function ActivityPage() {
  const { data } = useGuild()
  const { tr, locale } = useLanguage()
  const result = useQuery<Array<{ id: number; command: string; ok: number; at: number }>>(
    data ? `/api/guilds/${data.guild.id}/activity` : null,
  )
  return (
    <>
      <PageTitle title={tr('activity')} description={tr('activityBody')} />
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Notice kind="error">{errorText(result.error, locale)}</Notice>
      ) : !result.data?.length ? (
        <EmptyState title={tr('noActivity')} />
      ) : (
        <div className="table-scroll">
          <table className="activity-table">
            <caption className="sr-only">{tr('activity')}</caption>
            <thead>
              <tr>
                <th>{tr('command')}</th>
                <th>{tr('result')}</th>
                <th>{tr('time')}</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((event) => (
                <tr key={event.id}>
                  <td>
                    <code>/{event.command}</code>
                  </td>
                  <td>
                    <span className={`result-status ${event.ok ? 'success' : 'failure'}`}>
                      <span />
                      {tr(event.ok ? 'success' : 'failure')}
                    </span>
                  </td>
                  <td>
                    <time dateTime={new Date(event.at).toISOString()}>
                      {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                        event.at,
                      )}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
