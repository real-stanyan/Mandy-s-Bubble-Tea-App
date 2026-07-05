import { buildPaymentSelections } from './build-payment-selections'
import type { CupLabelSelection } from '@/store/cart'

describe('buildPaymentSelections', () => {
  it('all-preset → only presetStickerHashes populated', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'preset', hash: 'h1' },
      'A:1': { kind: 'preset', hash: 'h2' },
    })
    expect(r.presetStickerHashes).toEqual({ 'A:0': 'h1', 'A:1': 'h2' })
    expect(r.aiDoodleIds).toEqual({})
    expect(r.doodleIds).toEqual({})
  })

  it('mixed kinds → 3 maps each populated correctly (photo merges into aiDoodleIds)', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'preset', hash: 'h1' },
      'A:1': { kind: 'photo', uploadedDoodleId: 'up-1', previewUrl: 'p1' },
      'B:0': { kind: 'ai', aiDoodleId: 'ai-1', prompt: 'hi' },
      'B:1': { kind: 'draw', userDoodleId: 'd-1', pathCount: 3, paths: [] },
    } as Record<string, CupLabelSelection>)
    expect(r.presetStickerHashes).toEqual({ 'A:0': 'h1' })
    // photo + ai BOTH go into aiDoodleIds — server treats them identically
    expect(r.aiDoodleIds).toEqual({ 'A:1': 'up-1', 'B:0': 'ai-1' })
    expect(r.doodleIds).toEqual({ 'B:1': 'd-1' })
  })

  it('AI pending (aiDoodleId === null) → not included in aiDoodleIds', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'ai', aiDoodleId: null, prompt: 'wait' },
    })
    expect(r.aiDoodleIds).toEqual({})
  })

  it('draw pending (userDoodleId === null) → not included in doodleIds', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'draw', userDoodleId: null, pathCount: 0, paths: [] },
    })
    expect(r.doodleIds).toEqual({})
  })

  it('empty selections → all 3 maps empty', () => {
    const r = buildPaymentSelections({})
    expect(r.presetStickerHashes).toEqual({})
    expect(r.aiDoodleIds).toEqual({})
    expect(r.doodleIds).toEqual({})
  })
})
