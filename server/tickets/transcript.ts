import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { TicketRecord, Transcript, TranscriptDocument } from '../../shared/tickets.js'
import { transcriptStyle } from '../../shared/transcript-style.js'
import { tt } from '../../shared/ticket-i18n.js'
const require = createRequire(import.meta.url)
const font =
  'data:font/woff2;base64,' +
  readFileSync(
    require.resolve('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2'),
  ).toString('base64')
const css = transcriptStyle.replace('__FONT__', font)
export function documentFor(t: TicketRecord, transcript: Transcript): TranscriptDocument {
  return {
    transcript,
    locale: t.settings.locale,
    ticket: {
      id: t.id,
      number: t.number,
      guildId: t.guildId,
      guildName: t.guildName,
      channelName: t.channelName,
      authorName: t.authorName,
      staffId: t.staffId,
      staffName: t.staffName,
      createdAt: t.createdAt,
      closedAt: t.closedAt,
      closedByName: t.closedByName,
      reason: t.reason,
      status: t.status,
      subject: t.topic.name,
    },
  }
}
export function transcriptCsp(nonce: string) {
  return `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src data:; img-src https://cdn.discordapp.com https://media.discordapp.net; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
}
export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}
function https(value: string | undefined, avatar = false) {
  try {
    const url = new URL(value || '')
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!avatar || ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname))
      ? url.href
      : ''
  } catch {
    return ''
  }
}
export function renderTranscript(data: TranscriptDocument, nonce = randomBytes(18).toString('base64')) {
  const { ticket: t, transcript } = data,
    tr = (s: string) => tt(data.locale, s),
    e = escapeHtml
  const date = (at: number) => new Date(at).toLocaleString(data.locale)
  const status = tr(t.status === 'closed' ? 'Fechado' : 'Em atendimento')
  const meta = [
    [tr('Servidor'), t.guildName || t.guildId],
    [tr('Autor'), t.authorName],
    [tr('Assunto'), t.subject],
    [tr('Responsável'), t.staffName || t.staffId || '—'],
    [tr('Aberto em'), date(t.createdAt)],
    [tr('Encerrado em'), t.closedAt ? date(t.closedAt) : '—'],
    [
      tr('Duração'),
      `${Math.max(0, Math.floor(((t.closedAt || transcript.capturedAt) - t.createdAt) / 60000))} min`,
    ],
  ]
  let day = ''
  const messages = transcript.messages
    .map((m) => {
      const label = new Date(m.at).toLocaleDateString(data.locale),
        divider = day !== label ? `<div class="date-line">${e(label)}</div>` : ''
      day = label
      const avatar = https(m.avatar, true)
      const embeds = (m.embeds || [])
        .map(
          (
            embed,
          ) => `<div class="embed"${embed.color !== undefined && Number.isInteger(embed.color) && embed.color >= 0 && embed.color <= 0xffffff ? ` style="border-color:#${embed.color.toString(16).padStart(6, '0')}"` : ''}>
      ${embed.title ? `<h2>${e(embed.title)}</h2>` : ''}${embed.description ? `<p style="white-space:pre-wrap">${e(embed.description)}</p>` : ''}
      ${(embed.fields || []).length ? `<dl class="embed-fields">${embed.fields!.map((f) => `<div${f.inline ? '' : ' style="grid-column:1/-1"'}><dt>${e(f.name)}</dt><dd style="white-space:pre-wrap">${e(f.value)}</dd></div>`).join('')}</dl>` : ''}
      ${embed.footer ? `<small>${e(embed.footer)}</small>` : ''}</div>`,
        )
        .join('')
      const files = (m.files || m.attachments.map((url) => ({ url, name: tr('Anexo'), size: 0 })))
        .map((file) => {
          const url = https(file.url)
          return url
            ? `<div class="attachment"><a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(file.name)}</a>${file.size ? `<small>${Math.ceil(file.size / 1024)} KB</small>` : ''}</div>`
            : ''
        })
        .join('')
      return `${divider}<article class="chat-message" data-message><div class="avatar${m.bot ? ' bot' : ''}" aria-hidden="true">${avatar ? `<img src="${e(avatar)}" alt="" loading="lazy" width="36" height="36" style="border-radius:50%">` : e(m.author.slice(0, 2).toUpperCase())}</div><div class="chat-content"><div class="msg-author"><strong>${e(m.author)}</strong>${m.bot ? '<span class="bot-tag">APP</span>' : ''}<time datetime="${e(new Date(m.at).toISOString())}">${e(new Date(m.at).toLocaleTimeString(data.locale, { hour: '2-digit', minute: '2-digit' }))}</time>${m.editedAt ? `<small>(${e(tr('Editado'))} ${e(date(m.editedAt))})</small>` : ''}</div><p style="white-space:pre-wrap">${e(m.content)}</p>${embeds}${files}</div></article>`
    })
    .join('')
  const encoded = JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  )
  const html = `<!doctype html><html lang="${e(data.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${e(transcriptCsp(nonce))}"><title>Ticket #${t.number} · ${e(tr('Transcrição'))} · Branilist Bot</title><style>${css}</style></head><body><a class="skip" href="#content">${e(tr('Pular para o conteúdo'))}</a><header><div class="brand"><span class="brand-b" aria-hidden="true">B</span>Branilist Bot</div><span class="server">${e(t.guildName || t.guildId)}</span></header><main id="content" tabindex="-1"><div class="heading"><div><h1>Ticket #${t.number} · ${e(t.subject)}</h1><p>${e(tr('Transcrição'))} · ${e(t.channelName || `ticket-${t.number}`)} · ${e(date(t.createdAt))}</p></div><span class="badge">${e(status)}</span></div>
    ${!transcript.contentAvailable ? `<p class="badge orange">${e(tr('Conteúdo de mensagens indisponível. Message Content Intent pode estar desativado.'))}</p>` : ''}
    ${transcript.truncated ? `<p class="badge orange">${e(tr('Transcrição parcial: apenas as 5.000 mensagens mais recentes.'))}</p>` : ''}
    <div class="toolbar"><div class="search"><input id="search" type="search" aria-label="${e(tr('Buscar na conversa'))}" placeholder="${e(tr('Buscar na conversa'))}…"></div><span id="count" class="search-count" role="status">${transcript.messages.length} ${e(tr('Mensagens'))}</span><button id="export-html">${e(tr('Baixar HTML'))}</button><button id="export-json">${e(tr('Exportar JSON'))}</button></div>
    <div class="transcript-layout"><div class="timeline">${messages || `<p>${e(tr('Nenhuma mensagem disponível.'))}</p>`}<p id="no-results" class="no-results" hidden>${e(tr('Nenhuma mensagem encontrada.'))}</p>${t.closedAt ? `<div class="closing"><h2 style="font-size:15px">${e(tr('Atendimento encerrado'))}</h2><p>${e(t.closedByName || tr('Não registrado'))} · ${e(date(t.closedAt))}</p><p>${e(tr('Motivo do encerramento'))}: ${e(t.reason || '—')}</p><small>${e(tr('Transcrição gerada em'))} ${e(date(transcript.capturedAt))}</small></div>` : ''}</div><aside><h2>${e(tr('Dados do atendimento'))}</h2><dl class="meta">${meta.map(([key, value]) => `<div><dt>${e(key)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p class="privacy">${e(tr('Notas internas e conversa privada da equipe não fazem parte desta transcrição.'))}</p></aside></div><footer>Branilist Bot · ${e(tr('Registro de atendimento'))}</footer></main>
    <script type="application/json" id="transcript-data" nonce="${nonce}">${encoded}</script><script nonce="${nonce}">
    const data=JSON.parse(document.getElementById('transcript-data').textContent), messages=[...document.querySelectorAll('[data-message]')];
    document.getElementById('search').addEventListener('input',e=>{const query=e.target.value.trim().toLocaleLowerCase();let count=0;for(const message of messages){message.hidden=!!query&&!message.textContent.toLocaleLowerCase().includes(query);if(!message.hidden)count++}document.getElementById('count').textContent=count+' / '+messages.length;document.getElementById('no-results').hidden=count>0;document.querySelectorAll('.date-line').forEach(el=>el.hidden=!!query)});
    function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
    document.getElementById('export-json').addEventListener('click',()=>download(JSON.stringify(data.transcript,null,2),'application/json','ticket-'+data.ticket.number+'.json'));
    document.getElementById('export-html').addEventListener('click',()=>{const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('[data-message],.date-line').forEach(el=>el.hidden=false);clone.querySelector('#no-results').hidden=true;clone.querySelector('#search').value='';clone.querySelectorAll('script[nonce]').forEach(script=>script.setAttribute('nonce','${nonce}'));download('<!doctype html>'+clone.outerHTML.replaceAll('nonce=""','nonce="${nonce}"'),'text/html','ticket-'+data.ticket.number+'.html')});
    </script></body></html>`
  return { html, csp: transcriptCsp(nonce) }
}
