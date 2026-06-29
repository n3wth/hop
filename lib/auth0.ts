import { Auth0Client } from '@auth0/nextjs-auth0/server'

// Server-side Auth0 client (session management + OAuth flow). Reads AUTH0_*
// and APP_BASE_URL from the environment. Mounts /auth/* routes via the proxy.
export const auth0 = new Auth0Client()
