import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, X } from 'lucide-react'
import type { Translate } from './groups'

export function DueDate({ value, label, taskTitle, today, language, t, onChange, onInteraction }: { value?: string; label: string; taskTitle: string; today: string; language: 'zh' | 'en'; t: Translate; onChange: (value: string) => void; onInteraction: (active: boolean) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const clear = useRef<HTMLButtonElement>(null)
  const date = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const close = () => { setConfirming(false); onInteraction(false); clear.current?.focus() }
  useEffect(() => {
    if (!confirming) return
    cancel.current?.focus()
    const outside = (event: PointerEvent) => { if (!dialog.current?.contains(event.target as Node) && !clear.current?.contains(event.target as Node)) close() }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [confirming])
  return <span className="due-date-control">
    <label className="date-editor" title={t('選擇截止日期', 'Choose due date')}><CalendarDays size={11} /><span>{label}</span><input ref={date} type="date" min={today} lang={language === 'zh' ? 'zh-TW' : 'en-US'} aria-label={`${t('截止日期', 'Due date')}: ${taskTitle}`} value={value ?? ''} onFocus={() => onInteraction(true)} onBlur={() => onInteraction(false)} onClick={(event) => { try { event.currentTarget.showPicker?.() } catch { /* Native date control remains available. */ } }} onChange={(event) => onChange(event.target.value)} /></label>
    {value && <button ref={clear} type="button" className={`clear-date ${confirming ? 'is-confirming' : ''}`} aria-label={`${t('清除截止日期', 'Clear due date')}: ${taskTitle}`} title={t('清除截止日期', 'Clear due date')} onClick={() => {
      const rect = clear.current!.getBoundingClientRect()
      setPosition({ left: Math.max(4, Math.min(rect.left - 80, window.innerWidth - 224)), top: rect.bottom + 88 > window.innerHeight ? Math.max(4, rect.top - 88) : rect.bottom + 5 })
      setConfirming(true); onInteraction(true)
    }}><X size={11} /></button>}
    {confirming && createPortal(<div className="date-confirm" style={position} ref={dialog} role="dialog" aria-modal="true" aria-label={t('清除截止日期？', 'Clear due date?')} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key === 'Tab') {
        const buttons = Array.from(dialog.current!.querySelectorAll('button'))
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }
    }}><strong>{t('清除截止日期？', 'Clear due date?')}</strong><div><button ref={cancel} type="button" onClick={close}>{t('取消', 'Cancel')}</button><button type="button" onClick={() => { onChange(''); setConfirming(false); onInteraction(false); date.current?.focus() }}>{t('清除', 'Clear')}</button></div></div>, document.body)}
  </span>
}
