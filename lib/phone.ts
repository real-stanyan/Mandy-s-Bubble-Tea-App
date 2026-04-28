// Coerce user-typed phone into an AU-mobile E.164 string. Returns null
// when the input isn't a valid AU mobile (must reduce to 4xxxxxxxx).
//
// Handles paste/autofill formats that previously broke handleSendOtp:
//   "+61 412 345 678"  (was "+6161412345678" — invalid)
//   "0061 412 345 678"
//   "(04) 1234 5678"
//   "0412-345-678"
//   plain "412345678"
export function normalizeAUMobile(input: string): string | null {
  if (!input) return null
  let local = input.replace(/\D/g, '')

  // Country-code prefixes — strip before the leading-zero pass so e.g.
  // "+610412..." (someone double-prefixed) reduces correctly.
  if (local.startsWith('0061')) {
    local = local.slice(4)
  } else if (local.length >= 11 && local.startsWith('61')) {
    local = local.slice(2)
  }

  // National-format leading zero(s).
  local = local.replace(/^0+/, '')

  // AU mobile is exactly 9 digits starting with 4.
  if (local.length !== 9 || !local.startsWith('4')) return null
  return `+61${local}`
}
