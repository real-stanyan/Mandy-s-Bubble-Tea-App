import * as ImageManipulator from 'expo-image-manipulator'
import { compressForUpload } from './photo-compress'

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}))

const mockManipulateAsync = ImageManipulator.manipulateAsync as jest.Mock

describe('compressForUpload', () => {
  beforeEach(() => {
    mockManipulateAsync.mockReset()
  })

  it('resizes to 1920px width with JPEG q80 and returns Photo shape', async () => {
    mockManipulateAsync.mockResolvedValueOnce({
      uri: 'file:///tmp/out.jpg',
      width: 1920,
      height: 1080,
    })

    const result = await compressForUpload('file:///source/heic1.heic', 0)

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///source/heic1.heic',
      [{ resize: { width: 1920 } }],
      { compress: 0.8, format: 'jpeg' },
    )
    expect(result).toEqual({
      uri: 'file:///tmp/out.jpg',
      mime: 'image/jpeg',
      name: 'photo-0.jpg',
    })
  })

  it('uses the index in the generated filename', async () => {
    mockManipulateAsync.mockResolvedValueOnce({
      uri: 'file:///tmp/x.jpg',
      width: 100,
      height: 100,
    })
    const result = await compressForUpload('file:///s.jpg', 2)
    expect(result.name).toBe('photo-2.jpg')
  })

  it('propagates errors from manipulateAsync to the caller', async () => {
    mockManipulateAsync.mockRejectedValueOnce(new Error('decode failed'))
    await expect(compressForUpload('file:///bad.heic', 0)).rejects.toThrow(
      'decode failed',
    )
  })
})
