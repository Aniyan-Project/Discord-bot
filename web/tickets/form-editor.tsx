import { useState } from 'react'
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import type { TicketQuestion } from '../../shared/tickets.js'
import { fieldTypes, isChoice, isMultiple } from '../../shared/ticket-forms.js'
import { useTickets } from './context.js'
import { Btn, Field, Input, Select, Toggle } from './primitives.js'
export function QuestionEditor({
  question: q,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  question: TicketQuestion
  index: number
  count: number
  onChange: (q: TicketQuestion) => void
  onRemove: () => void
  onMove: (offset: number) => void
}) {
  const { tr } = useTickets()
  const [optionsText, setOptionsText] = useState((q.options ?? []).join('\n'))
  const text = q.style === 'short' || q.style === 'long'
  return (
    <div className="question-block">
      <div className="question">
        <Input
          label={tr('Campo') + ' ' + (index + 1)}
          value={q.label}
          maxLength={45}
          onChange={(e) => onChange({ ...q, label: e.target.value })}
        />
        <div className="question-actions">
          <Btn
            quiet
            icon={ArrowUp}
            aria-label={tr('Mover para cima') + ' ' + (index + 1)}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          />
          <Btn
            quiet
            icon={ArrowDown}
            aria-label={tr('Mover para baixo') + ' ' + (index + 1)}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          />
          <Btn quiet danger icon={Trash2} aria-label={tr('Excluir') + ' ' + (index + 1)} onClick={onRemove} />
        </div>
      </div>
      <Select
        label="Tipo de campo"
        empty={false}
        value={q.style}
        options={Object.entries(fieldTypes).map(([id, name]) => ({ id, name: tr(name) }))}
        onChange={(style) => {
          const options = q.options?.length ? q.options : [tr('Opção 1'), tr('Opção 2')]
          setOptionsText(options.join('\n'))
          onChange({ ...q, style: style as TicketQuestion['style'], options, minChoices: 1, maxChoices: 1 })
        }}
      />
      <Input
        label="Texto de ajuda"
        value={q.description ?? ''}
        maxLength={100}
        onChange={(e) => onChange({ ...q, description: e.target.value })}
      />
      {(text || q.style === 'select' || q.style === 'multi') && (
        <Input
          label="Exemplo de preenchimento"
          value={q.placeholder ?? ''}
          maxLength={100}
          onChange={(e) => onChange({ ...q, placeholder: e.target.value })}
        />
      )}
      {text && (
        <div className="fields-two">
          <Input
            label="Mínimo de caracteres"
            type="number"
            min={0}
            max={q.maxLength}
            value={q.minLength ?? 0}
            onChange={(e) => onChange({ ...q, minLength: Number(e.target.value) })}
          />
          <Input
            label="Limite de caracteres"
            type="number"
            min={1}
            max={2000}
            value={q.maxLength}
            onChange={(e) => onChange({ ...q, maxLength: Number(e.target.value) })}
          />
        </div>
      )}
      {isChoice(q) && (
        <Field
          label={tr('Opções (uma por linha)')}
          hint={tr('Até 10 opções diferentes, com até 100 caracteres cada.')}
        >
          <textarea
            aria-label={tr('Opções (uma por linha)')}
            rows={4}
            maxLength={1100}
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value)
              onChange({
                ...q,
                options: e.target.value
                  .split('\n')
                  .map((v) => v.trim())
                  .filter(Boolean),
              })
            }}
          />
        </Field>
      )}
      {isMultiple(q) && (
        <div className="fields-two">
          {q.required && (
            <Input
              label="Mínimo de seleções"
              type="number"
              min={1}
              max={10}
              value={q.minChoices}
              onChange={(e) => onChange({ ...q, minChoices: Number(e.target.value) })}
            />
          )}
          <Input
            label="Máximo de seleções"
            type="number"
            min={1}
            max={10}
            value={q.maxChoices}
            onChange={(e) => onChange({ ...q, maxChoices: Number(e.target.value) })}
          />
        </div>
      )}
      <Toggle label="Obrigatória" value={q.required} onChange={(required) => onChange({ ...q, required })} />
    </div>
  )
}
