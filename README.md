# ia-booking

Fastify API in TypeScript. The process entry only listens; tests and scripts build the same app through `buildApp()`.

## Layout

```
infra/dev/compose.yaml              local Postgres 17
infra/dev/postgres/init/            SQL run once on an empty dev volume
infra/production/compose.yaml       production Postgres 17
infra/production/.env.example       required production database settings
infra/production/postgres/init/     SQL run once on an empty production volume
drizzle.config.ts            Drizzle Kit config, when migrations exist
drizzle/                     committed SQL migrations
src/
  server.ts                  process entry: listen and graceful shutdown
  app.ts                     buildApp() factory
  config/env.ts              validated environment
  db/
    client.ts                pool and Drizzle client from DATABASE_URL
    schema/                  one module per table, re-exported from index.ts
    migrate.ts               applies drizzle/ for scripts and tests
  plugins/                   cross-cutting Fastify plugins, including database
  routes/                    HTTP route modules
  types/fastify.d.ts         Fastify instance augmentation
test/                        node:test suites
```

Add a feature by creating `src/routes/<feature>.ts` and registering it from `src/routes/index.ts`. When a feature needs schemas or a service, grow that file into `src/routes/<feature>/`. Keep table definitions in `src/db/schema/` and put that feature's queries in its route folder.

`src/plugins/database.ts` should open the pool while the app builds, decorate `app.db`, and call `pool.end()` on close. The server entry stays limited to listen and shutdown.

## Scripts

This repo uses pnpm. `package.json` pins the version through the `packageManager` field, so Corepack installs that pnpm before the first command.

```bash
corepack enable
pnpm install
pnpm dev           # watch mode, loads .env when present
pnpm test          # API tests via app.inject()
pnpm typecheck
pnpm build         # emit dist/ for production
pnpm start         # run the compiled server
pnpm db:up         # start the dev Postgres and wait until it accepts connections
pnpm db:down       # stop the dev Postgres and keep the data volume
```

Copy `.env.example` to `.env` for local overrides. Defaults are development on port 3000 with CORS disabled until `CORS_ORIGIN` is set.

`pnpm db:up` starts Postgres 17 on host port 5432 with user `ia`, password `ia`, and database `ia_booking`. The first start also creates `ia_booking_test` and enables `btree_gist` in both databases. Connect tests with `postgres://ia:ia@localhost:5432/ia_booking_test`.

Production uses its own Compose project and data volume. Copy `infra/production/.env.example` to `infra/production/.env` and set `POSTGRES_PASSWORD` before the first start. `pnpm db:up:production` starts that Postgres, and `pnpm db:down:production` stops it and keeps the volume. It listens only on the Compose network, and its first start enables `btree_gist` on `ia_booking`.

`GET /health` returns `{ "status": "ok" }`.
`