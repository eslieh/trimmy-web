# Trimmy web

The web version of Trimmy: customers explore and book, and business owners and front desk run their day (desktop-first, responsive down to phones). Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.

## Run it

```bash
cp .env.example .env.local   # TRIMMY_API_URL = the Trimmy API, NEXT_PUBLIC_SITE_URL = this app's origin
npm install
npm run dev                   # http://localhost:3000
```

Google sign-in comes back to `<NEXT_PUBLIC_SITE_URL>/auth/google`. That URL must be in the API's `GOOGLE_WEB_REDIRECT_ALLOWLIST` (`http://localhost:3000/auth/google` is allowed by default locally).

## How it fits together

- **Sessions are httpOnly cookies.** Sign-ins go through `src/app/api/auth/[action]` and the tokens never reach the page's JavaScript. `src/proxy.ts` refreshes an expired session before a page renders and sends signed-out visitors away from private pages.
- **The browser talks to the API only through `/api/proxy/*`** (`src/app/api/proxy/[...path]`). It is same-origin, so no CORS. It adds the token, refreshes once on a 401, streams responses (the live `me/events` stream included), refuses token-issuing endpoints, and only accepts writes from this site.
- **Server Components** read the API with `serverApi()` and the visitor with `getSession()` (`src/lib/server/`). Public pages (Explore, business profiles) are server-rendered for search engines.
- **Areas:**
  - `src/app/(customer)`: Explore, business pages, booking, my bookings, account.
  - `src/app/(auth)`: sign in, sign up, verify, recover, Google callback.
  - `src/app/work/[businessId]`: the business area. Owner and front desk get in; earnings, team, payouts and settings are owner-only.
- **Live updates** (`src/components/notifications`): one event stream per tab, toasts, the bell, and `useLiveEvent()` for pages that refresh when bookings change.
- Types in `src/types` mirror the mobile app's. The API contracts live in the mobile repo under `reference/api/`.
