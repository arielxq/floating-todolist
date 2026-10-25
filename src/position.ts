export type Edge = 'left' | 'right' | 'top' | 'bottom'
export type Dock = { side: Edge; x: number; y: number }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value))

export function nearestEdge(x: number, y: number, width: number, height: number, preferred: Edge): Edge {
  const distances = { left: x, right: width - x, top: y, bottom: height - y }
  const nearest = (Object.keys(distances) as Edge[]).reduce((a, b) => distances[a] <= distances[b] ? a : b)
  return distances[preferred] <= distances[nearest] + 10 ? preferred : nearest
}

export function dockPoint(dock: Dock, width: number, height: number, size = 56) {
  return {
    x: dock.side === 'left' ? 0 : dock.side === 'right' ? Math.max(0, width - size) : clamp(dock.x * width, 0, width - size),
    y: dock.side === 'top' ? 0 : dock.side === 'bottom' ? Math.max(0, height - size) : clamp(dock.y * height, 0, height - size),
  }
}
