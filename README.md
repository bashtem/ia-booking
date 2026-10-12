# ia-booking

Fastify API in TypeScript. The process entry only listens; tests and scripts build the same app through `buildApp()`.

## Layout

```
infra/dev/compose.yaml              local Postgres 17
infra/dev/postgres/init/            SQL run once on an empty dev volume
infra/production/compose.yaml       production Postgres 17
infra/production/.env.example       required production database settings
infra/production/postgres/init/     SQL run once on an empty production volume
drizzle.config.ts                   Drizzle Kit config
drizzle/                            committed SQL migrations
src/
  server.ts                         process entry: listen and graceful shutdown
  app.ts                            buildApp() factory
  config/env.ts                     validated environment
  db/client.ts                      pool, Drizzle client, and withDatabase()
  db/cli.ts                         direct-run guard shared by migrate and seed
  db/migrate.ts                     applies drizzle/
  db/seed.ts                        loads fixture advisors and windows
  db/seed-data.ts                   November 2026 advisor availability
  db/schema/                        one module per table, shared timestamps, re-exported from index.ts
  plugins/database.ts               decorates app.db and closes the pool on shutdown
  plugins/                          other Fastify plugins
  routes/                           HTTP route modules
  types/fastify.d.ts                Fastify instance augmentation
test/                               node:test suites
```

Add a feature by creating `src/routes/<feature>.ts` and registering it from `src/routes/index.ts`. When a feature needs schemas or a service, grow that file into `src/routes/<feature>/`. Keep table definitions in `src/db/schema/` and put that feature's queries in its route folder.

`src/plugins/database.ts` opens the pool while the app builds, decorates `app.db`, and calls `pool.end()` on close. The server entry stays limited to listen and shutdown. Advisor windows and active bookings each have an overlap exclusion constraint in `drizzle/`. A booking must sit inside one of that advisor's windows.

## Scripts

This repo uses pnpm. `package.json` pins the version through the `packageManager` field, so Corepack installs that pnpm before the first command.

```bash
corepack enable
pnpm install
pnpm dev           # watch mode; reads .env when present
pnpm test          # API tests via app.inject()
pnpm typecheck
pnpm lint          # Oxlint, including TypeScript diagnostics
pnpm build         # emit dist/ for production
pnpm start         # run the compiled server
pnpm db:up         # start the dev Postgres and wait until it accepts connections
pnpm db:down       # stop the dev Postgres and keep the data volume
pnpm db:generate --name describe_the_change   # write the next SQL migration
pnpm db:migrate    # apply drizzle/ to DATABASE_URL
pnpm db:seed       # load fixture advisors and availability windows
```

Local setup is `pnpm db:up`, then `pnpm db:migrate`, then `pnpm db:seed`, then `pnpm dev`. `pnpm db:seed` writes the two fixture advisors and their November 2026 availability windows into `DATABASE_URL`. Running it again updates advisor names and leaves a window that already starts at the same time. It does not run when `NODE_ENV` is `production`.

Copy `.env.example` to `.env` for local overrides. The dev server, production start, migrations, seed, and Drizzle Kit read that file without overriding variables already set in the environment. Defaults are development on port 3000 with CORS disabled until `CORS_ORIGIN` is set.

`pnpm db:up` starts Postgres 17 on `127.0.0.1:5432` with user `ia`, password `ia`, and database `ia_booking`. The first start also creates `ia_booking_test` and enables `btree_gist` in both databases. Connect tests with `postgres://ia:ia@localhost:5432/ia_booking_test`.

Production uses its own Compose project and data volume. Copy `infra/production/.env.example` to `infra/production/.env` and set `POSTGRES_PASSWORD` before the first start. `pnpm db:up:production` starts that Postgres, and `pnpm db:down:production` stops it and keeps the volume. It listens only on the Compose network, and its first start enables `btree_gist` on `ia_booking`.

`GET /health` returns `{ "status": "ok" }`.
`