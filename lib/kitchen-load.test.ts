import {
  KITCHEN_LOAD_FALLBACK,
  MEDIUM_MAX_CUPS,
  QUIET_MAX_CUPS,
  kitchenLevelFor,
  kitchenLoadFor,
  kitchenMoodLabel,
} from './kitchen-load'

describe('kitchen load brackets (Stan, 2026-09-04)', () => {
  it('quiet: 2–3 min up to the quiet ceiling', () => {
    expect(kitchenLoadFor(0)).toMatchObject({ level: 'quiet', label: '2–3 min' })
    expect(kitchenLevelFor(QUIET_MAX_CUPS)).toBe('quiet')
  })

  it('medium: 5–7 min from one past quiet up to the medium ceiling', () => {
    expect(kitchenLevelFor(QUIET_MAX_CUPS + 1)).toBe('medium')
    expect(kitchenLoadFor(MEDIUM_MAX_CUPS)).toMatchObject({ level: 'medium', label: '5–7 min' })
  })

  it('busy: 7–10 min past the medium ceiling, however deep the queue', () => {
    expect(kitchenLoadFor(MEDIUM_MAX_CUPS + 1)).toMatchObject({ level: 'busy', label: '7–10 min' })
    expect(kitchenLoadFor(60).level).toBe('busy')
  })

  it('fallback is the middle bracket', () => {
    expect(KITCHEN_LOAD_FALLBACK.level).toBe('medium')
  })

  it('has mood copy for every level', () => {
    expect(kitchenMoodLabel('quiet')).toMatch(/quiet/)
    expect(kitchenMoodLabel('busy')).toMatch(/busy/)
  })
})
