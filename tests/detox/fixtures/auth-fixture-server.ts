import { createServer, type Server } from 'node:http'
import { createClient } from '@supabase/supabase-js'

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

  // Insert user_profiles row so AuthProvider doesn't bounce back to /login.
  // The app's AuthProvider treats !profile as not-fully-signed-up.
  const { error: profileErr } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      first_name: 'Detox',
      last_name: 'TestUser',
      phone_e164: `+6140${Math.floor(Math.random() * 1e7).toString().padStart(7, '0')}`,
      signup_channel: 'app',
      square_verified_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined)
    throw new Error(`detox fixture profile upsert failed: ${profileErr.message}`)
  }

  const accessToken = session.session.access_token
  const refreshToken = session.session.refresh_token

  // Spin up the HTTP server that the app will hit on launch.
  const server = createServer((req, res) => {
    if (req.url === '/session.json' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }))
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
