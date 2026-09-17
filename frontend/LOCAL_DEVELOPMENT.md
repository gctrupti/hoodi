# Hoodi — Local Development & Developer Handoff Guide

Everything needed to clone, configure, run, extend and deploy Hoodi **without Lovable**.

Hoodi is a hyperlocal community platform with two products sharing one backend:

- **Hoodi Help** — neighbours request errands / deliveries / home assistance / transport, nearby helpers accept, chat, track, complete, get paid.
- **Hoodi Skills** — peer-to-peer learning marketplace: teacher profiles, offerings, availability, bookings, reviews.
- **Hoodi Admin** — analytics, user/teacher/helper management, trust & safety moderation, finance, pricing, announcements.

Stack: **React 19 + TypeScript + TanStack Start (Router + Server Functions) + Vite + Tailwind v4 + shadcn/ui + Supabase (Postgres + PostGIS + Auth + Storage + Realtime)**.

> There is **no separate Node/Express server**. TanStack Start *is* the backend: every "API endpoint" is a `createServerFn` in `src/lib/hoodi/*.functions.ts`, executed on the server, called type-safely from React.

---

## 1. Project Structure

```
hoodi/
├── public/                      # Static assets served as-is (favicon, hoodi-mark.svg)
├── supabase/
│   ├── config.toml              # Supabase project ref
│   └── migrations/              # 16 timestamped SQL migrations = full DB history
├── src/
│   ├── routes/                  # FILE-BASED ROUTING (URL = file path)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives (button, dialog, card…)
│   │   └── hoodi/               # App-specific components
│   ├── lib/
│   │   ├── hoodi/               # ALL BACKEND LOGIC + domain helpers
│   │   ├── ai-provider.server.ts # Pluggable AI provider (OpenAI/Anthropic/Gemini, server-only)
│   │   ├── utils.ts             # cn() classname merge
│   │   └── error-*.ts           # SSR error capture / error page
│   ├── hooks/                   # React hooks
│   ├── integrations/supabase/   # Generated Supabase clients + types
│   ├── styles.css               # Tailwind v4 theme + design tokens
│   ├── router.tsx               # Router + QueryClient creation
│   ├── start.ts                 # Server/client middleware registration
│   ├── server.ts                # SSR entry wrapper (error handling)
│   └── routeTree.gen.ts         # AUTO-GENERATED — never edit
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
└── package.json
```

### Frontend — `src/routes/` (routes) and `src/components/` (UI)

File path maps to URL. `_authenticated` is a *pathless layout* (no URL segment) that gates everything under it.

| File | URL | Purpose |
|---|---|---|
| `routes/__root.tsx` | — | HTML shell, providers, `<Toaster/>`, auth-state listener |
| `routes/index.tsx` | `/` | Public landing page |
| `routes/auth.tsx` | `/auth` | Sign up / sign in (email + password) |
| `routes/_authenticated/route.tsx` | — | **Auth gate**: `ssr:false`, redirects to `/auth` when no session |
| `routes/_authenticated/home.tsx` | `/home` | Service hub (choose Help or Skills) |
| `routes/_authenticated/help/route.tsx` | — | Help product shell (nav/tabs) |
| `routes/_authenticated/help/index.tsx` | `/help` | Help home |
| `routes/_authenticated/help/ask.tsx` | `/help/ask` | Create request (live AI suggestion + fare estimate) |
| `routes/_authenticated/help/nearby.tsx` | `/help/nearby` | Map + list of nearby open requests |
| `routes/_authenticated/help/requests.$id.tsx` | `/help/requests/:id` | Request detail: chat, status actions, tracking, payment |
| `routes/_authenticated/help/dashboard.tsx` | `/help/dashboard` | "My requests" vs "My accepted tasks" |
| `routes/_authenticated/help/profile.tsx` | `/help/profile` | Profile + wallet + earnings |
| `routes/_authenticated/skills/route.tsx` | — | Skills product shell |
| `routes/_authenticated/skills/index.tsx` | `/skills` | Skills home |
| `routes/_authenticated/skills/learn.tsx` | `/skills/learn` | Browse nearby / online teachers |
| `routes/_authenticated/skills/teach.tsx` | `/skills/teach` | Teacher profile + offerings + availability editor |
| `routes/_authenticated/skills/teacher.$teacherId.tsx` | `/skills/teacher/:id` | Teacher detail + booking flow |
| `routes/_authenticated/skills/bookings.tsx` | `/skills/bookings` | Learner + teacher booking dashboards |
| `routes/_authenticated/skills/profile.tsx` | `/skills/profile` | Skills-side profile |
| `routes/_authenticated/admin/trust.tsx` | trust queue | Verification / report moderation (legacy path) |
| `routes/_authenticated/dev.tsx` | `/dev` | **Hidden debug harness** — seed users, simulate payments, exercise every server fn |
| `routes/admin/route.tsx` | — | Admin gate: session **and** `profiles.is_admin = true` |
| `routes/admin/login.tsx` | `/admin/login` | Admin sign-in |
| `routes/admin/index.tsx` | `/admin` | Analytics dashboard (recharts) |
| `routes/admin/users.tsx` | `/admin/users` | Search / suspend / promote members |
| `routes/admin/teachers.tsx` | `/admin/teachers` | Teacher moderation + earnings |
| `routes/admin/helpers.tsx` | `/admin/helpers` | Helper performance + moderation |
| `routes/admin/categories.tsx` | `/admin/categories` | Community category suggestion queue |
| `routes/admin/reports.tsx` | `/admin/reports` | ID verifications + abuse reports |
| `routes/admin/finance.tsx` | `/admin/finance` | Payments, payouts, wallets, CSV export |
| `routes/admin/settings.tsx` | `/admin/settings` | Maintenance mode, pricing rules, announcements |
| `routes/api/public/razorpay-webhook.ts` | `/api/public/razorpay-webhook` | Raw HTTP route, HMAC-verified (dormant; simulation active) |

### Backend — `src/lib/hoodi/`

Three file-naming conventions, and they matter:

| Suffix | Runs where | Rule |
|---|---|---|
| `*.functions.ts` | Server, callable from client | Contains `createServerFn` declarations only. Client-importable. |
| `*.server.ts` | Server only | Never reaches the browser bundle. Secrets live here. |
| plain `*.ts` | Both | Pure helpers/types, no secrets. |

| File | Contents |
|---|---|
| `requests.functions.ts` | Help request lifecycle: create (AI + fare), nearby search, accept, status, delete |
| `bookings.functions.ts` | Skills booking lifecycle + payment release + rating |
| `skills.functions.ts` | Teacher profiles, offerings, browse, dashboards |
| `profiles.functions.ts` | Own/public profile, offer tags, stats, reviews |
| `chat.functions.ts` | Threads + messages for requests and bookings |
| `payments.functions.ts` | `simulateCapturePayment`, payment history |
| `wallet.functions.ts` | Wallet balance, payouts, earnings |
| `notifications.functions.ts` | List / mark read |
| `trust.functions.ts` | Verifications, reports, blocks, privacy-first phone reveal, admin trust queue |
| `tracking.functions.ts` | Live helper location, ETA, delivery stage |
| `location.functions.ts` | Geocode / search / save location (wraps Geoapify) |
| `categories.functions.ts` | Category suggestions + admin decisions |
| `ratings.functions.ts` | Ratings and summaries |
| `admin.functions.ts` | Entire admin console API |
| `public.functions.ts` | Unauthenticated reads for the landing page |
| `admin.server.ts` | `assertAdmin()`, `haversineMeters()`, `etaMinutes()` |
| `geoapify.server.ts` | Geoapify HTTP client (holds the API key) |
| `availability.ts`, `location.ts`, `tracking.ts`, `format.ts`, `request-types.ts`, `profile-media.ts`, `verification-media.ts` | Shared pure helpers / types |

### Supabase — `src/integrations/supabase/` (generated; do not hand-edit)

| File | Purpose |
|---|---|
| `client.ts` | Browser client (publishable key + user session). **RLS applies.** |
| `client.server.ts` | `supabaseAdmin` — service-role client. **Bypasses RLS.** Server only. |
| `auth-middleware.ts` | `requireSupabaseAuth` — validates bearer token, injects `supabase`, `userId`, `claims` |
| `auth-attacher.ts` | Client middleware attaching the bearer token to every server-fn call |
| `types.ts` | Generated TypeScript types for the whole schema |

Regenerate after schema changes:
`supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`

### Components — `src/components/hoodi/`

`AdminShell` (admin nav) · `ProductShell` (Help/Skills nav) · `Primitives` (shared design-system pieces) · `HoodiLogo` · `RequestCard` · `UrgencyBadge` · `SessionChat` · `NotificationBell` · `HoodiMap` / `LeafletMap` (Leaflet wrapper, client-only) · `LocationGate` / `LocationField` / `LocationPicker` / `LocationSearch` · `BusinessSearch` (Geoapify Places) · `ProfileView` / `ProfileHero` / `Identity` · `TrustBadges` / `VerificationCenter` / `ContactReveal` / `ReportUserMenu` · `SuggestCategory`.

### Hooks — `src/hooks/`

| Hook | Purpose |
|---|---|
| `use-session-ready.ts` | Waits for Supabase session hydration before firing authed calls (prevents "No authorization header provided") |
| `use-hoodi-location.ts` | Browser geolocation + saved location state |
| `use-trust.ts` | Trust score / verification badges |
| `use-mobile.tsx` | Responsive breakpoint helper |

### Utilities / Database / Assets

- **Utilities:** `src/lib/utils.ts` (`cn`), `src/lib/error-capture.ts` + `error-page.ts` (SSR error handling), `src/lib/hoodi/format.ts` (currency / date / distance formatting).
- **Database:** `supabase/migrations/*.sql` — the single source of truth for schema, RLS, RPCs and triggers. Every change is a new timestamped file.
- **Assets:** `public/` for static files (e.g. `hoodi-mark.svg`); imported images belong in `src/assets/` as ES imports so Vite fingerprints them.

---

## 2. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **>= 22 LTS** | Vite 8 / React 19 need modern Node. `nvm install 22` |
| **Bun** | **>= 1.2** | Preferred package manager and runner: `curl -fsSL https://bun.sh/install | bash` |
| npm / pnpm / yarn | recent | Optional alternative to Bun; npm >= 10 |
| **Git** | >= 2.40 | |
| **Supabase CLI** | >= 2.x | *Optional* — only for local Postgres, migrations, type generation |
| **Docker Desktop** | latest | *Optional* — required only by `supabase start` |
| VS Code extensions | — | ESLint, Prettier, Tailwind CSS IntelliSense |

Environment variables: see §4. Nothing else is needed to boot against the hosted database.

---

## 3. Installation

```bash
# 1. Clone
git clone <your-git-remote-url> hoodi
cd hoodi

# 2. Install dependencies (Bun — recommended)
bun install
# ...or npm
npm install

# 3. Create your env file
cp .env.example .env      # if absent, create .env manually using §4

# 4. Optional: Supabase CLI
npm i -g supabase
supabase --version
supabase login
supabase link --project-ref <your-project-ref>

# 5. Run
bun run dev               # http://localhost:8080  (npm run dev also works)
```

Note on `bunfig.toml`: `minimumReleaseAge = 86400` blocks packages published in the last 24 h (supply-chain guard). Keep it; extend `minimumReleaseAgeExcludes` only deliberately.

---

## 4. Environment Variables

Create `.env` in the project root. **Nothing is hidden — this is the complete list.**

```dotenv
# ---- Client-visible (bundled into the browser; safe, publishable) ----
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon / publishable key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"

# ---- Server-only (never VITE_ prefixed, never sent to the browser) ----
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<anon / publishable key>"
SUPABASE_PROJECT_ID="<project-ref>"
SUPABASE_SERVICE_ROLE_KEY="<service role key — SECRET>"

# ---- Third-party ----
GEOAPIFY_API_KEY="<geoapify key>"
AI_PROVIDER="openai"                        # openai | anthropic | google
AI_MODEL=""                                 # optional model override
OPENAI_API_KEY="<openai api key>"           # or ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
RAZORPAY_WEBHOOK_SECRET="<webhook secret>"  # only when real Razorpay is enabled
```

| Variable | Used by | Where it comes from |
|---|---|---|
| `VITE_SUPABASE_URL` | `integrations/supabase/client.ts` (browser) | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client | Same page → `anon` / publishable key |
| `VITE_SUPABASE_PROJECT_ID` | tooling / type generation | The project ref inside your Supabase URL |
| `SUPABASE_URL` | server functions, SSR fallback | Same as above |
| `SUPABASE_PUBLISHABLE_KEY` | `requireSupabaseAuth`, public server reads | Same as above |
| `SUPABASE_PROJECT_ID` | tooling | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts` (`supabaseAdmin`) — admin fns, payment capture, moderation | Supabase dashboard → API → `service_role` key. **Never commit, never expose to the browser.** |
| `GEOAPIFY_API_KEY` | `lib/hoodi/geoapify.server.ts` → geocoding, autocomplete, Places business search | https://myprojects.geoapify.com — free tier ≈3 000 req/day |
| `AI_PROVIDER` / `AI_MODEL` | `lib/ai-provider.server.ts` | Selects provider (`openai` default) and optional model id |
| `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`) | `lib/ai-provider.server.ts` → AI category/urgency suggestion on request creation | https://platform.openai.com/api-keys (or the matching provider console). If unset, classification silently falls back to `other` / `normal` with confidence 0 |
| `RAZORPAY_WEBHOOK_SECRET` | `routes/api/public/razorpay-webhook.ts` HMAC verification | Razorpay dashboard → Settings → Webhooks. Currently dormant |

Rules: `import.meta.env.VITE_*` in browser code; `process.env.X` **inside handlers only**, never at module scope. Keep `.env` in `.gitignore` and commit a `.env.example` with empty values.

---

## 5. Local Database

**Today: hosted Supabase.** The app talks to a managed Supabase Postgres (with **PostGIS**) over HTTPS. There is no local database — point `.env` at the hosted project and you are running.

### Option A — Hosted (recommended, zero setup)

Put the hosted URL + keys in `.env` and run `bun run dev`. Your machine and any deployment share the same DB — careful, this is live data.

### Option B — Local Supabase (isolated dev DB)

```bash
supabase start                 # Postgres + Auth + Storage + Studio in Docker
supabase db reset              # replays every file in supabase/migrations/
```

`supabase start` prints a local API URL (`http://127.0.0.1:54321`) plus anon and service_role keys — put those in `.env` (both `VITE_*` and server variants). Studio: http://127.0.0.1:54323.

The migrations create the `postgis` extension themselves, so a reset reproduces schema, RLS, RPCs and triggers. You must recreate the storage buckets (`profile-media`, `verification-docs`) and re-seed `pricing_rules` locally if no migration does it.

### Working with migrations

```bash
supabase migration new add_something      # timestamped empty SQL file
# edit it, then:
supabase db reset                         # apply locally
supabase db push                          # apply to the linked hosted project
supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
```

**Every new `public` table needs, in this order:** `CREATE TABLE` → `GRANT` (to `authenticated`, `service_role`, and `anon` only if a policy allows anon) → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`. Skipping the GRANT gives "permission denied" at runtime even with correct policies.

---

## 6. Running the Project

| Command | What it does |
|---|---|
| `bun run dev` | Dev server with HMR at **http://localhost:8080** |
| `bun run build` | Production build (SSR + client bundles) |
| `bun run build:dev` | Build in development mode — fastest way to catch prerender errors |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | ESLint over the repo |
| `bun run format` | Prettier write |
| `bunx tsc --noEmit` | Type check |

All work with `npm run …` too. The port is **8080**, not Vite's default 5173.

---

## 7. Admin Login

There is **no separate admin credential store**. Admins are ordinary Supabase Auth users with a flag on their profile.

**Current admin:** `gctrupti.amcec@gmail.com` / `Lucky@123@@` (email pre-confirmed, `is_admin = true`). Change this password before any public deployment.

### How it works

1. User signs in at `/admin/login` with email + password → Supabase Auth issues a JWT.
2. `src/routes/admin/route.tsx` `beforeLoad` runs client-side (`ssr:false`): `supabase.auth.getUser()`, then reads `profiles.is_admin`. No user → redirect `/admin/login`. Not admin → `/admin/login?denied=1`.
3. **That guard is UI only.** Real enforcement is server-side: every admin server function calls `assertAdmin(context.supabase, context.userId)` from `src/lib/hoodi/admin.server.ts`, which re-reads `profiles.is_admin` through the caller's own RLS-scoped client and throws `Forbidden` otherwise. Only then does it load `supabaseAdmin`.
4. Postgres also has an `is_admin(_user_id uuid)` SECURITY DEFINER function used inside RLS policies for admin-visible rows.

### Promote a user to admin

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'someone@example.com');
```

Demote with `false`. Or use `/admin/users` → toggle admin (backed by `adminSetUserFlags`).

### Create an admin from scratch

```bash
curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<strong-password>","email_confirm":true}'
```

A `handle_new_user` trigger creates the `profiles` row automatically; then run the SQL above.

> **Security note:** roles currently live on `profiles.is_admin`. The hardened pattern is a separate `user_roles` table + `has_role()` SECURITY DEFINER function, so no profile-write path can escalate privileges. Recommended before production (§13).

---

## 8. API Documentation

All backend functions are `createServerFn` exports in `src/lib/hoodi/`. Call them from React with `useServerFn(fn)` inside `useQuery` / `useMutation`, or `fn({ data: {...} })` directly.

**Authentication legend**

- **Auth** — `.middleware([requireSupabaseAuth])`; 401 without a bearer token; runs as the user, RLS applies.
- **Admin** — auth + `assertAdmin()`; then uses `supabaseAdmin` (RLS bypassed).
- **Public** — no auth; safe for SSR/prerender and public route loaders.

### `requests.functions.ts` — Hoodi Help

| Function | Auth | Input | Output | Tables / RPCs |
|---|---|---|---|---|
| `createHelpRequest` | Auth | title, description, request_type, category, urgency, is_paid, photo, pickup/dropoff coords + addresses | created request row (AI suggestion + estimated fare) | `help_requests`, `pricing_rules`, AI gateway, trigger `notify_nearby_helpers` → `notifications` |
| `listNearbyRequests` | Auth | lat, lng, radius_m, category?, urgency? | open requests + distance, sorted | RPC `nearby_open_requests` (PostGIS) |
| `acceptRequest` | Auth | requestId | updated request + payment row for paid requests | RPC `accept_help_request`, `payments` (`sim_order_<uuid>`), `notifications` |
| `updateRequestStatus` | Auth | requestId, status | updated row | `help_requests`, `request_status_history`, `notifications` |
| `deleteRequest` | Auth | requestId | `{ ok }` | `help_requests` (owner + `open` only) |
| `getRequest` | Auth | id | request + counterparty profile | `help_requests`, `profiles` |
| `listMyRequests` | Auth | — | `{ asRequester, asHelper }` | `help_requests` |

### `bookings.functions.ts` — Hoodi Skills

| Function | Auth | Input | Output | Tables |
|---|---|---|---|---|
| `bookSession` | Auth | offeringId, scheduled_at, notes | booking row | `skill_offerings`, `teacher_profiles`, `skill_bookings`, `payments`, `notifications` |
| `confirmBooking` | Auth | bookingId | updated booking | `skill_bookings`, `notifications` |
| `cancelBooking` | Auth | bookingId, reason? | updated booking | `skill_bookings`, `notifications` |
| `completeBooking` | Auth | bookingId | updated booking | `skill_bookings`, `notifications` |
| `releaseBookingPayment` | Auth | bookingId | payment + wallet result | RPC `capture_booking_payment`, `payments`, `wallets` |
| `listMyBookings` | Auth | — | `{ asLearner, asTeacher }` | `skill_bookings`, `skill_offerings`, `profiles` |
| `rateSession` | Auth | bookingId, score, comment? | `{ ok }` | `ratings` |

### `skills.functions.ts`

`getMyTeacherProfile` · `upsertMyTeacherProfile` (headline, bio, hourly_rate, teaching_mode, experience, availability JSON, location) · `listMyOfferings` · `createOffering` / `updateOffering` / `deleteOffering` · `browseTeachers` (lat, lng, radius, mode, category, search → teachers + distance via RPC `nearby_teachers`) · `getTeacherDetail` · `getTeacherPublicProfile` · `getTeacherDashboard` · `getLearnerDashboard`. All **Auth**. Tables: `teacher_profiles`, `skill_offerings`, `skill_bookings`, `profiles`, `ratings`.

### `profiles.functions.ts`

`getMyProfile` · `updateMyProfile` (name, bio, phone, photo, cover) · `updateMyLocation` · `addOfferTag` / `removeOfferTag` (`user_offer_tags`) · `getPublicProfile` (privacy-filtered) · `getProfileStats` (RPC `profile_stats`) · `listReviewsForUser` (`ratings`). All **Auth**.

### `chat.functions.ts`

`getThreadForRequest` / `getThreadForBooking` (find-or-create, party check via `is_request_party` / `is_booking_party`) · `listMessages` (marks unread as read) · `sendMessage` → `chat_messages` + `notifications`. All **Auth**. Live updates use Supabase Realtime on `chat_messages`.

### `payments.functions.ts` & `wallet.functions.ts`

| Function | Auth | Input | Output | Notes |
|---|---|---|---|---|
| `simulateCapturePayment` | Auth | requestId | capture result | Authorizes the caller, then `supabaseAdmin.rpc('capture_payment')`: marks payment released, computes commission from `pricing_rules`, credits the helper's `wallets` row, writes `final_fare` + `commission_amount` back onto `help_requests`. Swapping in real Razorpay later replaces only the trigger — the money logic is unchanged. |
| `listMyPayments` | Auth | — | payment history | `payments` |
| `getMyWallet` | Auth | — | balance | `wallets` |
| `getWalletSummary` | Auth | — | totals | `wallets`, `payments` |
| `listMyEarnings` | Auth | — | completed-job earnings | `help_requests`, `skill_bookings` |
| `requestPayout` | Auth | amount | payout row | `payouts` (status `requested`) |
| `listMyPayouts` | Auth | — | payout history | `payouts` |

### `notifications.functions.ts`

`listMyNotifications` · `markNotificationRead` (id) · `markAllNotificationsRead` → `notifications`. All **Auth**. The bell badge subscribes via Realtime.

### `trust.functions.ts`

**Auth:** `getTrust` / `getTrustBatch` (trust score + badges) · `getCounterpartyPhone` (RPC `counterparty_phone` — reveals a phone number **only** to an active counterparty on a shared request/booking) · `listMyVerifications` / `submitVerification` (uploads to `verification-docs` → `user_verifications`) · `reportUser` (`user_reports`) · `blockUser` / `unblockUser` / `listMyBlocks` (`user_blocks`).
**Admin:** `adminListVerifications`, `adminVerificationDocUrl` (short-lived signed URL), `adminDecideVerification`, `adminListReports`, `adminResolveReport`.

### `tracking.functions.ts`

`pushHelperLocation` (requestId, lat, lng, heading, speed → upserts `request_tracking`, computes distance + ETA via `haversineMeters` / `etaMinutes`) · `getRequestTracking` · `setDeliveryStage` (`help_requests.delivery_stage`). All **Auth**. Consumers subscribe to `request_tracking` via Realtime.

### `location.functions.ts`

`reverseGeocodeLocation` · `searchPlaces` (autocomplete) · `searchBusinessPlaces` (Geoapify Places by category) · `getMyLocation` / `saveMyLocation` (`profiles`) · `saveTeachingLocation` (`teacher_profiles`). All **Auth**, all through `geoapify.server.ts` — the key never reaches the browser.

### `categories.functions.ts` & `ratings.functions.ts`

`suggestCategory`, `listCategorySuggestions` (Auth); `adminListCategorySuggestions`, `adminDecideCategory` (Admin) → `category_suggestions`. `submitRating`, `getUserRatingSummary` (Auth) → `ratings`.

### `admin.functions.ts` — all **Admin** except `adminAmIAdmin` (Auth)

`adminOverview` (RPC `admin_overview` — dashboard KPIs) · `adminAmIAdmin` · `adminListUsers` (search) · `adminSetUserFlags` (is_active / is_admin / phone_verified) · `adminListTeachers` · `adminListHelpers` · `adminListRequests` (status filter) · `adminListBookings` · `adminFinance` (payments + payouts + wallets joined to names) · `adminSetPayoutStatus` (RPC `admin_set_payout_status`) · `adminGetSettings` · `adminSetSetting` (`platform_settings` upsert) · `adminUpdatePricingRule` (`pricing_rules`) · `adminSaveAnnouncement` / `adminDeleteAnnouncement` (`announcements`).

### `public.functions.ts` — **Public**

`listRecentOpenPreview` (anonymised recent open requests for the landing page) · `publicStats` (aggregate counts). These are the only functions safe to call from a public route loader.

### HTTP route

`POST /api/public/razorpay-webhook` — verifies the `x-razorpay-signature` HMAC against `RAZORPAY_WEBHOOK_SECRET`, then calls the same `capture_payment` RPC. Wired, dormant.

---

## 9. Database Schema

Postgres + **PostGIS**. `auth.users` is Supabase-managed; everything else lives in `public`.

### Identity

**`auth.users`** (managed) — email, encrypted password, confirmation state. The `handle_new_user` trigger creates the matching profile.

**`profiles`** — `id` (PK, FK → `auth.users.id`), `name`, `phone_number`, `phone_verified`, `bio`, `profile_photo_url`, `cover_image_url`, `is_admin`, `is_active`, `location` (geography Point), `latitude`, `longitude`, `city`, `state`, `country`, `formatted_address`, `location_updated_at`, timestamps. The hub every other table points at.

**`user_offer_tags`** — skills/services a member offers. FK → `profiles`.

### Trust & safety

**`user_verifications`** — `user_id` → `profiles`, doc type, storage path in `verification-docs`, status (pending/approved/rejected), reviewer, timestamps.
**`user_reports`** — reporter → `profiles`, reported user, reason, status, resolver.
**`user_blocks`** — blocker / blocked pair → `profiles`.
**`moderation_flags`** — generic `target_type` + `target_id` flags with resolved state.

### Hoodi Help

**`help_requests`** — `requester_id` → `profiles`, `helper_id` → `profiles` (null until accepted), `title`, `description`, `request_type` (enum), `category` (enum), `urgency` (enum), `status` (open → accepted → in_progress → completed / cancelled), `ai_suggested_category`, `ai_suggested_urgency`, `ai_confidence`, `is_paid`, `estimated_fare`, `final_fare`, `commission_amount`, `payment_id` → `payments`, `photo_url`, `location` (geography), `address_text`, pickup/dropoff (`_name`, `_address`, `_lat`, `_lng`), `delivery_stage` (enum), lifecycle timestamps.

**`request_status_history`** — append-only audit: `request_id`, `old_status`, `new_status`, `changed_by`. Written by the `log_status_change` trigger.

**`request_tracking`** — one row per active request: `request_id` (PK) → `help_requests`, `helper_id`, lat/lng, `heading`, `speed`, `eta_minutes`, `distance_meters`.

### Hoodi Skills

**`teacher_profiles`** — `user_id` (PK) → `profiles`, headline, bio, `hourly_rate`, `teaching_mode` (online/offline/both), `experience_years`, availability, `city`, geolocation, `is_published`.
**`skill_offerings`** — `teacher_id` → `teacher_profiles`, title, description, category, `price_per_session`, `duration_minutes`, `is_published`.
**`skill_bookings`** — `offering_id` → `skill_offerings`, `teacher_id` + `learner_id` → `profiles`, `scheduled_at`, `duration_minutes`, `price`, `commission_amount`, `status` (pending → confirmed → completed / cancelled), `notes`, `payment_id`, cancel/complete metadata.

### Money

**`payments`** — `request_id` → `help_requests` **or** `booking_id` → `skill_bookings` (exactly one), `payer_id`, `razorpay_order_id` (`sim_order_*` in simulation), `razorpay_payment_id`, `amount`, `status` (pending → released / failed / refunded).
**`wallets`** — `user_id` (unique) → `profiles`, `balance`. Credited by `capture_payment` / `capture_booking_payment` net of commission.
**`payouts`** — `wallet_id` → `wallets`, `amount`, `status` (requested → approved → paid / rejected), timestamps.
**`pricing_rules`** — per `category`: `base_fee`, `rate_per_km`, `commission_rate`. Drives fare estimation *and* commission at capture time.

### Communication

**`chat_threads`** — one per `request_id` or `booking_id`.
**`chat_messages`** — `thread_id` → `chat_threads`, `sender_id` → `profiles`, `content`, `read_at` (read receipts).
**`notifications`** — `user_id` → `profiles`, `type` (enum), `request_id` / `booking_id`, `message`, `is_read`.
**`ratings`** — `rater_id` / `ratee_id` → `profiles`, `request_id` **or** `booking_id`, `score` (1–5), `comment`.

### Platform

**`category_suggestions`** — member-proposed categories: `suggested_by`, `module` (help/skills), `name`, `note`, `status`, reviewer.
**`announcements`** — `title`, `body`, `audience` (all/help/skills), `is_active`, `created_by`.
**`platform_settings`** — `key` (PK) + `value` (jsonb): maintenance mode etc.
**`spatial_ref_sys`** — PostGIS internal; ignore.

### Relationship map

```
auth.users 1─1 profiles
profiles 1─* help_requests (requester_id, helper_id)
profiles 1─1 wallets 1─* payouts
profiles 1─1 teacher_profiles 1─* skill_offerings 1─* skill_bookings
profiles 1─* user_offer_tags / user_verifications / user_reports / user_blocks
help_requests 1─1 request_tracking
help_requests 1─* request_status_history
help_requests 1─1 chat_threads 1─* chat_messages
skill_bookings 1─1 chat_threads
help_requests | skill_bookings 1─1 payments  → credits wallets
help_requests | skill_bookings 1─* ratings, notifications
pricing_rules ── drives ──> fare estimate + commission
```

### Key database functions (RPCs / triggers)

| Name | Kind | Purpose |
|---|---|---|
| `handle_new_user()` | trigger | Creates `profiles` (+ wallet) on signup |
| `notify_nearby_helpers()` | trigger | On a new open request, inserts `notifications` for helpers within radius |
| `log_status_change()` | trigger | Writes `request_status_history` |
| `accept_help_request(_request_id, _order_id)` | RPC | Atomic accept + payment row creation |
| `nearby_open_requests(_lat,_lng,_radius_m,_category,_urgency)` | RPC | PostGIS radius search |
| `nearby_teachers(_lat,_lng,_radius_m)` | RPC | PostGIS teacher search |
| `capture_payment(_payment_id,_razorpay_payment_id)` | RPC | Release payment, commission from `pricing_rules`, credit wallet, write back `final_fare` / `commission_amount` |
| `capture_booking_payment(_payment_id,_external_payment_id)` | RPC | Same for Skills |
| `admin_overview()` | RPC | Dashboard KPI aggregate |
| `admin_set_payout_status(_payout_id,_new_status)` | RPC | Payout state machine |
| `profile_stats(_user_id)` | RPC | Completed jobs, ratings, earnings |
| `counterparty_phone(_other_id)` | RPC | Privacy-first phone reveal |
| `is_admin(_user_id)`, `is_request_party(...)`, `is_booking_party(...)`, `is_thread_party(...)` | SECURITY DEFINER | Used inside RLS policies to avoid recursion |
| `insert_notification(...)`, `insert_booking_notification(...)` | helper | Notification writes from triggers / RPCs |

### Storage buckets

`profile-media` (avatars + covers, public read) · `verification-docs` (private; admins read via short-lived signed URLs from `adminVerificationDocUrl`).

---

## 10. External Services

| Service | Used for | Where in code | Key |
|---|---|---|---|
| **Supabase** | Postgres + PostGIS, Auth (email/password), Storage, Realtime, RLS | `src/integrations/supabase/*`, every `*.functions.ts` | `SUPABASE_*`, `VITE_SUPABASE_*` |
| **Geoapify** | Forward + reverse geocoding, address autocomplete, Places (business search) | `lib/hoodi/geoapify.server.ts` ← `location.functions.ts` ← `LocationSearch` / `LocationPicker` / `BusinessSearch` | `GEOAPIFY_API_KEY` |
| **Leaflet + OpenStreetMap tiles** | Map rendering (client-side, no key) | `components/hoodi/LeafletMap.tsx`, `HoodiMap.tsx` | none |
| **AI provider** | Category + urgency suggestion and confidence at request creation | `src/lib/ai-provider.server.ts` ← `requests.functions.ts` | `OPENAI_API_KEY` (or Anthropic / Gemini key, chosen by `AI_PROVIDER`) |
| **Anthropic / OpenAI** | The model behind the gateway. Direct SDK use is a one-file change | same file | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` once switched |
| **Razorpay** | Real payments — **not active**. Route + HMAC verification implemented and dormant; `simulateCapturePayment` drives the money logic today | `routes/api/public/razorpay-webhook.ts`, `payments.functions.ts` | `RAZORPAY_WEBHOOK_SECRET`, plus key id/secret when enabled |
| **Google Maps** | **Not used.** Geoapify + Leaflet cover geocoding and maps | — | — |

---

## 11. Local Development Workflow

```
1. Database    supabase migration new <name> → write SQL (TABLE → GRANT → RLS → POLICY)
      ↓        supabase db reset (local) or supabase db push (hosted)
2. Types       supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
      ↓
3. Backend     add a createServerFn in src/lib/hoodi/<domain>.functions.ts
      ↓        validate input with zod · requireSupabaseAuth for user data
               assertAdmin + supabaseAdmin only for privileged work
4. Frontend    add/extend a route in src/routes/ · call it with useServerFn +
      ↓        useQuery/useMutation · build UI from components/ui + components/hoodi
5. Test        bun run dev → exercise the flow · use /dev to seed two test users
      ↓        and simulate payments
6. Verify      bunx tsc --noEmit && bun run lint && bun run build
      ↓
7. Commit      git add -A && git commit -m "feat(skills): ..." && git push
```

Conventions worth keeping:

- **A `*.functions.ts` file must be a thin wrapper** — imports, types and `createServerFn` exports only. Runtime helpers go into a sibling module or inside the handler; otherwise server-function splitting drops them and you get a runtime `ReferenceError` that typecheck won't catch.
- Read secrets **inside** handlers, never at module scope.
- Never import a `*.server.ts` from a component — use `await import()` inside a handler.
- Never edit `src/routeTree.gen.ts` or the generated `src/integrations/supabase/*` files.
- Browser-only libraries (Leaflet) must be dynamically imported / client-gated, or SSR breaks.
- Colors come from tokens in `src/styles.css`; no hardcoded `bg-[#...]` / `text-white`.
- Branch per feature, PR into `main`.

---

## 12. Deployment

### Today

Hosted by Lovable: `bun run build` produces a **Cloudflare Workers** bundle (Nitro, configured inside `@lovable.dev/vite-tanstack-config`), with the Supabase project managed alongside. Frontend changes go live on publish; database migrations apply immediately.

### Deploying it yourself

Database and app can be hosted separately. Keep Supabase where it is — it is a normal Supabase project — and move only the app.

**Option A — Cloudflare Workers/Pages (closest to current, no config change)**

```bash
bun run build
bunx wrangler deploy        # or connect the repo in the Cloudflare dashboard
```
Set every server env var as a Worker secret: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, etc.

**Option B — Vercel**

Import the repo; build command `bun run build`. Select the Vercel Nitro preset in `vite.config.ts`:
```ts
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  nitro: { preset: "vercel" },
});
```
Add all env vars under Project Settings → Environment Variables (server ones not exposed to the client).

**Option C — Netlify** — same, with `preset: "netlify"`; env vars in Site settings.

**Option D — Railway / Render / Fly.io / any Node host** — use `preset: "node-server"`:
```bash
bun run build
node .output/server/index.mjs      # start command
```
Set `PORT` and all env vars in the dashboard.

**Supabase** — already independent. To move it into your own org (or self-host): create a project, `supabase db push` the migrations, recreate the two storage buckets, seed `pricing_rules`, repoint `.env`.

Pre-launch checklist: rotate the service-role key and the admin password · confirm RLS is enabled on every public table · set Auth site/redirect URLs to your domain · keep anonymous signups disabled · switch payment simulation to real Razorpay · add error monitoring (Sentry).

---

## 13. Future Development — becoming Lovable-independent

The codebase is already a plain React + Supabase app. Four Lovable touch-points remain; all are small and optional.

**1. Build config** — `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, a preset bundling TanStack Start, React, Tailwind v4, tsconfig-paths, Nitro and env injection. It works fine off-platform. To remove it:
```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 8080 },
  plugins: [tsConfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
  resolve: { alias: { "@": "/src" } },
});
```
Then drop the `@lovable.dev/*` dependencies and the `bunfig.toml` exclude list.

**2. AI provider** — already provider-agnostic: `src/lib/ai-provider.server.ts` builds a Vercel AI SDK model from `AI_PROVIDER` (`openai` / `anthropic` / `google`) using the official `@ai-sdk/*` provider packages. Switching providers is an env change; no app code changes.
```ts
import Anthropic from "@anthropic-ai/sdk";
// inside the handler:
const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"]! });
```

**3. Error reporting** — `src/lib/lovable-error-reporting.ts` and `src/lib/error-capture.ts` can be deleted or swapped for Sentry.

**4. Supabase ownership** — a standard Supabase project; the migrations recreate it anywhere.

### Recommended next steps

1. **Harden roles** — move `is_admin` into a `user_roles` table + `has_role()` SECURITY DEFINER function, and update every `assertAdmin` and RLS policy. Prevents privilege escalation via any profile-write path.
2. **Real payments** — plug in Razorpay: create real orders on accept, point the live webhook at `/api/public/razorpay-webhook`, leave `capture_payment` untouched. Then implement real payout disbursement (RazorpayX) behind `admin_set_payout_status`.
3. **Tests** — Vitest for pure logic (fare, haversine, availability); Playwright for the request → accept → chat → complete → pay flow.
4. **CI** — GitHub Actions running `tsc --noEmit`, `eslint`, `vite build`, and `supabase db push` on merge to `main`.
5. **Observability** — Sentry + Supabase log drains; alert on failed captures.
6. **Product** — push notifications (web push / FCM), phone OTP verification, dispute resolution, teacher calendar sync, i18n, PWA/offline.
7. **Performance** — indexes on hot filters (`help_requests(status, created_at)`, GiST on geography columns), pagination on admin lists, image transforms on Supabase Storage.

### VS Code setup

Install ESLint, Prettier and Tailwind CSS IntelliSense, then add `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Daily loop

```bash
git pull
bun install
bun run dev
# ...build the feature (§11)...
bunx tsc --noEmit && bun run lint && bun run build
git commit -am "feat: ..." && git push
```

That is the whole handoff — from here Hoodi is a normal React + Supabase application you own end to end.
