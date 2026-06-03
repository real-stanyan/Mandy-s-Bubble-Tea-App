import { apiFetch } from '@/lib/api'

export type Prediction = { description: string; placeId: string }
export type PlaceDetails = {
  address: string
  lat: number
  lng: number
  postcode: string | null
}

export async function placesAutocomplete(
  input: string,
  sessionToken: string,
): Promise<Prediction[]> {
  const res = await apiFetch<{ predictions: Prediction[] }>('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ input, sessionToken }),
  })
  return res.predictions ?? []
}

export async function placeDetails(placeId: string): Promise<PlaceDetails> {
  return apiFetch<PlaceDetails>('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  })
}
