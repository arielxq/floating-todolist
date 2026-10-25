import { BookOpen, CalendarDays, House, PenLine, Briefcase, Heart, Star, Flag, Coffee, Music, Folder, Leaf, Check, GripVertical, Trash2, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const symbols = { calendar: CalendarDays, home: House, pen: PenLine, book: BookOpen, work: Briefcase, heart: Heart, star: Star, flag: Flag, coffee: Coffee, music: Music, folder: Folder, leaf: Leaf }
export type Group = { id: string; name: string; icon: keyof typeof symbols; builtin?: boolean }
export const defaultGroups: Group[] = [
  { id: 'Weekly', name: 'Weekly', icon: 'calendar', builtin: true },
  { id: 'Life', name: 'Life', icon: 'home', builtin: true },
  { id: 'Content', name: 'Content', icon: 'pen', builtin: true },
  { id: 'Study', name: 'Study', icon: 'book', builtin: true },
]
export type Translate = (zh: string, en: string) => string
export function groupName(group: Group, t: Translate) {
  const names: Record<string, string> = { Weekly: '每週', Life: '生活', Content: '內容', Study: '學習' }
  return group.builtin ? t(names[group.id] ?? group.name, group.name) : group.name
}
export function GroupIcon({ group }: { group?: Group }) {
  const Icon = symbols[group?.icon ?? 'folder'] ?? Folder
  return <Icon size={15} aria-hidden="true" />
}
export function GroupPicker({ groups, value, onChange, t, onOpenChange, label, iconFor, className = '' }: { groups: Group[]; value: string; onChange: (id: string) => void; t: Translate; onOpenChange?: (open: boolean) => void; label?: string; iconFor?: (group: Group) => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const selected = groups.find((group) => group.id === value) ?? groups[0]
  const changeOpen = (next: boolean) => {
    if (next && button.current) {
      const rect = button.current.getBoundingClientRect()
      const height = Math.min(groups.length * 34 + 8, 180)
      setPosition({ left: Math.max(4, Math.min(rect.left, window.innerWidth - 200)), top: rect.bottom + height + 6 > window.innerHeight ? Math.max(4, rect.top - height - 4) : rect.bottom + 4 })
    }
    setOpen(next); onOpenChange?.(next)
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) changeOpen(false) }
    const close = (event: Event) => { if (!menu.current?.contains(event.target as Node)) changeOpen(false) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); document.removeEventListener('scroll', close, true) }
  }, [open])
  useEffect(() => { if (open) menu.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus({ preventScroll: true }) }, [open])
  return <div className={`group-picker ${className}`} ref={ref} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) changeOpen(false) }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); changeOpen(false); button.current?.focus() }
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const items = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
  }}>
    <button ref={button} type="button" className="group-trigger" title={`${label ?? t('分組', 'Group')}: ${selected ? groupName(selected, t) : ''}`} aria-label={`${label ?? t('分組', 'Group')}: ${selected ? groupName(selected, t) : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => changeOpen(!open)}>{selected && (iconFor ? iconFor(selected) : <GroupIcon group={selected} />)}<span>{selected && groupName(selected, t)}</span></button>
    {open && createPortal(<div ref={menu} className="group-menu" style={{ position: 'fixed', left: position.left, top: position.top, width: 196 }} role="menu" aria-label={label ?? t('選擇分組', 'Choose group')}>{groups.map((group) => <button type="button" role="menuitemradio" aria-checked={group.id === value} key={group.id} onClick={() => { onChange(group.id); changeOpen(false); button.current?.focus() }}>{iconFor ? iconFor(group) : <GroupIcon group={group} />}<span>{groupName(group, t)}</span>{group.id === value && <Check size={13} />}</button>)}</div>, document.body)}
  </div>
}

function IconPicker({ value, onChange, t }: { value: Group['icon']; onChange: (icon: Group['icon']) => void; t: Translate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const names: Record<string, string> = { calendar: '日曆', home: '房屋', pen: '筆', book: '書本', work: '公事包', heart: '愛心', star: '星星', flag: '旗幟', coffee: '咖啡', music: '音樂', folder: '資料夾', leaf: '葉子' }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="icon-picker" ref={ref} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() } }}>
    <button ref={trigger} type="button" aria-label={t('選擇分組圖示', 'Choose group icon')} title={t('選擇分組圖示', 'Choose group icon')} aria-expanded={open} onClick={() => setOpen(!open)}><GroupIcon group={{ id: '', name: '', icon: value }} /></button>
    {open && <div className="icon-library" role="group" aria-label={t('圖示庫', 'Icon library')}>{(Object.keys(symbols) as Group['icon'][]).map((key) => { const Icon = symbols[key]; return <button type="button" key={key} aria-label={t(names[key], key)} title={t(names[key], key)} aria-pressed={value === key} onClick={() => { onChange(key); setOpen(false); trigger.current?.focus() }}><Icon size={19} /></button> })}</div>}
  </div>
}

export function GroupManager({ groups, onChange, onDelete, t }: { groups: Group[]; onChange: (groups: Group[]) => void; onDelete: (id: string, target: string) => void; t: Translate }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<Group['icon']>('folder')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const move = (from: number, to: number) => {
    if (to < 0 || to >= groups.length || from === to) return
    const next = [...groups]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next)
    setAnnouncement(`${groupName(item, t)}: ${to + 1} / ${groups.length}`)
  }
  const saveName = (id: string) => { if (editName.trim()) onChange(groups.map((group) => group.id === id ? { ...group, name: editName.trim(), builtin: false } : group)); setEditing(null) }
  return <details className="group-manager"><summary>{t('管理分組', 'Manage groups')}</summary>
    <span className="sr-only" role="status">{announcement}</span>
    {groups.map((group, index) => <div data-group-id={group.id} className={`group-config ${over === group.id && dragging !== group.id ? 'drop-target' : ''}`} key={group.id}>
      <button className="group-drag" aria-label={`${t('排序分組', 'Reorder group')}: ${groupName(group, t)}`} title={t('拖曳排序；方向鍵上下移動', 'Drag to reorder; use up/down arrow keys')} onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setDragging(group.id) }} onPointerMove={(event) => {
        if (!dragging) return
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-group-id]')
        setOver(target?.dataset.groupId ?? null)
      }} onPointerUp={(event) => {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-group-id]')?.dataset.groupId
        if (dragging && target) move(groups.findIndex((item) => item.id === dragging), groups.findIndex((item) => item.id === target))
        setDragging(null); setOver(null)
      }} onPointerCancel={() => { setDragging(null); setOver(null) }} onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); move(index, index + (event.key === 'ArrowUp' ? -1 : 1)) } }}><GripVertical size={16} /></button>
      <IconPicker value={group.icon} t={t} onChange={(icon) => onChange(groups.map((item) => item.id === group.id ? { ...item, icon } : item))} />
      {editing === group.id ? <input className="group-name-input" autoFocus aria-label={t('分組名稱', 'Group name')} value={editName} onChange={(event) => setEditName(event.target.value)} onBlur={() => saveName(group.id)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveName(group.id) } if (event.key === 'Escape') { event.preventDefault(); setEditing(null) } }} /> : <span className="group-name" tabIndex={0} title={t('雙擊或按 Enter 編輯名稱', 'Double-click or press Enter to rename')} onDoubleClick={() => { setEditing(group.id); setEditName(groupName(group, t)) }} onKeyDown={(event) => { if (event.key === 'Enter') { setEditing(group.id); setEditName(groupName(group, t)) } }}>{groupName(group, t)}</span>}
      <div className="group-config-actions"><button disabled={groups.length < 2} aria-label={t('刪除分組', 'Delete group')} onClick={() => { setDeleting(group.id); setTarget(groups.find((item) => item.id !== group.id)!.id) }}><Trash2 size={13} /></button></div>
    </div>)}
    {deleting && <div className="group-transfer"><span>{t('刪除分組並將任務移至：', 'Delete group and move its tasks to:')}</span><select aria-label={t('移入分組', 'Destination group')} value={target} onChange={(event) => setTarget(event.target.value)}>{groups.filter((group) => group.id !== deleting).map((group) => <option key={group.id} value={group.id}>{groupName(group, t)}</option>)}</select><button onClick={() => { onDelete(deleting, target); setDeleting(null) }}>{t('確認刪除', 'Confirm deletion')}</button><button onClick={() => setDeleting(null)}>{t('取消', 'Cancel')}</button></div>}
    <div className="group-add"><input aria-label={t('新分組名稱', 'New group name')} placeholder={t('新分組名稱', 'New group name')} value={name} onChange={(event) => setName(event.target.value)} /><IconPicker value={icon} onChange={setIcon} t={t} /><button disabled={!name.trim()} aria-label={t('新增分組', 'Add group')} onClick={() => { onChange([...groups, { id: crypto.randomUUID(), name: name.trim(), icon }]); setName('') }}><Plus size={15} /></button></div>
  </details>
}
