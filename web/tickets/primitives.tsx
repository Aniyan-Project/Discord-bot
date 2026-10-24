import {
  useId,
  useRef,
  useEffect,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ComponentType,
} from 'react'
import { X } from 'lucide-react'
import { useTickets } from './context.js'
export function Btn({
  children,
  icon: Icon,
  primary = false,
  quiet = false,
  danger = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ComponentType<{ size?: number }>
  primary?: boolean
  quiet?: boolean
  danger?: boolean
}) {
  const { busy } = useTickets()
  return (
    <button
      type="button"
      className={`btn ${primary ? 'primary' : ''} ${quiet ? 'quiet' : ''} ${danger ? 'danger' : ''}`}
      {...props}
      disabled={busy || props.disabled}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <div className="field-control">{children}</div>
      {hint && <small>{hint}</small>}
    </div>
  )
}
export function Input({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { tr } = useTickets()
  return (
    <Field label={tr(label)} hint={hint ? tr(hint) : undefined}>
      <input aria-label={tr(label)} {...props} />
    </Field>
  )
}
export function Select({
  label,
  value,
  onChange,
  options,
  empty = true,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  options: Array<{ id: string; name: string }>
  empty?: boolean
}) {
  const { tr } = useTickets()
  return (
    <Field label={tr(label)}>
      <select aria-label={tr(label)} value={value} onChange={(e) => onChange(e.target.value)}>
        {empty && <option value="">{tr('Selecione')}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  )
}
export function Roles({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const { data, tr, busy } = useTickets()
  const [search, setSearch] = useState('')
  const visible = data.resources.roles.filter((r) =>
    r.name.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()),
  )
  return (
    <fieldset className="role-picker" disabled={busy}>
      <legend>{tr(label)}</legend>
      <input
        type="search"
        aria-label={tr('Buscar cargos')}
        placeholder={tr('Buscar cargos')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="role-options">
        {visible.map((r) => (
          <label key={r.id}>
            <input
              type="checkbox"
              checked={value.includes(r.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, r.id] : value.filter((id) => id !== r.id))
              }
            />
            <span>{r.name}</span>
          </label>
        ))}
        {!visible.length && <p>{tr('Nenhum cargo encontrado.')}</p>}
      </div>
      <small>
        {tr('Selecionados')}: {value.length}
      </small>
    </fieldset>
  )
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  const { tr } = useTickets()
  return (
    <div className="toggle-row">
      <strong>{tr(label)}</strong>
      <button
        type="button"
        className={`switch ${value ? 'on' : ''}`}
        role="switch"
        aria-checked={value}
        aria-label={tr(label)}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId(),
    { error } = useTickets()
  useEffect(() => {
    const d = ref.current!
    d.showModal()
    const cancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    d.addEventListener('cancel', cancel)
    return () => {
      d.removeEventListener('cancel', cancel)
      d.close()
    }
  }, [])
  return (
    <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={id}>
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <Btn quiet icon={X} aria-label="Close" onClick={onClose} />
      </div>
      <div className="modal-body">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  )
}
export function download(value: unknown, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 500)
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { tr } = useTickets()
  return (
    <section className="settings-section">
      <h2>{tr(title)}</h2>
      <div className="section-content">{children}</div>
    </section>
  )
}
