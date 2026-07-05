// Load .env.local for Detox spec process. Detox CLI runs jest which
// does NOT auto-load .env files; the spec needs SUPABASE_SERVICE_ROLE_KEY
// (for fixture admin client) and EXPO_PUBLIC_SUPABASE_URL.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') })
