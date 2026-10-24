import { useRef } from 'react'
import { useAuth, useGuild, useLanguage, useQuery, errorText } from './api.js'
import { Loading, Notice } from './components.js'
import { StudioEditor, studioInitialDraft } from './message-studio-editor.jsx'
import { parseStudioDraft, type StudioDraft, type StudioVariables } from '../shared/message-studio.js'

interface StudioData {
  draft: StudioDraft | null
  revision: number
  variables: StudioVariables
  channels: Array<{ id: string; name: string; webhook: boolean }>
}
export function MessageStudioPage() {
  const { data: guild } = useGuild()
  const id = guild!.guild.id
  const query = useQuery<StudioData>(`/api/guilds/${id}/message-studio`)
  const { locale, tr } = useLanguage()
  if (query.loading) return <Loading />
  if (query.error)
    return (
      <Notice kind="error">
        {errorText(query.error, locale)}{' '}
        <button type="button" className="text-button" onClick={query.reload}>
          {tr('retry')}
        </button>
      </Notice>
    )
  if (!query.data) return null
  return <ConnectedStudio key={id} id={id} data={query.data} />
}
function ConnectedStudio({ id, data }: { id: string; data: StudioData }) {
  const { locale } = useLanguage()
  const { session, mutate } = useAuth()
  const revision = useRef(data.revision)
  const initial = useRef<StudioDraft | null>(null)
  if (!initial.current) {
    initial.current =
      data.draft ??
      parseStudioDraft({ ...structuredClone(studioInitialDraft), channelId: data.channels[0]?.id ?? '' })
    // An icon is optional on Discord servers. Start with a link accessory if absent.
    if (!data.draft && !data.variables.serverIcon) {
      const section = initial.current.components[0]?.components?.find((c) => c.type === 9)
      if (section) section.accessory = { type: 2, style: 5, label: 'Branilist', url: 'https://branilist.com' }
    }
  }
  return (
    <StudioEditor
      initialDraft={initial.current}
      variables={data.variables}
      channels={data.channels}
      locale={locale}
      demo={session?.demo ?? false}
      onError={(error: unknown) => errorText(error, locale)}
      onSave={async (draft: StudioDraft) => {
        const result = await mutate<{ revision: number }>(`/api/guilds/${id}/message-studio/draft`, 'PUT', {
          draft,
          revision: revision.current,
        })
        revision.current = result.revision
      }}
      onSend={(draft: StudioDraft, requestId: string) =>
        mutate<{ id: string; url: string | null; demo: boolean }>(
          `/api/guilds/${id}/message-studio/send`,
          'POST',
          { draft, requestId },
        )
      }
    />
  )
}
