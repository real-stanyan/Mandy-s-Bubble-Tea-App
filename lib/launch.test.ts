// The launch cover is module state (one per app start), so every test takes
// a fresh copy of the module, and of the ambient clock it lets go.

type LaunchModule = typeof import('./launch')
type AmbientModule = typeof import('./motion/ambient')

function fresh(): { launch: LaunchModule; ambient: AmbientModule } {
  let launch!: LaunchModule
  let ambient!: AmbientModule
  jest.isolateModules(() => {
    ambient = require('./motion/ambient')
    launch = require('./launch')
  })
  return { launch, ambient }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('the launch cover', () => {
  it('holds what waits on it until the launch screen has gone, then runs it after its delay', () => {
    const { launch } = fresh()
    const fn = jest.fn()
    launch.afterLaunch(fn, 100)
    jest.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()
    launch.endLaunch()
    jest.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('counts from now once the launch screen has already gone', () => {
    const { launch } = fresh()
    launch.endLaunch()
    const fn = jest.fn()
    launch.afterLaunch(fn, 50)
    jest.advanceTimersByTime(49)
    expect(fn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('can be called off while it waits for the cover and while its delay runs', () => {
    const { launch } = fresh()
    const early = jest.fn()
    const late = jest.fn()
    launch.afterLaunch(early, 10)()
    const cancelLate = launch.afterLaunch(late, 10)
    launch.endLaunch()
    cancelLate()
    jest.advanceTimersByTime(100)
    expect(early).not.toHaveBeenCalled()
    expect(late).not.toHaveBeenCalled()
  })

  it('ends once: a second end runs nothing twice', () => {
    const { launch } = fresh()
    const fn = jest.fn()
    launch.afterLaunch(fn)
    launch.endLaunch()
    launch.endLaunch()
    jest.runAllTimers()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('lets the ambient loops go when the cover lifts', () => {
    const { launch, ambient } = fresh()
    expect(launch.launchCovered()).toBe(true)
    expect(ambient.launchCover.value).toBe(1)
    launch.endLaunch()
    expect(launch.launchCovered()).toBe(false)
    expect(ambient.launchCover.value).toBe(0)
  })
})
