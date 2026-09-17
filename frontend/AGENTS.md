# Hoodi Developer Guidelines

Hyperlocal Community Platform:
- **Hoodi Help**: Errand / delivery / home-assistance / transport requests with helper matching within 5km.
- **Hoodi Skills**: Peer-to-peer learning marketplace with teacher slots and session bookings.
- **Hoodi Admin**: Moderation, analytics, users, teachers, helpers, pricing, finance.

Stack:
- **Frontend & Server**: TanStack Start (React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui).
- **Backend**: Server functions in `src/lib/hoodi/*.functions.ts` and routes in `src/routes/api/`.
- **Database & Auth**: Supabase (Postgres + PostGIS + Auth + Realtime + Storage).
