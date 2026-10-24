import { useId, useRef, useEffect } from 'react'
import type { TicketQuestion } from '../../shared/tickets.js'
import { validAnswer, selectedAnswers, isMultiple } from '../../shared/ticket-forms.js'
import { useTickets } from './context.js'
export function TicketFormField({
  question: q,
  value,
  onChange,
}: {
  question: TicketQuestion
  value: string
  onChange: (value: string) => void
}) {
  const { tr } = useTickets(),
    id = useId(),
    ref = useRef<HTMLFieldSetElement>(null)
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
      ?.setCustomValidity(validAnswer(q, value) ? '' : tr('Revise a resposta e os limites deste campo.'))
  }, [q, value, tr])
  const props = { name: q.id, 'aria-label': q.label, 'aria-describedby': q.description ? id : undefined }
  const selected = selectedAnswers(value)
  const choices = q.options ?? []
  return (
    <fieldset className="ticket-answer field" ref={ref}>
      <legend>
        {q.label} <small>{tr(q.required ? 'Obrigatória' : 'Opcional')}</small>
      </legend>
      {q.description && (
        <p id={id} className="answer-hint">
          {q.description}
        </p>
      )}
      {(q.style === 'short' || q.style === 'long') &&
        (q.style === 'short' ? (
          <input
            {...props}
            type="text"
            value={value}
            required={q.required}
            minLength={q.minLength ?? 0}
            maxLength={q.maxLength}
            placeholder={q.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <textarea
            {...props}
            rows={3}
            value={value}
            required={q.required}
            minLength={q.minLength ?? 0}
            maxLength={q.maxLength}
            placeholder={q.placeholder ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        ))}
      {(q.style === 'select' || q.style === 'multi') && (
        <>
          <select
            {...props}
            multiple={q.style === 'multi'}
            required={q.required}
            size={q.style === 'multi' ? Math.min(5, choices.length + 1) : undefined}
            value={q.style === 'multi' ? selected : value}
            onChange={(e) =>
              onChange(
                q.style === 'multi'
                  ? JSON.stringify([...e.target.selectedOptions].map((o) => o.value))
                  : e.target.value,
              )
            }
          >
            {q.style === 'select' && <option value="">{q.placeholder || tr('Selecione')}</option>}
            {choices.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {q.style === 'multi' && <small>{tr('Use Ctrl ou Cmd para selecionar várias opções.')}</small>}
        </>
      )}
      {(q.style === 'radio' || q.style === 'checkboxes') && (
        <div className="ticket-choice-options">
          {choices.map((option) => (
            <label key={option}>
              <input
                type={q.style === 'radio' ? 'radio' : 'checkbox'}
                name={q.id}
                required={q.style === 'radio' && q.required}
                aria-describedby={q.description ? id : undefined}
                checked={q.style === 'radio' ? value === option : selected.includes(option)}
                onChange={(e) =>
                  onChange(
                    q.style === 'radio'
                      ? option
                      : JSON.stringify(
                          e.target.checked ? [...selected, option] : selected.filter((v) => v !== option),
                        ),
                  )
                }
              />
              <span>{option}</span>
            </label>
          ))}
          {q.style === 'radio' && !q.required && value && (
            <button type="button" className="preview-test" onClick={() => onChange('')}>
              {tr('Limpar seleção')}
            </button>
          )}
        </div>
      )}
      {q.style === 'checkbox' && (
        <label className="ticket-confirmation">
          <input
            {...props}
            type="checkbox"
            required={q.required}
            checked={value === 'true'}
            onChange={(e) => onChange(String(e.target.checked))}
          />
          <span>{tr('Confirmar')}</span>
        </label>
      )}
      {isMultiple(q) && (
        <small>
          {tr('Limites de seleção')}: {q.required ? q.minChoices : 0}–{q.maxChoices}
        </small>
      )}
    </fieldset>
  )
}
