const MS_MIN = 60_000
const MS_HOUR = 3_600_000
const MS_DAY = 86_400_000

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtWeekday(d: Date): string {
  return d.toLocaleDateString('en-AU', { weekday: 'short' })
}

function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// `placedRelative` returns a human-readable time string for an order's
// createdAt. Rules mirror the reference mocks:
//   - < 60s        → 'just now'
//   - < 60min      → 'N min ago'
//   - today        → 'Today, h:mm am/pm'
//   - yesterday    → 'Yesterday, h:mm am/pm'
//   - < 7 days     → 'Mon, h:mm am/pm'  (short weekday + time)
//   - older        → 'Sat 12 Oct · h:mm am/pm'
//   - null input   → ''
export function placedRelative(
  createdAt: string | null,
  now: Date = new Date(),
): string {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''

  const diff = now.getTime() - d.getTime()
  if (diff < MS_MIN) return 'just now'
  if (diff < MS_HOUR) {
    const mins = Math.max(1, Math.floor(diff / MS_MIN))
    return `${mins} min ago`
  }

  if (isSameCalendarDay(d, now)) {
    return `Today, ${fmtTime(d)}`
  }

  const yesterday = new Date(now.getTime() - MS_DAY)
  if (isSameCalendarDay(d, yesterday)) {
    return `Yesterday, ${fmtTime(d)}`
  }

  if (diff < 7 * MS_DAY) {
    return `${fmtWeekday(d)}, ${fmtTime(d)}`
  }

  return `${fmtWeekday(d)} ${fmtDayMonth(d)} · ${fmtTime(d)}`
}
