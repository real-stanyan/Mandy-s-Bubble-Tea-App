import { useCart } from './cart'

beforeEach(() => {
  useCart.setState({
    items: [],
    fulfillmentType: 'PICKUP',
    deliveryAddress: { address: '', lat: 0, lng: 0, unit: '', driverNote: '', postcode: '' },
  })
})

it('defaults to PICKUP with empty address', () => {
  const s = useCart.getState()
  expect(s.fulfillmentType).toBe('PICKUP')
  expect(s.deliveryAddress.lat).toBe(0)
})

it('setFulfillmentType + setDeliveryAddress mutate state', () => {
  useCart.getState().setFulfillmentType('DELIVERY')
  useCart.getState().setDeliveryAddress({
    address: '1 A St QLD 4215', lat: -27.97, lng: 153.41, unit: '2', driverNote: 'gate code 1', postcode: '4215',
  })
  const s = useCart.getState()
  expect(s.fulfillmentType).toBe('DELIVERY')
  expect(s.deliveryAddress.postcode).toBe('4215')
})

it('clearCart resets fulfillment + address', () => {
  useCart.getState().setFulfillmentType('DELIVERY')
  useCart.getState().setDeliveryAddress({ address: 'x', lat: 1, lng: 2, unit: '', driverNote: '', postcode: '4215' })
  useCart.getState().clearCart()
  const s = useCart.getState()
  expect(s.fulfillmentType).toBe('PICKUP')
  expect(s.deliveryAddress.lat).toBe(0)
})
