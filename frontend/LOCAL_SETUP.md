# Hoodi — Local Development Setup (Windows + VS Code)

Run the entire app on `localhost` with no dependency on the hosted Lovable editor.
Deep architecture/API reference lives in [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md); this file is the "get it running" guide.

---

## 1. Toolchain versions

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **22.x LTS** (>= 20.19) | Required. Install from nodejs.org or `winget install OpenJS.NodeJS.LTS` |
| Bun | **1.2+** (optional but recommended) | `powershell -c "irm bun.sh/install.ps1 \| iex"`. The repo ships `bun.lock`. |
| npm | 10+ | Works fine if you prefer not to install Bun |
| Git | any recent | |
| Supabase CLI | 2.x (optional) | Only needed for local Postgres or running migrations |

VS Code extensions worth having: ESLint, Prettier, Tailwind CSS IntelliSense.

---

## 2. Install

```powershell
git clone <your-repo-url> hoodi
cd hoodi

# with Bun (preferred — matches bun.lock)
bun install

# or with npm
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` avoids npm complaining about React 19 peer ranges in a few UI packages. Bun does not need it.

---

## 3. Environment variables

Copy the template and fill it in:

```powershell
copy .env.example .env
```

| Variable | Where it runs | Required | What it is |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | ✅ | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | ✅ | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | browser | ✅ | project ref |
| `SUPABASE_URL` | server | ✅ | same URL (SSR + server functions) |
| `SUPABASE_PUBLISHABLE_KEY` | server | ✅ | same anon key |
| `SUPABASE_PROJECT_ID` | server | ✅ | project ref |
| `SUPABASE_SERVICE_ROLE_KEY` | server | ✅ | admin key — bypasses RLS. Never prefix with `VITE_`. |
| `AI_PROVIDER` | server | ➖ | `openai` (default) \| `anthropic` \| `google` |
| `AI_MODEL` | server | ➖ | model override, e.g. `gpt-4o-mini` |
| `OPENAI_API_KEY` | server | ➖ | AI request categorization; app falls back to `other/normal` without it |
| `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | server | ➖ | only for those providers |
| `GEOAPIFY_API_KEY` | server | ✅ for maps/search | geocoding, autocomplete, business search |
| `RAZORPAY_WEBHOOK_SECRET` | server | ➖ | webhook route only; payments run in simulation mode without it |
| `PORT` | server | ➖ | dev port, defaults to `8080` |

`.env` is git-ignored. Restart the dev server after editing it — Vite only reads env at startup.

---

## 4. Supabase setup

### Option A — use the existing hosted project (fastest)

1. Open your Supabase project → **Settings → API**.
2. Copy Project URL → `VITE_SUPABASE_URL` + `SUPABASE_URL`.
3. Copy the `anon`/publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_PUBLISHABLE_KEY`.
4. Copy the `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`.
5. **Auth → URL Configuration**: add `http://localhost:8080` to *Site URL* and *Redirect URLs*, otherwise email/OAuth sign-in bounces back to the old preview domain.

Nothing else is needed — schema, RLS, RPCs, storage buckets and seed data already live in that project, and localhost talks to it directly over HTTPS.

### Option B — fully local Postgres

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db pull          # writes current schema into supabase/migrations
supabase start            # Docker Postgres + Auth + Storage on :54321
```

Then point `.env` at the local stack (`http://127.0.0.1:54321`, keys printed by `supabase start`).
Requires Docker Desktop. PostGIS is included in the Supabase image, which the nearby-search RPCs need.

### Admin account

Admin is just a flag on `profiles`:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Then sign in at `/admin/login` with that account.

---

## 5. OpenAI setup

1. Create a key at <https://platform.openai.com/api-keys>.
2. `.env`:
   ```
   AI_PROVIDER="openai"
   AI_MODEL="gpt-4o-mini"
   OPENAI_API_KEY="sk-..."
   ```
3. Used only server-side by `src/lib/ai-provider.server.ts` for category + urgency classification when creating a help request. If the key is missing or the call fails, the app degrades gracefully to `category: other, urgency: normal, confidence: 0` — it never blocks request creation.
4. To switch providers, change `AI_PROVIDER` and supply the matching key. No code changes.

---

## 6. Geoapify setup

1. Sign up at <https://myprojects.geoapify.com/> (free tier: 3,000 requests/day).
2. Create a project → copy the API key → `GEOAPIFY_API_KEY` in `.env`.
3. Powers geocoding, reverse geocoding, address autocomplete and business (Places) search via `src/lib/hoodi/geoapify.server.ts`. The key stays server-side; the browser never sees it.
4. Map tiles come from OpenStreetMap through Leaflet and need no key.

---

## 7. Running the app

This is a **single full-stack app** — TanStack Start serves the React frontend *and* the server functions/API routes from one process. There is no separate backend to start.

```powershell
bun run dev        # or: npm run dev
```

→ http://localhost:8080

| Script | What it does |
| --- | --- |
| `dev` | frontend + server functions + API routes (one process, HMR) |
| `build` | production build into `.output/` |
| `start` | run the production build: `node .output/server/index.mjs` |
| `preview` | preview the production build |
| `typecheck` | `tsc --noEmit` |
| `lint` / `format` | ESLint / Prettier |
| `dev:standalone` | dev server using the **zero-Lovable** Vite config (see §8) |
| `build:standalone` | production build using that config |

**"Frontend + backend together"** = `bun run dev`. If you want them mentally separated:
- Frontend/UI: `src/routes/**`, `src/components/**`
- Backend: `src/lib/hoodi/*.functions.ts` (server functions), `src/routes/api/**` (HTTP routes), Supabase (Postgres/RPC/RLS/storage)

Production run:

```powershell
bun run build
bun run start
```

---

## 8. Lovable-free configuration

Already done in this repo:

- No Lovable AI Gateway — AI goes through official `@ai-sdk/openai` / `@ai-sdk/anthropic` / `@ai-sdk/google`.
- No `LOVABLE_API_KEY` anywhere in code or `.env.example`.
- `src/lib/lovable-error-reporting.ts` is inert outside the editor (it only calls optional `window` hooks that don't exist locally). Safe to keep or delete.

The only remaining Lovable package is the dev-time Vite preset `@lovable.dev/vite-tanstack-config` (MIT, public on npm — it installs and runs fine offline of Lovable). To drop it entirely:

```powershell
# 1. use the standalone config
bun run dev:standalone

# 2. once happy, make it the default
del vite.config.ts
ren vite.config.standalone.ts vite.config.ts
bun remove @lovable.dev/vite-tanstack-config
rmdir /s /q .lovable
```

`vite.config.standalone.ts` wires the same plugins by hand: `tanstackStart`, `nitro`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-tsconfig-paths`, the `@` alias and port 8080.

---

## 9. Common errors and fixes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Missing Supabase environment variable(s): ...` | `.env` not loaded or misspelled keys | Ensure `.env` is at repo root, both `VITE_` and non-prefixed pairs are set, restart dev server |
| Blank page + `Invalid API key` in console | anon key mismatch with project URL | Re-copy both from Supabase → Settings → API |
| Sign-in redirects to a `*.lovable.app` URL | Supabase Auth redirect URLs | Add `http://localhost:8080` to Site URL + Redirect URLs |
| `Unauthorized: No authorization header provided` | server function called before the session hydrated | Expected on first paint; the `use-session-ready` hook gates it. If persistent, sign out and back in |
| `permission denied for function ...` | calling a privileged RPC without service role | Set `SUPABASE_SERVICE_ROLE_KEY`; those calls go through `client.server.ts` |
| Map/search returns nothing, 401 from Geoapify | `GEOAPIFY_API_KEY` missing or over quota | Add/refresh the key; check quota in the Geoapify dashboard |
| AI always returns category `other` | no `OPENAI_API_KEY`, or provider mismatch | Set the key matching `AI_PROVIDER` |
| `EADDRINUSE :8080` | port taken | `set PORT=3000 && bun run dev`, or kill: `netstat -ano \| findstr :8080` then `taskkill /PID <pid> /F` |
| npm install peer-dependency errors | React 19 peer ranges | `npm install --legacy-peer-deps`, or use Bun |
| `bun` not recognized in PowerShell | PATH not refreshed | Reopen the terminal / VS Code after installing Bun |
| Windows line-ending / script noise on `git status` | CRLF | `git config core.autocrlf true` |
| `supabase start` fails | Docker not running | Start Docker Desktop, retry |
| Stale build weirdness | cached artifacts | `rmdir /s /q node_modules .output .tanstack` then reinstall |

---

## 10. Checklist — "it runs fully on localhost"

- [ ] `bun install` completes
- [ ] `.env` filled from `.env.example`
- [ ] `bun run dev` serves http://localhost:8080
- [ ] Landing page loads, `/auth` sign-up/sign-in works (Supabase reachable)
- [ ] Creating a help request returns a fare estimate (AI optional)
- [ ] Nearby map renders tiles and address search resolves (Geoapify)
- [ ] `/admin/login` works with an `is_admin` account
- [ ] `bun run build && bun run start` serves the production build
