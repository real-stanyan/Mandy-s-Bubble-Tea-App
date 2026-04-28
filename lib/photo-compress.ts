import * as ImageManipulator from 'expo-image-manipulator'

export type Photo = {
  uri: string
  mime: 'image/jpeg'
  name: string
}

export async function compressForUpload(
  sourceUri: string,
  index: number,
): Promise<Photo> {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  )
  return {
    uri: result.uri,
    mime: 'image/jpeg',
    name: `photo-${index}.jpg`,
  }
}
