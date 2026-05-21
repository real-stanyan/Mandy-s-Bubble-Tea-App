import { buildPaymentSelections } from './build-payment-selections'
import type { CupLabelSelection } from '@/store/cart'

describe('buildPaymentSelections', () => {
  it('all-preset → only presetStickerHashes populated', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'preset', hash: 'h1' },
      'A:1': { kind: 'preset', hash: 'h2' },
    })
    expect(r.presetStickerHashes).toEqual({ 'A:0': 'h1', 'A:1': 'h2' })
    expect(r.uploadedDoodleIds).toEqual({})
    expect(r.aiDoodleIds).toEqual({})
    expect(r.userDoodleIds).toEqual({})
  })

  it('mixed kinds → 4 maps each populated correctly', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'preset', hash: 'h1' },
      'A:1': { kind: 'photo', uploadedDoodleId: 'up-1', previewUrl: 'p1' },
      'B:0': { kind: 'ai', aiDoodleId: 'ai-1', prompt: 'hi' },
      'B:1': { kind: 'draw', userDoodleId: 'd-1', pathCount: 3, paths: [] },
    } as Record<string, CupLabelSelection>)
    expect(r.presetStickerHashes).toEqual({ 'A:0': 'h1' })
    expect(r.uploadedDoodleIds).toEqual({ 'A:1': 'up-1' })
    expect(r.aiDoodleIds).toEqual({ 'B:0': 'ai-1' })
    expect(r.userDoodleIds).toEqual({ 'B:1': 'd-1' })
  })

  it('AI pending (aiDoodleId === null) → not included in aiDoodleIds', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'ai', aiDoodleId: null, prompt: 'wait' },
    })
    expect(r.aiDoodleIds).toEqual({})
  })

  it('draw pending (userDoodleId === null) → not included in userDoodleIds', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'draw', userDoodleId: null, pathCount: 0, paths: [] },
    })
    expect(r.userDoodleIds).toEqual({})
  })

  it('empty selections → all 4 maps empty', () => {
    const r = buildPaymentSelections({})
    expect(r.presetStickerHashes).toEqual({})
    expect(r.uploadedDoodleIds).toEqual({})
    expect(r.aiDoodleIds).toEqual({})
    expect(r.userDoodleIds).toEqual({})
  })
})
