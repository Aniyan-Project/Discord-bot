import { StrictMode, useEffect, useRef, useState, createContext, useContext, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Command,
  ExternalLink,
  GitFork,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import '@fontsource-variable/manrope'
import './styles.css'
import {
  LanguageProvider,
  AuthProvider,
  useLanguage,
  useAuth,
  useQuery,
  errorText,
  GuildContext,
  useGuild,
  useGuildOptional,
  type GuildData,
} from './api.js'
import {
  Avatar,
  Brand,
  DemoNotice,
  DiscordPreview,
  EmptyState,
  LanguagePicker,
  Loading,
  MediaTile,
  Notice,
  PageTitle,
} from './components.js'
import { SettingsPage } from './settings.js'
import { CatalogPage, AccountPage, ActivityPage } from './pages.js'
import { commandDescriptions, t } from '../shared/i18n.js'
import { commandIds, defaultSettings, type GuildSummary } from '../shared/domain.js'
import { demoMedia } from '../shared/example-media.js'

function Root() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </LanguageProvider>
  )
}
function RootContent() {
  const { tr } = useLanguage()
  const location = useLocation()
  useEffect(() => {
    document.querySelector('main')?.focus()
  }, [location.pathname])
  return (
    <>
      <a className="skip-link" href="#main-content">
        {tr('skip')}
      </a>
      <Outlet />
    </>
  )
}
function PublicHeader() {
  const { tr } = useLanguage()
  const { session } = useAuth()
  return (
    <>
      <header className="public-header">
        <div className="public-header-inner">
          <Brand />
          <nav aria-label={tr('home')}>
            <NavLink to="/commands">{tr('commands')}</NavLink>
            <a href="https://docs.branilist.com/guide/graphql.html" target="_blank" rel="noreferrer">
              {tr('documentation')}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <NavLink to="/dashboard">{tr('dashboard')}</NavLink>
          </nav>
          <div className="header-actions">
            <LanguagePicker />
            <a
              className="button small secondary login-button"
              href={session?.user ? '/dashboard' : '/auth/discord'}
            >
              {session?.user ? (
                <Avatar name={session.user.username} image={session.user.avatar} />
              ) : (
                <DiscordIcon />
              )}
              {session?.user ? session.user.username : tr('login')}
            </a>
          </div>
        </div>
      </header>
      {session?.demo && <DemoNotice />}
    </>
  )
}
export function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
      <path d="M19.7 5.4a18 18 0 0 0-4.4-1.4l-.6 1.2a16 16 0 0 0-5.4 0L8.7 4a18 18 0 0 0-4.4 1.4C1.5 9.5.8 13.4 1.2 17.2a18 18 0 0 0 5.4 2.7l1.1-1.8-1.7-.8.4-.3a13 13 0 0 0 11.2 0l.4.3-1.7.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.4-.8-8.3-3.1-11.8ZM8.5 14.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  )
}
function Footer() {
  const { tr } = useLanguage()
  return (
    <footer className="public-footer">
      <div>
        <Brand />
        <p>{tr('footer')}</p>
      </div>
      <nav aria-label={tr('support')}>
        <a href="https://github.com/Aniyan-Project/Discord-bot" target="_blank" rel="noreferrer">
          <GitFork size={16} />
          GitHub
        </a>
        <a href="https://docs.branilist.com/guide/terms-of-use.html" target="_blank" rel="noreferrer">
          {tr('documentation')}
        </a>
        <a href="https://github.com/Aniyan-Project/Discord-bot/issues" target="_blank" rel="noreferrer">
          {tr('support')}
        </a>
      </nav>
    </footer>
  )
}
function Home() {
  const { tr } = useLanguage()
  const { session } = useAuth()
  useEffect(() => {
    document.title = 'Branilist Bot · Anime, manga & Discord'
  }, [])
  return (
    <div className="public-site">
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        {new URLSearchParams(location.search).get('auth') === 'failed' && (
          <div className="public-notice">
            <Notice kind="error">{tr('oauthFailed')}</Notice>
          </div>
        )}
        <section className="home-hero">
          <div className="hero-copy">
            <h1>{tr('heroTitle')}</h1>
            <p>{tr('heroBody')}</p>
            <div className="hero-actions">
              {session?.inviteUrl ? (
                <a className="button primary" href={session.inviteUrl}>
                  <DiscordIcon />
                  {tr('invite')}
                  <ArrowUpRight size={16} />
                </a>
              ) : (
                <Link className="button primary" to="/dashboard">
                  <DiscordIcon />
                  {tr(session?.demo ? 'demoAction' : 'dashboard')}
                  <ArrowRight size={16} />
                </Link>
              )}
              <Link className="button quiet" to="/commands">
                {tr('commands')}
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span className="language-pips" aria-hidden="true">
                PT · EN · ES
              </span>
              <span>{tr('heroNote')}</span>
            </div>
          </div>
          <div className="hero-scene">
            <div className="scene-top">
              <span className="scene-icon">
                <DiscordIcon />
              </span>
              <strong>Branilist Bot</strong>
              <span className="subtle-tag">{tr('sample')}</span>
            </div>
            <DiscordPreview large />
            <div className="scene-caption">
              <ShieldCheck size={15} aria-hidden="true" />
              {tr('heroDemoLabel')}
            </div>
          </div>
        </section>
        <section className="feature-section">
          <h2>{tr('featuresTitle')}</h2>
          <div className="feature-layout">
            <div className="feature-main">
              <div className="feature-heading">
                <Search size={22} aria-hidden="true" />
                <h3>{tr('featureSearch')}</h3>
              </div>
              <p>{tr('featureSearchBody')}</p>
              <div className="mini-covers">
                {demoMedia.slice(0, 3).map((media) => (
                  <MediaTile key={media.id} media={media} />
                ))}
              </div>
            </div>
            <div className="feature-secondary">
              <article>
                <BookOpen size={23} aria-hidden="true" />
                <h3>{tr('featureLibrary')}</h3>
                <p>{tr('featureLibraryBody')}</p>
                <Link to="/dashboard/account">
                  {tr('linkAccount')}
                  <ArrowRight size={16} />
                </Link>
              </article>
              <article>
                <Settings2 size={23} aria-hidden="true" />
                <h3>{tr('featureServer')}</h3>
                <p>{tr('featureServerBody')}</p>
                <Link to="/dashboard">
                  {tr('dashboard')}
                  <ArrowRight size={16} />
                </Link>
              </article>
            </div>
          </div>
        </section>
        <section className="home-close">
          <div>
            <h2>{tr('getStarted')}</h2>
            <p>{tr('heroNote')}</p>
          </div>
          <Link className="button primary" to="/dashboard">
            {tr('dashboard')}
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
function CommandsPage({ embedded = false }: { embedded?: boolean }) {
  const { tr, locale } = useLanguage()
  const [mode, setMode] = useState<'slash' | 'prefix'>('slash')
  const [query, setQuery] = useState('')
  const prefix = useGuildOptional()?.data?.settings.prefix || 'b!'
  const body = (
    <>
      <PageTitle title={tr('commandGuide')} description={tr('commandGuideBody')} />
      <div className="command-toolbar">
        <div className="segmented" aria-label={tr('commandModes')}>
          <button aria-pressed={mode === 'slash'} onClick={() => setMode('slash')}>
            / Slash
          </button>
          <button aria-pressed={mode === 'prefix'} onClick={() => setMode('prefix')}>
            {prefix} {tr('prefix')}
          </button>
        </div>
        <label className="search-input">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">{tr('search')}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('search')}
            type="search"
          />
        </label>
      </div>
      <div className="command-table">
        {commandIds
          .filter((id) =>
            `${id} ${t(locale, commandDescriptions[id])}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((id) => (
            <article key={id}>
              <code>
                {mode === 'slash' ? '/' : prefix}
                {id}
              </code>
              <p>{t(locale, commandDescriptions[id])}</p>
              {['profile', 'library', 'progress', 'remove', 'favourites', 'collections'].includes(id) && (
                <span className="command-account">
                  <UserRound size={14} aria-hidden="true" />
                  OAuth
                </span>
              )}
            </article>
          ))}
      </div>
      <Notice>{tr('privateReplies')}</Notice>
    </>
  )
  return embedded ? (
    body
  ) : (
    <div className="public-site">
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="public-content">
        {body}
      </main>
      <Footer />
    </div>
  )
}
function GuildBoundary() {
  const { guildId } = useParams()
  const query = useQuery<GuildData>(guildId ? `/api/guilds/${guildId}` : null)
  const { locale, tr } = useLanguage()
  return (
    <GuildContext.Provider value={query}>
      <div key={guildId}>
        {query.loading ? (
          <Loading />
        ) : query.error ? (
          <>
            <Notice kind="error">{errorText(query.error, locale)}</Notice>
            <button className="button secondary" onClick={query.reload}>
              {tr('retry')}
            </button>
          </>
        ) : !query.data?.guild.installed ? (
          <EmptyState
            title={tr('installFirst')}
            action={
              query.data?.inviteUrl ? (
                <a className="button primary" href={query.data.inviteUrl}>
                  {tr('invite')}
                </a>
              ) : undefined
            }
          />
        ) : (
          <Outlet />
        )}
      </div>
    </GuildContext.Provider>
  )
}
function DashboardLayout() {
  const { session, loading, error, refresh, mutate } = useAuth()
  const { tr, locale } = useLanguage()
  const guilds = useQuery<GuildSummary[]>(session?.user ? '/api/guilds' : null)
  const location = useLocation()
  const navigate = useNavigate()
  const mobile = useRef<HTMLDialogElement>(null)
  const [logoutError, setLogoutError] = useState<unknown>(null)
  const match = location.pathname.match(/^\/dashboard\/(\d{17,20})(?:\/|$)/)
  const guildId = match?.[1]
  const guild = guilds.data?.find((g) => g.id === guildId)
  const base = guildId ? `/dashboard/${guildId}` : '/dashboard'
  useEffect(() => {
    mobile.current?.close()
  }, [location.pathname])
  const nav = (
    <>
      <div className="sidebar-brand">
        <Brand />
      </div>
      <label className="guild-picker">
        <span className="sr-only">{tr('selectServer')}</span>
        <span className="guild-picker-icon">{(guild?.name || 'B').slice(0, 1)}</span>
        <select
          value={guildId || ''}
          onChange={(e) => {
            if (e.target.value) navigate(`/dashboard/${e.target.value}`)
          }}
        >
          <option value="" disabled>
            {tr('selectServer')}
          </option>
          {guilds.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </label>
      <nav className="sidebar-nav" aria-label={tr('dashboard')}>
        <span className="nav-group">{tr('server')}</span>
        <NavLink end to={base}>
          <LayoutDashboard size={18} />
          {tr('overview')}
        </NavLink>
        {guildId && (
          <>
            <NavLink to={`${base}/settings`}>
              <Settings2 size={18} />
              {tr('configuration')}
            </NavLink>
            <NavLink to={`${base}/catalog`}>
              <Search size={18} />
              {tr('catalog')}
            </NavLink>
            <NavLink to={`${base}/activity`}>
              <Radio size={18} />
              {tr('activity')}
            </NavLink>
          </>
        )}
        <span className="nav-group">Branilist</span>
        <NavLink to="/dashboard/account">
          <UserRound size={18} />
          {tr('account')}
        </NavLink>
        <NavLink to="/dashboard/commands">
          <Terminal size={18} />
          {tr('commands')}
        </NavLink>
      </nav>
      <div className="sidebar-bottom">
        <a
          href={session?.supportUrl || 'https://github.com/Aniyan-Project/Discord-bot/issues'}
          target="_blank"
          rel="noreferrer"
        >
          <Headphones size={17} />
          {tr('support')}
          <ArrowUpRight size={14} />
        </a>
        <a href="https://github.com/Aniyan-Project/Discord-bot" target="_blank" rel="noreferrer">
          <GitFork size={17} />
          {tr('openSource')}
          <ArrowUpRight size={14} />
        </a>
        <div className="sidebar-user">
          <Avatar name={session?.user?.username || 'B'} image={session?.user?.avatar} />
          <div>
            <strong>{session?.user?.username}</strong>
            <span>Branilist Bot · v0.1.0</span>
          </div>
        </div>
      </div>
    </>
  )
  if (loading)
    return (
      <div className="auth-screen">
        <Brand />
        <Loading />
      </div>
    )
  if (error)
    return (
      <div className="auth-screen">
        <Brand />
        <Notice kind="error">{errorText(error, locale)}</Notice>
        <button className="button secondary" onClick={() => void refresh()}>
          {tr('retry')}
        </button>
      </div>
    )
  if (!session?.user)
    return (
      <div className="public-site">
        <PublicHeader />
        <main id="main-content" tabIndex={-1} className="login-screen">
          <div className="login-art">
            <img src="/favicon.svg" alt="" width="76" height="76" />
            <span>Branilist Bot</span>
          </div>
          <h1>{tr('dashboard')}</h1>
          <p>{tr('noServersBody')}</p>
          <a className="button primary" href="/auth/discord">
            <DiscordIcon />
            {tr('login')}
          </a>
          <Link to="/" className="text-button">
            {tr('back')}
          </Link>
        </main>
        <Footer />
      </div>
    )
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">{nav}</aside>
      <dialog
        ref={mobile}
        className="mobile-nav"
        aria-label={tr('dashboard')}
        onClick={(e) => {
          if (e.target === e.currentTarget) mobile.current?.close()
        }}
      >
        <button
          className="icon-button mobile-close"
          onClick={() => mobile.current?.close()}
          aria-label={tr('close')}
        >
          <X size={20} />
        </button>
        {nav}
      </dialog>
      <div className="dashboard-area">
        <header className="dashboard-header">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              onClick={() => mobile.current?.showModal()}
              aria-label={tr('menu')}
            >
              <Menu size={20} />
            </button>
            <Link to="/dashboard">{tr('dashboard')}</Link>
            <span>/</span>
            <strong>{guild?.name || tr('account')}</strong>
          </div>
          <div className="header-actions">
            <LanguagePicker />
            <button
              className="icon-button"
              aria-label={tr('logout')}
              title={tr('logout')}
              onClick={async () => {
                try {
                  await mutate('/api/logout', 'POST')
                  await refresh()
                  navigate('/')
                } catch (error) {
                  setLogoutError(error)
                }
              }}
            >
              <LogOut size={18} />
            </button>
            <Avatar name={session.user.username} image={session.user.avatar} />
          </div>
        </header>
        {session.demo && <DemoNotice />}
        <main id="main-content" tabIndex={-1} className="dashboard-main">
          {!!logoutError && <Notice kind="error">{errorText(logoutError, locale)}</Notice>}
          <Outlet context={{ guilds }} />
        </main>
      </div>
    </div>
  )
}
function ServerPicker() {
  const { tr, locale } = useLanguage()
  const { session } = useAuth()
  const query = useQuery<GuildSummary[]>('/api/guilds')
  return (
    <>
      <PageTitle
        title={tr('welcome', { name: session?.user?.username || '' })}
        description={tr('overviewBody')}
      />
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <Notice kind="error">{errorText(query.error, locale)}</Notice>
      ) : !query.data?.length ? (
        <EmptyState title={tr('noServers')} body={tr('noServersBody')} />
      ) : (
        <section className="server-grid" aria-label={tr('selectServer')}>
          {query.data.map((g) => (
            <Link className="server-card" to={`/dashboard/${g.id}`} key={g.id}>
              <Avatar large name={g.name} image={g.icon} />
              <div>
                <h2>{g.name}</h2>
                <p>{g.installed ? tr('configuration') : tr('invite')}</p>
              </div>
              <ArrowRight size={20} />
            </Link>
          ))}
        </section>
      )}
      <section className="welcome-panel">
        <div>
          <h2>{tr('setupTitle')}</h2>
          <p>{tr('setupBody')}</p>
          <Link className="button secondary" to="/dashboard/commands">
            {tr('commands')}
            <ArrowRight size={17} />
          </Link>
        </div>
        <DiscordPreview settings={defaultSettings} />
      </section>
    </>
  )
}
function OverviewPage() {
  const { data } = useGuild()
  const { tr } = useLanguage()
  const { session } = useAuth()
  if (!data) return null
  return (
    <>
      <PageTitle
        title={data.guild.name}
        description={tr('overviewBody')}
        action={
          <span className={`status-badge ${data.bot.online ? 'online' : ''}`}>
            <span />
            {session?.demo ? tr('demo') : data.bot.online ? tr('online') : tr('offline')}
          </span>
        }
      />
      <div className="overview-metrics">
        <article>
          <Command size={20} />
          <span>{tr('usage')}</span>
          <strong>{data.stats.total}</strong>
        </article>
        <article>
          <Zap size={20} />
          <span>{tr('lastDay')}</span>
          <strong>{data.stats.today}</strong>
        </article>
        <article>
          <MessageSquareText size={20} />
          <span>{tr('prefix')}</span>
          <strong className="code-stat">{data.settings.prefix}</strong>
        </article>
      </div>
      <div className="overview-body">
        <section className="overview-start">
          <h2>{tr('setupTitle')}</h2>
          <p>{tr('setupBody')}</p>
          <ul className="setup-list">
            <li>
              <span>
                <Settings2 size={19} />
              </span>
              <div>
                <strong>{tr('configuration')}</strong>
                <p>{tr('featureServerBody')}</p>
              </div>
              <Link className="icon-button" to="settings" aria-label={tr('configuration')}>
                <ArrowRight size={18} />
              </Link>
            </li>
            <li>
              <span>
                <Search size={19} />
              </span>
              <div>
                <strong>{tr('catalog')}</strong>
                <p>{tr('featureSearchBody')}</p>
              </div>
              <Link className="icon-button" to="catalog" aria-label={tr('catalog')}>
                <ArrowRight size={18} />
              </Link>
            </li>
            <li>
              <span>
                <UserRound size={19} />
              </span>
              <div>
                <strong>{tr('account')}</strong>
                <p>{tr('privateReplies')}</p>
              </div>
              <Link className="icon-button" to="/dashboard/account" aria-label={tr('account')}>
                <ArrowRight size={18} />
              </Link>
            </li>
          </ul>
        </section>
        <div>
          <h2 className="preview-heading">{tr('livePreview')}</h2>
          <DiscordPreview settings={data.settings} />
        </div>
      </div>
      <section className="overview-media">
        <div className="section-heading">
          <h2>{tr('featureSearch')}</h2>
          <Link to="catalog">
            {tr('catalog')}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="media-grid small-grid">
          {demoMedia.slice(0, 4).map((media) => (
            <MediaTile key={media.id} media={media} />
          ))}
        </div>
        <p className="muted small">{tr('sample')}</p>
      </section>
    </>
  )
}
function NotFound() {
  const { tr } = useLanguage()
  return (
    <div className="public-site">
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="public-content">
        <EmptyState
          title={tr('notFound')}
          action={
            <Link to="/" className="button primary">
              {tr('home')}
            </Link>
          }
        />
      </main>
    </div>
  )
}
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/commands', element: <CommandsPage /> },
      {
        path: '/dashboard',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <ServerPicker /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'commands', element: <CommandsPage embedded /> },
          {
            path: ':guildId',
            element: <GuildBoundary />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'catalog', element: <CatalogPage /> },
              { path: 'activity', element: <ActivityPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
