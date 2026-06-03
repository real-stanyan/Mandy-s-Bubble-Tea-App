import { placesAutocomplete, placeDetails } from './places-client'

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))
import { apiFetch } from '@/lib/api'
const mockFetch = apiFetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

it('placesAutocomplete posts input + sessionToken, returns predictions', async () => {
  mockFetch.mockResolvedValue({ predictions: [{ description: 'A St', placeId: 'p1' }] })
  const out = await placesAutocomplete('A St', 'sess-1')
  expect(mockFetch).toHaveBeenCalledWith('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ input: 'A St', sessionToken: 'sess-1' }),
  })
  expect(out).toEqual([{ description: 'A St', placeId: 'p1' }])
})

it('placeDetails posts placeId, returns address payload', async () => {
  mockFetch.mockResolvedValue({ address: '1 A St QLD 4215', lat: -27.97, lng: 153.41, postcode: '4215' })
  const out = await placeDetails('p1')
  expect(mockFetch).toHaveBeenCalledWith('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ placeId: 'p1' }),
  })
  expect(out.postcode).toBe('4215')
})
