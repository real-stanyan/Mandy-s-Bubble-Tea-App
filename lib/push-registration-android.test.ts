import { Platform } from 'react-native'

const mockRequestPermissionsAsync = jest.fn()
const mockSetNotificationChannelAsync = jest.fn()
const mockGetExpoPushTokenAsync = jest.fn()

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  AndroidImportance: { HIGH: 4 },
}))

jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: { eas: { projectId: 'test-eas-project' } } },
    easConfig: { projectId: 'test-eas-project' },
  },
  expoConfig: { extra: { eas: { projectId: 'test-eas-project' } }, version: '1.2.0' },
  easConfig: { projectId: 'test-eas-project' },
}))

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn().mockResolvedValue({ ok: true }),
}))

describe('registerForPushAndUpload on Android', () => {
  beforeEach(() => {
    jest.resetModules()
    mockRequestPermissionsAsync.mockReset()
    mockSetNotificationChannelAsync.mockReset()
    mockGetExpoPushTokenAsync.mockReset()
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
  })

  it('sets the default notification channel before requesting permission', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' })
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]' })

    const { registerForPushAndUpload } = require('./push-registration') as typeof import('./push-registration')
    const result = await registerForPushAndUpload()

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        name: 'Order updates',
        importance: 4,
      }),
    )
    expect(mockSetNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockRequestPermissionsAsync.mock.invocationCallOrder[0],
    )
    expect(result).toEqual({ ok: true, token: 'ExponentPushToken[test]' })
  })

  it('returns denied when user rejects permission on Android', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' })
    const { registerForPushAndUpload } = require('./push-registration') as typeof import('./push-registration')
    const result = await registerForPushAndUpload()
    expect(result).toEqual({ ok: false, reason: 'denied' })
  })

  it('passes platform: "android" to /api/device-push-token', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' })
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]' })
    const { apiFetch } = require('@/lib/api') as { apiFetch: jest.Mock }

    const { registerForPushAndUpload } = require('./push-registration') as typeof import('./push-registration')
    await registerForPushAndUpload()

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/device-push-token',
      expect.objectContaining({
        body: expect.stringContaining('"platform":"android"'),
      }),
    )
  })
})
