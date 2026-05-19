import { createServer, type Server } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { SquareClient, SquareEnvironment } from 'square'
import { randomUUID } from 'node:crypto'

// Detox auth fixture HTTP server.
//
// Spawns a tiny localhost:8765 server that serves a fresh Supabase
// session JSON to the app at boot. The app's lib/supabase.ts has a
// build-time-gated branch (EXPO_PUBLIC_DETOX_FIXTURE_URL) that
// fetches from this URL and calls supabase.auth.setSession.
//
// Lifecycle:
//   start() — creates Supabase user + signs in → returns server + cleanup
//   stop()  — closes HTTP server + deletes Supabase user

export interface AuthFixtureServerHandle {
  server: Server
  userId: string
  email: string
  accessToken: string
  refreshToken: string
  port: number
  stop: () => Promise<void>
}

export async function startAuthFixtureServer(
  port = 8765,
): Promise<AuthFixtureServerHandle> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } })
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })

  const stamp = Date.now()
  const email = `test+detox-${stamp}@mandystest.local`
  const password = `pwd-${stamp}-${Math.random().toString(36).slice(2, 10)}`

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    throw new Error(`detox fixture createUser failed: ${createErr?.message}`)
  }
  const userId = created.user.id

  const { data: session, error: signErr } = await anon.auth.signInWithPassword({
    email,
    password,
  })
  if (signErr || !session.session) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined)
    throw new Error(`detox fixture signIn failed: ${signErr?.message}`)
  }

  // Create Square sandbox customer. /api/me's profile-completeness gate
  // returns profile:null when square_customer_id is missing, so this
  // step is REQUIRED for AuthProvider to route into (tabs) instead of
  // bouncing back to the firstName/lastName signup stage.
  const squareToken = process.env.SQUARE_ACCESS_TOKEN!
  const square = new SquareClient({
    token: squareToken,
    environment:
      process.env.SQUARE_ENVIRONMENT === 'production'
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  })
  const phone = `+6140${Math.floor(Math.random() * 1e7).toString().padStart(7, '0')}`
  const refId = `detox-d2-${stamp}`
  const sqCreated = await square.customers.create({
    givenName: 'Detox',
    familyName: 'TestUser',
    emailAddress: email,
    phoneNumber: phone,
    referenceId: refId,
    idempotencyKey: randomUUID(),
  })
  const squareCustomerId = sqCreated.customer?.id
  if (!squareCustomerId) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined)
    throw new Error('Square sandbox customer.create returned no id')
  }

  // Insert user_profiles row with square_customer_id so /api/me's
  // gate passes and AuthProvider routes into (tabs).
  const { error: profileErr } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      square_customer_id: squareCustomerId,
      first_name: 'Detox',
      last_name: 'TestUser',
      phone_e164: phone,
      signup_channel: 'app',
      square_verified_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (profileErr) {
    await square.customers.delete({ customerId: squareCustomerId }).catch(() => undefined)
    await admin.auth.admin.deleteUser(userId).catch(() => undefined)
    throw new Error(`detox fixture profile upsert failed: ${profileErr.message}`)
  }

  // Verify the profile actually landed (defensive — early debug showed
  // /api/me returning profile:null despite upsert returning no error).
  const { data: verify, error: verifyErr } = await admin
    .from('user_profiles')
    .select('user_id, square_customer_id, phone_e164, signup_channel')
    .eq('user_id', userId)
    .maybeSingle()
  // eslint-disable-next-line no-console
  console.log(
    '[fixture verify] profile row:',
    verify ? JSON.stringify(verify) : 'NULL',
    verifyErr ? `err=${verifyErr.message}` : '',
  )

  const accessToken = session.session.access_token
  const refreshToken = session.session.refresh_token

  // Spin up the HTTP server that the app will hit on launch. Serve
  // the FULL Supabase session object (including .user) so the app's
  // AsyncStorage write matches what supabase-js v2 expects to find
  // on subsequent reloads — missing .user means supabase rejects
  // the stored session as malformed and clears it on next getSession().
  const fullSession = session.session
  const server = createServer((req, res) => {
    if (req.url === '/session.json' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(fullSession))
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  return {
    server,
    userId,
    email,
    accessToken,
    refreshToken,
    port,
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      try {
        await admin.from('user_profiles').delete().eq('user_id', userId)
      } catch {
        /* best-effort */
      }
      await admin.auth.admin.deleteUser(userId).catch(() => undefined)
    },
  }
}
