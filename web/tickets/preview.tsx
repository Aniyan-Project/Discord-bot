import { Hash, ChevronRight, LockKeyhole } from 'lucide-react'
import { useTickets } from './context.js'
import type { TicketPanel, TicketTopic } from '../../shared/tickets.js'
export function TicketPreview({
  panel,
  onTest,
}: {
  panel: TicketPanel
  onTest?: (topic: TicketTopic) => void
}) {
  const { tr, data } = useTickets()
  const channel = data.resources.channels.find((c) => c.id === panel.channelId)?.name ?? tr('Canal do painel')
  return (
    <div className="discord">
      <div className="discord-channel">
        <Hash size={18} />
        {channel}
        <span>{tr('Prévia no Discord')}</span>
      </div>
      <div className="discord-body">
        <div className="discord-author">
          <span className="bot-avatar">B</span>
          <strong>Branilist Bot</strong>
          <span className="app-tag">APP</span>
        </div>
        <div
          className={`discord-message ${panel.format === 'classic' ? 'classic' : ''}`}
          style={{ '--message-accent': panel.color } as React.CSSProperties}
        >
          <div className="discord-brand">Branilist • {tr('Equipe')}</div>
          <h3>{panel.title}</h3>
          <p>{panel.description}</p>
          {panel.image && (
            <img
              className="panel-image"
              src={panel.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          {panel.format === 'v2' && (
            <>
              <hr />
              <div className="topic-preview">
                {panel.topics.map((t) => (
                  <div key={t.id}>
                    <span>{t.emoji}</span>
                    <div>
                      <strong>{t.name}</strong>
                      <small>{t.description}</small>
                    </div>
                  </div>
                ))}
              </div>
              <hr />
            </>
          )}
          <small className="discord-footer">{panel.footer}</small>
        </div>
        <div className="discord-interactions">
          {panel.style === 'select' ? (
            <select
              aria-label={tr('Testar abertura')}
              value=""
              onChange={(e) => {
                const topic = panel.topics.find((t) => t.id === e.target.value)
                if (topic) onTest?.(topic)
              }}
            >
              <option value="" disabled>
                {tr('Selecionar assunto')}
              </option>
              {panel.topics.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.emoji} {t.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="button-topics">
              {panel.topics.map((t) => (
                <button key={t.id} type="button" onClick={() => onTest?.(t)}>
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
