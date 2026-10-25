import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Ban, CheckCircle2, Clock, Layers, Check, Circle, GripVertical, ListTodo, LockKeyhole, Trash2, Pin, Plus, Settings2, Sparkles, X } from 'lucide-react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window'
import { clamp, dockPoint, nearestEdge, type Dock } from './position'
import { defaultGroups, GroupIcon, GroupManager, GroupPicker, type Group } from './groups'
import { DueDate } from './DueDate'

type Status = 'todo' | 'pending' | 'completed' | 'cancelled'
type Sort = 'manual' | 'due-asc' | 'due-desc'
type Task = { id: string; title: string; status: Status; createdAt: string; dueDate?: string; group?: string }
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
function validDueDate(value: string) {
  if (!value) return true
  const parsed = new Date(`${value}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value && value >= dateKey(new Date())
}
function dueDateLabel(value: string | undefined, language: 'zh' | 'en') {
  if (!value) return language === 'zh' ? '無截止日' : 'no due day'
  const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (value === dateKey(today)) return language === 'zh' ? '今天' : 'Today'
  if (value === dateKey(tomorrow)) return language === 'zh' ? '明天' : 'Tomorrow'
  const date = new Date(`${value}T12:00:00`)
  return date.toLocaleDateString(language === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } as const : {}) })
}
function migrateTasks(items: Task[]): Task[] {
  return items.map((task) => {
    let dueDate = task.dueDate
    if (dueDate === 'Today' || dueDate === 'Tomorrow') {
      const date = new Date(task.createdAt); if (dueDate === 'Tomorrow') date.setDate(date.getDate() + 1)
      dueDate = dateKey(date)
    } else if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      const date = new Date(`${dueDate}, ${new Date(task.createdAt).getFullYear()}`)
      dueDate = Number.isNaN(date.getTime()) ? undefined : dateKey(date)
    }
    return { ...task, group: task.group || 'Weekly', dueDate }
  })
}
function urgency(task: Task) {
  if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') return ''
  const today = new Date(); const nextWeek = new Date(); nextWeek.setDate(today.getDate() + 7)
  return task.dueDate < dateKey(today) ? 'overdue' : task.dueDate === dateKey(today) ? 'today' : task.dueDate <= dateKey(nextWeek) ? 'soon' : ''
}
type Settings = { pinned: boolean; autoCollapse: boolean; alwaysOnTop: boolean; opacity: number; blur: number; opacityCustomized?: boolean }

const statuses: { id: Status; label: string; color: string }[] = [
  { id: 'todo', label: 'To-do', color: '#376b58' }, { id: 'pending', label: 'Pending', color: '#bd7c35' },
  { id: 'completed', label: 'Completed', color: '#577d9a' }, { id: 'cancelled', label: 'Cancelled', color: '#8d7771' },
]
const initialTasks: Task[] = [
  { id: 'a1', title: 'Review Q3 investment analysis', status: 'todo', createdAt: '2026-10-25T09:00:00' },
  { id: 'a2', title: 'Finish product usability test', status: 'todo', createdAt: '2026-10-25T09:20:00', dueDate: 'Today' },
  { id: 'a3', title: 'Send portfolio draft to Maya', status: 'todo', createdAt: '2026-10-25T10:00:00', dueDate: 'Tomorrow' },
  { id: 'a4', title: 'Update project README', status: 'todo', createdAt: '2026-10-25T10:10:00' },
  { id: 'a5', title: 'Confirm venue availability', status: 'pending', createdAt: '2026-10-24T10:00:00', dueDate: 'Oct 28' },
  { id: 'a6', title: 'Get feedback on the new flow', status: 'pending', createdAt: '2026-10-23T10:00:00' },
  { id: 'a7', title: 'Prepare weekly team update', status: 'completed', createdAt: '2026-10-22T10:00:00' },
  { id: 'a8', title: 'Explore alternate icon set', status: 'cancelled', createdAt: '2026-10-21T10:00:00' },
]
const defaultSettings: Settings = { pinned: false, autoCollapse: true, alwaysOnTop: true, opacity: 38, blur: 18 }
const load = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}

export default function App() {
  const [language, setLanguage] = useState<'zh' | 'en'>(() => load('floating-todo.language.v1', navigator.language.startsWith('zh') ? 'zh' : 'en'))
  const t = (zh: string, en: string) => language === 'zh' ? zh : en
  const statusName = (status: Status) => ({ todo: t('待辦', 'To-do'), pending: t('暫緩', 'Pending'), completed: t('已完成', 'Completed'), cancelled: t('已取消', 'Cancelled') })[status]
  const statusOptions: Group[] = statuses.map((status) => ({ id: status.id, name: statusName(status.id), icon: 'folder' }))
  const statusIcon = (option: Group) => {
    const Icon = option.id === 'pending' ? Clock : option.id === 'completed' ? CheckCircle2 : option.id === 'cancelled' ? Ban : Circle
    return <Icon size={12} aria-hidden="true" />
  }
  const [groups, setGroups] = useState<Group[]>(() => load('floating-todo.groups.v1', defaultGroups))
  const [tasks, setTasks] = useState<Task[]>(() => migrateTasks(load('floating-todo.tasks.v1', initialTasks)))
  const [groupFilter, setGroupFilter] = useState('all')
  const [newGroup, setNewGroup] = useState(() => groups[0].id)
  const [composerFocused, setComposerFocused] = useState(false)
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [sort, setSort] = useState<Sort>(() => { const saved = load<string>('floating-todo.sort.v1', 'manual'); return saved === 'due-asc' || saved === 'due-desc' ? saved : 'manual' })
  const [previewBackground, setPreviewBackground] = useState('pattern')
  const [bubble, setBubble] = useState<Dock>(() => {
    const saved = load<Dock>('floating-todo.bubble.v1', { side: 'right', x: 0.5, y: 0.45 })
    return { ...saved, x: saved.x ?? 0.5 }
  })
  const [bubbleDrag, setBubbleDrag] = useState<{ x: number; y: number } | null>(null)
  const bubbleGesture = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = load('floating-todo.settings.v1', defaultSettings)
    return { ...saved, opacity: !saved.opacityCustomized && [55, 91].includes(saved.opacity) ? 38 : saved.opacity }
  })
  const [active, setActive] = useState<Status>('todo')
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [undo, setUndo] = useState<{ id: string; status: Status } | null>(null)
  const [saveState, setSaveState] = useState<'loading' | 'saving' | 'saved' | 'error'>(isTauri() ? 'loading' : 'saved')
  const [today, setToday] = useState(() => dateKey(new Date()))
  const [datePicking, setDatePicking] = useState(false)
  const [windowPosition] = useState(() => load('floating-todo.window-position.v1', { x: 0, y: 0 }))
  const [nativeReady, setNativeReady] = useState(!isTauri())
  const [taskFolder, setTaskFolder] = useState(() => load('floating-todo.folder.v1', ''))
  const revisionRef = useRef(0)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveFailed = useRef(false)
  const nativeTransition = useRef(false)
  const collapsedRef = useRef(false)
  const nativeDocked = useRef(false)
  const nativeGesture = useRef<{ x: number; y: number; originX: number; originY: number; scale: number } | null>(null)
  const nativeGestureVersion = useRef(0)
  const moveQueue = useRef<Promise<void>>(Promise.resolve())
  const panelSize = useRef(load('floating-todo.window-size.v1', { width: 390, height: 600 }))
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  const inputRef = useRef<HTMLInputElement>(null)
  const list = useMemo(() => {
    const filtered = tasks.filter((task) => task.status === active && (groupFilter === 'all' || task.group === groupFilter))
    if (sort === 'due-asc' || sort === 'due-desc') filtered.sort((a, b) => {
      if (!a.dueDate) return b.dueDate ? 1 : 0
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate) * (sort === 'due-asc' ? 1 : -1)
    })
    return filtered
  }, [tasks, active, groupFilter, sort])
  const remaining = tasks.filter((task) => task.status === 'todo' || task.status === 'pending').length
  useEffect(() => { localStorage.setItem('floating-todo.language.v1', JSON.stringify(language)); document.documentElement.lang = language === 'zh' ? 'zh-Hant' : 'en'; setToast('') }, [language])
  useEffect(() => { localStorage.setItem('floating-todo.groups.v1', JSON.stringify(groups)) }, [groups])
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(() => setUndo(null), 6000)
    return () => window.clearTimeout(timer)
  }, [undo])
  useEffect(() => {
    const refresh = () => setToday(dateKey(new Date()))
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    async function initialize() {
      try {
        let folder = taskFolder
        if (!folder) folder = await invoke<string | null>('select_task_folder') ?? ''
        if (!folder) { if (!cancelled) setToast(t('請選擇任務資料夾以開始使用。', 'Choose a task folder to start.')); return }
        const data = await invoke<{ revision: number; tasks: Task[]; groups?: Group[] }>('read_tasks', { folder })
        if (cancelled) return
        setTaskFolder(folder); localStorage.setItem('floating-todo.folder.v1', folder)
        revisionRef.current = data.revision; setTasks(migrateTasks(data.tasks))
        setGroups(data.groups?.length ? data.groups : defaultGroups)
        setNewGroup(data.groups?.[0]?.id ?? defaultGroups[0].id)
        setNativeReady(true)
      } catch (error) { if (!cancelled) { setSaveState('error'); setToast(String(error)) } }
    }
    void initialize()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!isTauri()) {
      try { localStorage.setItem('floating-todo.tasks.v1', JSON.stringify(tasks)); setSaveState('saved') }
      catch { setSaveState('error'); setToast(t('瀏覽器儲存失敗，請保留此頁面並檢查儲存空間。', 'Browser save failed. Keep this page open and check available storage.')) }
      return
    }
    if (!nativeReady || !taskFolder) return
    let cancelled = false
    setSaveState('saving')
    const timer = window.setTimeout(async () => {
      saveQueue.current = saveQueue.current.then(async () => {
        if (saveFailed.current) { setSaveState('error'); return }
        try {
          revisionRef.current = await invoke<number>('write_tasks', { folder: taskFolder, tasks, groups, revision: revisionRef.current })
          if (!cancelled) setSaveState('saved')
        } catch (error) {
          saveFailed.current = true; setSaveState('error'); setToast(t(`儲存失敗：${String(error)}。請保留視窗，檢查資料夾後重試。`, `Save failed: ${String(error)}. Keep this window open, check the folder and retry.`))
        }
      })
    }, 160)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [tasks, groups, nativeReady, taskFolder])
  useEffect(() => { localStorage.setItem('floating-todo.settings.v1', JSON.stringify(settings)) }, [settings])
  useEffect(() => { localStorage.setItem('floating-todo.bubble.v1', JSON.stringify(bubble)) }, [bubble])
  useEffect(() => { localStorage.setItem('floating-todo.sort.v1', JSON.stringify(sort)) }, [sort])
  useEffect(() => {
    let timer: number | undefined
    const onBlur = () => {
      const element = document.activeElement
      if (element?.matches('input, select, textarea') || settings.pinned || !settings.autoCollapse || dragId || editing || draft || settingsOpen || datePicking || groupMenuOpen) return
      timer = window.setTimeout(() => { if (!document.hasFocus()) void collapse() }, 450)
    }
    const onFocus = () => window.clearTimeout(timer)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => { window.clearTimeout(timer); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus) }
  }, [settings.autoCollapse, settings.pinned, dragId, editing, draft, settingsOpen, datePicking, groupMenuOpen])
  useEffect(() => {
    if (!isTauri()) return
    const nativeWindow = getCurrentWindow()
    let unlistenResize: (() => void) | undefined
    let unlistenMove: (() => void) | undefined
    void (async () => {
      try {
        await nativeWindow.setAlwaysOnTop(settings.alwaysOnTop)
        await nativeWindow.setSize(new PhysicalSize(panelSize.current.width, panelSize.current.height))
        if (windowPosition.x || windowPosition.y) await nativeWindow.setPosition(new PhysicalPosition(windowPosition.x, windowPosition.y))
        unlistenMove = await nativeWindow.onMoved(({ payload }) => {
          if (collapsedRef.current || nativeTransition.current) return
          const next = { x: payload.x, y: payload.y }
          localStorage.setItem('floating-todo.window-position.v1', JSON.stringify(next))
        })
        unlistenResize = await nativeWindow.onResized(({ payload }) => {
          if (collapsedRef.current || nativeTransition.current) return
          panelSize.current = { width: payload.width, height: payload.height }
          localStorage.setItem('floating-todo.window-size.v1', JSON.stringify({ width: payload.width, height: payload.height }))
        })
      } catch { /* Browser preview does not expose native window controls. */ }
    })()
    return () => { unlistenMove?.(); unlistenResize?.() }
  }, [])
  useEffect(() => {
    if (isTauri()) void getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop).catch(() => undefined)
  }, [settings.alwaysOnTop])

  function addTask(event: FormEvent) {
    event.preventDefault(); const title = draft.trim(); if (!title) return
    if (!validDueDate(newDate)) { setToast(t('截止日期不能早於今天，請重新選擇。', 'Choose today or a future due date.')); return }
    const status = active === 'pending' ? 'pending' : 'todo'
    setTasks((items) => [...items, { id: crypto.randomUUID(), title, status, group: newGroup, dueDate: newDate || undefined, createdAt: new Date().toISOString() }])
    if (active !== status) { setActive(status); setToast(t('任務已新增至待辦。', 'Task added to To-do.')) }
    if (groupFilter !== 'all' && groupFilter !== newGroup) setGroupFilter(newGroup)
    setDraft(''); setNewDate(''); inputRef.current?.focus()
  }
  function updateDueDate(id: string, value: string) {
    if (!validDueDate(value)) { setToast(t('截止日期不能早於今天，請重新選擇。', 'Choose today or a future due date.')); return }
    setTasks((items) => items.map((task) => task.id === id ? { ...task, dueDate: value || undefined } : task))
  }
  function updateStatus(id: string, status: Status) {
    const task = tasks.find((item) => item.id === id)
    if (task && task.status !== status && status === 'completed') setUndo({ id, status: task.status })
    setTasks((items) => items.map((task) => task.id === id ? { ...task, status } : task))
  }
  function deleteGroup(id: string, target: string) {
    setTasks((items) => items.map((task) => task.group === id ? { ...task, group: target } : task))
    setGroups((items) => items.filter((group) => group.id !== id))
    if (newGroup === id) setNewGroup(target)
    if (groupFilter === id) setGroupFilter(target)
  }
  function saveEdit(id: string) {
    const title = editDraft.trim()
    if (title) setTasks((items) => items.map((task) => task.id === id ? { ...task, title } : task))
    setEditing(null)
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId || sort !== 'manual') return
    setTasks((items) => {
      const visible = (task: Task) => task.status === active && (groupFilter === 'all' || task.group === groupFilter)
      const lane = items.filter(visible)
      const from = lane.findIndex((task) => task.id === dragId); const to = lane.findIndex((task) => task.id === targetId)
      if (from < 0 || to < 0) return items
      const [moved] = lane.splice(from, 1); lane.splice(to, 0, moved)
      const iterator = lane[Symbol.iterator]()
      return items.map((task) => visible(task) ? iterator.next().value! : task)
    })
    setDragId(null); setDragOverId(null)
  }
  async function snapNative(force: boolean) {
    const win = getCurrentWindow(); const monitor = await currentMonitor(); if (!monitor) return
    const area = monitor.workArea; const pos = await win.outerPosition(); const size = await win.outerSize()
    const x = pos.x - area.position.x; const y = pos.y - area.position.y
    const distances = { left: Math.abs(x), right: Math.abs(area.size.width - x - size.width), top: Math.abs(y), bottom: Math.abs(area.size.height - y - size.height) }
    const closest = (Object.keys(distances) as Dock['side'][]).reduce((a, b) => distances[a] <= distances[b] ? a : b)
    const side = distances[bubble.side] <= distances[closest] + 10 * monitor.scaleFactor ? bubble.side : closest
    const distance = { left: x, right: area.size.width - x - size.width, top: y, bottom: area.size.height - y - size.height }[side]
    if (!force && distance > 24 * monitor.scaleFactor) { nativeDocked.current = false; return }
    const dock = { side, x: clamp(x / area.size.width, 0, 1), y: clamp(y / area.size.height, 0, 1) }
    setBubble(dock); nativeDocked.current = true
    await win.setPosition(new PhysicalPosition(
      area.position.x + (side === 'left' ? 0 : side === 'right' ? area.size.width - size.width : clamp(x, 0, area.size.width - size.width)),
      area.position.y + (side === 'top' ? 0 : side === 'bottom' ? area.size.height - size.height : clamp(y, 0, area.size.height - size.height)),
    ))
  }
  async function collapse() {
    if (nativeTransition.current) return
    setSettingsOpen(false)
    if (isTauri()) {
      nativeTransition.current = true
      try {
        const win = getCurrentWindow(); const pos = await win.outerPosition(); const monitor = await currentMonitor()
        if (!monitor) throw new Error(t('找不到目前螢幕', 'Current monitor unavailable'))
        panelSize.current = await win.outerSize()
        const area = monitor.workArea
        const dock = { ...bubble, x: (pos.x - area.position.x) / area.size.width, y: (pos.y - area.position.y) / area.size.height }
        if (!nativeDocked.current) dock.side = nearestEdge(pos.x - area.position.x + panelSize.current.width / 2, pos.y - area.position.y + panelSize.current.height / 2, area.size.width, area.size.height, bubble.side)
        setBubble(dock)
        await win.setMinSize(new LogicalSize(56, 56)); await win.setResizable(false)
        collapsedRef.current = true; setCollapsed(true)
        await win.setSize(new LogicalSize(56, 56))
        const point = dockPoint(dock, area.size.width, area.size.height, 56 * monitor.scaleFactor)
        await win.setPosition(new PhysicalPosition(area.position.x + point.x, area.position.y + point.y))
      } catch (error) {
        collapsedRef.current = false; setCollapsed(false); setToast(String(error))
        const win = getCurrentWindow()
        await win.setSize(new PhysicalSize(panelSize.current.width, panelSize.current.height)).catch(() => undefined)
        await win.setMinSize(new LogicalSize(320, 450)).catch(() => undefined)
        await win.setResizable(true).catch(() => undefined)
      }
      finally { nativeTransition.current = false }
    } else { setCollapsed(true); collapsedRef.current = true; nativeDocked.current = true }
  }
  async function expand() {
    if (nativeTransition.current) return
    if (isTauri()) {
      nativeTransition.current = true
      try {
        const win = getCurrentWindow(); const monitor = await currentMonitor(); if (!monitor) throw new Error(t('找不到目前螢幕', 'Current monitor unavailable'))
        const pos = await win.outerPosition(); const area = monitor.workArea
        const width = Math.min(panelSize.current.width, area.size.width); const height = Math.min(panelSize.current.height, area.size.height)
        await win.setSize(new PhysicalSize(width, height))
        await win.setPosition(new PhysicalPosition(
          clamp(bubble.side === 'right' ? pos.x + 56 * monitor.scaleFactor - width : pos.x, area.position.x, area.position.x + area.size.width - width),
          clamp(bubble.side === 'bottom' ? pos.y + 56 * monitor.scaleFactor - height : pos.y, area.position.y, area.position.y + area.size.height - height),
        ))
        await win.setMinSize(new LogicalSize(320, 450)); await win.setResizable(true)
        nativeDocked.current = true
      } catch (error) { setToast(String(error)); return }
      finally { nativeTransition.current = false }
    }
    collapsedRef.current = false; setCollapsed(false)
  }
  async function beginNativeGesture(event: React.PointerEvent<HTMLElement>) {
    if (!isTauri()) return
    const version = ++nativeGestureVersion.current
    const x = event.screenX; const y = event.screenY
    try {
      const win = getCurrentWindow(); const pos = await win.outerPosition(); const scale = await win.scaleFactor()
      if (version === nativeGestureVersion.current) nativeGesture.current = { x, y, originX: pos.x, originY: pos.y, scale }
    } catch (error) { setToast(String(error)) }
  }
  function moveNativeGesture(event: React.PointerEvent<HTMLElement>) {
    const gesture = nativeGesture.current; if (!gesture) return
    const x = Math.round(gesture.originX + (event.screenX - gesture.x) * gesture.scale)
    const y = Math.round(gesture.originY + (event.screenY - gesture.y) * gesture.scale)
    moveQueue.current = moveQueue.current.then(() => getCurrentWindow().setPosition(new PhysicalPosition(x, y))).catch((error) => setToast(String(error)))
  }
  async function endNativeGesture(force: boolean) {
    nativeGestureVersion.current++
    nativeGesture.current = null
    await moveQueue.current
    try { await snapNative(force) } catch (error) { setToast(String(error)) }
  }
  const bubblePoint = dockPoint(bubble, viewport.width, viewport.height)

  if (collapsed) return <main className={`bubble-wrap ${bubble.side}`} style={{ top: isTauri() ? 3 : bubbleDrag ? bubbleDrag.y - 24 : bubblePoint.y + 3, left: isTauri() ? 3 : bubbleDrag ? bubbleDrag.x - 24 : bubblePoint.x + 3, right: 'auto' }}>
    <button className="bubble" title={t('點擊展開 · 拖曳移動', 'Click to open · drag to move')} aria-label={t('開啟或拖曳 Floating Todo', 'Open or drag Floating Todo')} onClick={(event) => { if (event.detail === 0) void expand() }} onPointerDown={(event) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      bubbleGesture.current = { x: event.screenX, y: event.screenY, moved: false }
      void beginNativeGesture(event)
    }} onPointerMove={(event) => {
      const gesture = bubbleGesture.current; if (!gesture) return
      if (Math.hypot(event.screenX - gesture.x, event.screenY - gesture.y) > 6) gesture.moved = true
      if (isTauri()) { if (gesture.moved) moveNativeGesture(event); return }
      if (gesture.moved) setBubbleDrag({ x: Math.max(26, Math.min(window.innerWidth - 26, event.clientX)), y: Math.max(26, Math.min(window.innerHeight - 26, event.clientY)) })
    }} onPointerUp={(event) => {
      const gesture = bubbleGesture.current; bubbleGesture.current = null
      if (!gesture) return
      if (gesture.moved) {
        if (isTauri()) { void endNativeGesture(true); return }
        const side = nearestEdge(event.clientX, event.clientY, window.innerWidth, window.innerHeight, bubble.side)
        const y = Math.max(4, Math.min(window.innerHeight - 54, event.clientY - 24)) / window.innerHeight
        setBubble({ side, y, x: clamp(event.clientX - 24, 0, window.innerWidth - 56) / window.innerWidth })
      }
      else { nativeGestureVersion.current++; nativeGesture.current = null; void expand() }
      setBubbleDrag(null)
    }} onPointerCancel={() => { bubbleGesture.current = null; setBubbleDrag(null); if (isTauri()) void endNativeGesture(true) }}><ListTodo size={20} strokeWidth={1.8} /><span className="bubble-count">{remaining}</span></button>
  </main>

  return <main className={`desktop ${isTauri() ? 'native-desktop' : `preview-${previewBackground}`}`}>
    {!isTauri() && <div className="preview-controls"><span>{t('透明背景預覽', 'Glass preview')}</span><select aria-label={t('預覽背景', 'Preview background')} value={previewBackground} onChange={(event) => setPreviewBackground(event.target.value)}><option value="pattern">{t('圖案背景', 'Pattern')}</option><option value="light">{t('明亮背景', 'Light')}</option><option value="dark">{t('深色背景', 'Dark')}</option></select></div>}
    <section className="widget" style={{ '--glass-alpha': settings.opacity / 100, '--glass-blur': `${settings.blur}px`, ...(!isTauri() && nativeDocked.current ? {
      position: 'fixed',
      left: clamp(bubble.side === 'right' ? viewport.width - Math.min(376, viewport.width - 28) - 4 : bubblePoint.x, 4, viewport.width - Math.min(376, viewport.width - 28) - 4),
      top: clamp(bubble.side === 'bottom' ? viewport.height - Math.min(570, viewport.height - 32) - 4 : bubblePoint.y, 4, viewport.height - Math.min(570, viewport.height - 32) - 4),
      width: Math.min(376, viewport.width - 28), height: Math.min(570, viewport.height - 32), minHeight: 0,
    } : {}) } as React.CSSProperties}>
      <header className="topbar" onPointerDown={(event) => {
        if (!isTauri() || (event.target as HTMLElement).closest('button') || event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId); void beginNativeGesture(event)
      }} onPointerMove={moveNativeGesture} onPointerUp={() => { if (nativeGesture.current) void endNativeGesture(false); else nativeGestureVersion.current++ }} onPointerCancel={() => { if (nativeGesture.current) void endNativeGesture(false); else nativeGestureVersion.current++ }}>
        <div className="brand-mark"><ListTodo size={17} /></div><div className="brand-title"><strong>Floating Todo</strong><span>LOCAL WORKSPACE</span></div><span className="spacer" />
        <button className={`icon-button ${settings.pinned ? 'active-icon' : ''}`} aria-label={settings.pinned ? t('取消釘選', 'Unpin expanded window') : t('保持展開', 'Keep expanded')} title={settings.pinned ? t('取消釘選', 'Unpin expanded window') : t('保持展開', 'Keep expanded')} onClick={() => setSettings((s) => ({ ...s, pinned: !s.pinned }))}><Pin size={15} /></button>
        <button className="icon-button" aria-label={t('設定', 'Settings')} title={t('設定', 'Settings')} onClick={() => setSettingsOpen((open) => !open)}><Settings2 size={16} /></button>
        <button className="icon-button collapse-button" aria-label={t('收合', 'Collapse')} title={t('收合', 'Collapse')} onClick={collapse}><span>−</span></button>
      </header>
      <nav className="tabs" aria-label={t('任務狀態', 'Task status')}>
        {statuses.map((status) => {
          const count = tasks.filter((task) => task.status === status.id).length
          return <button key={status.id} aria-pressed={active === status.id} className={`tab ${active === status.id ? 'selected' : ''}`} onClick={() => setActive(status.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragId) updateStatus(dragId, status.id); setDragId(null); setDragOverId(null) }} style={{ '--status-color': status.color } as React.CSSProperties}><span>{statusName(status.id)}</span><span className="tab-count">{count}</span></button>
        })}
      </nav>
      <div className="filter-toolbar">
        <GroupPicker className="group-filter-picker" groups={[{ id: 'all', name: t('全部分組', 'All groups'), icon: 'folder' }, ...groups]} value={groupFilter} label={t('分組篩選', 'Group filters')} t={t} iconFor={(group) => group.id === 'all' ? <Layers size={15} aria-hidden="true" /> : <GroupIcon group={group} />} onOpenChange={setGroupMenuOpen} onChange={(id) => { setGroupFilter(id); if (id !== 'all') setNewGroup(id) }} />
        <button className="sort-cycle" aria-label={`${t('排序', 'Sort')}: ${sort === 'manual' ? t('手動；點擊切換最近截止優先', 'Manual; click for earliest due first') : sort === 'due-asc' ? t('最近截止優先；點擊切換最晚優先', 'Earliest due first; click for latest due first') : t('最晚截止優先；點擊恢復手動', 'Latest due first; click for manual order')}`} title={sort === 'manual' ? t('手動排序 → 最近截止優先', 'Manual → earliest due first') : sort === 'due-asc' ? t('最近截止優先 → 最晚截止優先', 'Earliest → latest due first') : t('最晚截止優先 → 手動排序', 'Latest due first → manual')} onClick={() => setSort(sort === 'manual' ? 'due-asc' : sort === 'due-asc' ? 'due-desc' : 'manual')}>{sort === 'manual' ? <GripVertical size={16} /> : sort === 'due-asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</button>
      </div>
      <section className="task-list" onDragOver={(event) => event.preventDefault()}>
        {list.length === 0 && <div className="empty-state"><span className="empty-icon"><Sparkles size={19} /></span><strong>{t('目前沒有任務', 'Nothing here yet')}</strong><span>{t('新增任務，或切換篩選查看其他項目。', 'Add a task or change filters to see more.')}</span></div>}
        {list.map((task) => <article key={task.id} className={`task-row urgency-${urgency(task)} ${dragOverId === task.id ? 'drop-target' : ''} ${task.status === 'completed' ? 'is-complete' : ''}`} onDragEnter={() => { if (dragId) setDragOverId(task.id) }} onDragEnd={() => { setDragId(null); setDragOverId(null) }} onDrop={(event) => { event.preventDefault(); dropOn(task.id) }}>
          <button className="drag-handle" draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', task.id); setDragId(task.id) }} aria-label={t('拖曳任務', 'Drag task')} title={sort === 'manual' ? t('拖曳排序或移至狀態分頁', 'Drag to reorder or change status') : t('拖至狀態分頁；手動排序可調整順序', 'Drag to a status tab; switch to manual to reorder')}><GripVertical size={16} /></button>
          <button className={`check-control ${task.status === 'completed' ? 'checked' : ''}`} aria-label={task.status === 'completed' ? t('重新開啟任務', 'Reopen task') : t('標記完成', 'Mark completed')} title={task.status === 'completed' ? t('重新開啟任務', 'Reopen task') : t('標記完成', 'Mark completed')} onClick={() => updateStatus(task.id, task.status === 'completed' ? 'todo' : 'completed')}>{task.status === 'completed' ? <Check size={12} /> : <Circle size={17} strokeWidth={1.6} />}</button>
          <div className="task-copy">
            {editing === task.id ? <input autoFocus value={editDraft} onChange={(event) => setEditDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEdit(task.id); if (event.key === 'Escape') setEditing(null) }} onBlur={() => saveEdit(task.id)} /> : <span className="task-title" onDoubleClick={() => { setEditing(task.id); setEditDraft(task.title) }}>{task.title}</span>}
            <div className="task-metadata"><GroupPicker className="status-picker" groups={statusOptions} value={task.status} label={`${t('變更狀態', 'Change status')}: ${task.title}`} iconFor={statusIcon} t={t} onOpenChange={setGroupMenuOpen} onChange={(status) => updateStatus(task.id, status as Status)} /><GroupPicker groups={groups} value={task.group ?? groups[0].id} t={t} onOpenChange={setGroupMenuOpen} onChange={(group) => setTasks((items) => items.map((item) => item.id === task.id ? { ...item, group } : item))} /><DueDate value={task.dueDate} label={dueDateLabel(task.dueDate, language)} taskTitle={task.title} today={today} language={language} t={t} onChange={(value) => updateDueDate(task.id, value)} onInteraction={(active) => { if (active) setToday(dateKey(new Date())); setDatePicking(active) }} />{urgency(task) && <span className="urgency-label">{urgency(task) === 'overdue' ? t('逾期', 'Overdue') : urgency(task) === 'today' ? t('今天', 'Today') : t('7 天內', 'Within 7 days')}</span>}</div>
          </div>
          <div className="task-actions">
            <button title={t('刪除任務', 'Delete task')} aria-label={`${t('刪除', 'Delete')}: ${task.title}`} className="row-more delete-task" onClick={() => { if (window.confirm(t(`刪除「${task.title}」？`, `Delete “${task.title}”?`))) setTasks((items) => items.filter((item) => item.id !== task.id)) }}><Trash2 size={15} /></button></div>
        </article>)}
      </section>
      <div className="composer" onFocus={() => setComposerFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !(event.relatedTarget as HTMLElement | null)?.closest('.group-menu')) setComposerFocused(false) }}>
      <form className="add-form" onSubmit={addTask}><span className="add-icon"><Plus size={17} /></span><input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setDraft('') }} placeholder={t('新增待辦事項…', 'Add a task…')} aria-label={t('新任務內容', 'New task title')} />{draft.trim() ? <button className="submit-task" aria-label={t('新增任務', 'Add task')} title={t('新增任務', 'Add task')}><Check size={16} /></button> : <kbd>↵</kbd>}</form>
      {(composerFocused || draft || newDate || datePicking) && <div className="new-task-options"><span>{t('分組', 'Group')}</span><GroupPicker groups={groups} value={newGroup} onChange={setNewGroup} t={t} onOpenChange={setGroupMenuOpen} /><label>{t('截止', 'Due')} <input type="date" min={today} lang={language === 'zh' ? 'zh-TW' : 'en-US'} aria-label={t('新任務截止日期', 'New task due date')} value={newDate} onFocus={() => { setToday(dateKey(new Date())); setDatePicking(true) }} onBlur={() => setDatePicking(false)} onChange={(event) => { if (validDueDate(event.target.value)) setNewDate(event.target.value); else setToast(t('截止日期不能早於今天，請重新選擇。', 'Choose today or a future due date.')) }} /></label></div>}
      </div>
      <footer className="widget-footer"><span role="status"><span className={`saved-dot save-${saveState}`} /> {saveState === 'saving' ? t('儲存中…', 'Saving…') : saveState === 'error' ? t('儲存失敗', 'Save failed') : saveState === 'loading' ? t('請選擇資料夾', 'Choose data folder') : t('已儲存', 'Saved')}{saveState === 'error' && <button onClick={() => { saveFailed.current = false; setTasks((items) => [...items]) }}>{t('重試', 'Retry')}</button>}</span><button onClick={() => setToast(taskFolder || t('預覽資料儲存在此瀏覽器。', 'Preview data is saved in this browser.'))}><LockKeyhole size={12} /> {isTauri() ? t('本機資料夾', 'Local folder') : t('預覽模式', 'Preview mode')}</button></footer>
      {settingsOpen && <div className="settings-panel"><div className="settings-head"><div><strong>{t('設定', 'Preferences')}</strong><span>{t('依照你的習慣調整', 'Make it yours')}</span></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label={t('關閉設定', 'Close settings')}><X size={15} /></button></div>
        <label className="language-row"><strong>{t('介面語言', 'Interface language')}</strong><select value={language} onChange={(event) => setLanguage(event.target.value as 'zh' | 'en')}><option value="zh">{t('繁體中文', 'Traditional Chinese')}</option><option value="en">{t('英文', 'English')}</option></select></label>
        <label className="toggle-row"><span><strong>{t('失焦自動收合', 'Auto-collapse on blur')}</strong><small>{t('切換應用程式時收合', 'Hide when you switch apps')}</small></span><input type="checkbox" checked={settings.autoCollapse} onChange={(event) => setSettings((s) => ({ ...s, autoCollapse: event.target.checked }))} /></label>
        <label className="toggle-row"><span><strong>{t('視窗置頂', 'Always on top')}</strong><small>{t('保持在其他視窗上方', 'Stay above other windows')}</small></span><input type="checkbox" checked={settings.alwaysOnTop} onChange={(event) => setSettings((s) => ({ ...s, alwaysOnTop: event.target.checked }))} /></label>
        <label className="range-row"><span><strong>{t('背景不透明度（越低越透明）', 'Background opacity (lower is clearer)')}</strong><small>{settings.opacity}%</small></span><input type="range" min="25" max="100" value={settings.opacity} onChange={(event) => setSettings((s) => ({ ...s, opacity: Number(event.target.value), opacityCustomized: true }))} /></label>
        <label className="range-row"><span><strong>{t('毛玻璃模糊', 'Glass blur')}</strong><small>{settings.blur}px</small></span><input type="range" min="0" max="28" value={settings.blur} onChange={(event) => setSettings((s) => ({ ...s, blur: Number(event.target.value) }))} /></label>
        <GroupManager groups={groups} onChange={setGroups} onDelete={deleteGroup} t={t} />
        <button className="folder-button" onClick={async () => {
          if (!isTauri()) { setToast(t('桌面版可選擇任務資料夾。', 'The folder picker is available in the desktop app.')); return }
          if (saveState === 'saving' || saveState === 'error') { setToast(t('請先完成目前資料的儲存，再切換資料夾。', 'Save current changes before switching folders.')); return }
          try { const folder = await invoke<string | null>('select_task_folder'); if (folder) { await saveQueue.current; const data = await invoke<{ revision: number; tasks: Task[]; groups?: Group[] }>('read_tasks', { folder }); revisionRef.current = data.revision; saveFailed.current = false; const loadedGroups = data.groups?.length ? data.groups : defaultGroups; setGroups(loadedGroups); setNewGroup(loadedGroups[0].id); setGroupFilter('all'); setTasks(migrateTasks(data.tasks)); setTaskFolder(folder); localStorage.setItem('floating-todo.folder.v1', folder); setNativeReady(true) } } catch (error) { setToast(String(error)) }
        }}><LockKeyhole size={14} /> {t('選擇任務資料夾', 'Choose task folder')}</button>
      </div>}
      {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label={t('關閉提示', 'Dismiss')}><X size={13} /></button></div>}
      {undo && <div className="undo-notice" role="status"><Check size={14} /><span>{t('任務已完成', 'Task completed')}</span><button onClick={() => { updateStatus(undo.id, undo.status); setUndo(null) }}>{t('復原', 'Undo')}</button><button aria-label={t('關閉復原提示', 'Dismiss undo')} onClick={() => setUndo(null)}><X size={13} /></button></div>}
    </section>
    {settings.pinned && <div className="pinned-indicator"><LockKeyhole size={11} /> {t('已釘選展開', 'Pinned open')}</div>}
  </main>
}
