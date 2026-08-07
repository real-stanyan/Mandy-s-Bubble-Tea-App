import { safeInAppPath } from './push-deep-link'

describe('safeInAppPath', () => {
  it('accepts an in-app path', () => {
    expect(safeInAppPath('/menu')).toBe('/menu')
    expect(safeInAppPath('/order-detail?orderId=abc')).toBe(
      '/order-detail?orderId=abc',
    )
  })

  it('refuses a protocol-relative URL', () => {
    expect(safeInAppPath('//evil.example/menu')).toBeNull()
  })

  it('refuses a backslash-disguised protocol-relative URL', () => {
    expect(safeInAppPath('/\\evil.example')).toBeNull()
  })

  it('refuses an absolute URL or a custom scheme', () => {
    expect(safeInAppPath('https://evil.example')).toBeNull()
    expect(safeInAppPath('mandysbubbletea://evil')).toBeNull()
    expect(safeInAppPath('javascript:alert(1)')).toBeNull()
  })

  it('refuses anything that is not a string', () => {
    expect(safeInAppPath(undefined)).toBeNull()
    expect(safeInAppPath(null)).toBeNull()
    expect(safeInAppPath(42)).toBeNull()
    expect(safeInAppPath({ url: '/menu' })).toBeNull()
  })

  it('refuses a bare relative path with no leading slash', () => {
    expect(safeInAppPath('menu')).toBeNull()
  })
})
