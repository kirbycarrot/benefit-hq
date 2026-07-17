# Benefit HQ

Benefit HQ is a single-workspace benefits renewal application. Authenticated brokerage staff can manage clients and plan years, normalize carrier census workbooks, preview standard benefits charts, and generate branded PowerPoint decks.

All authenticated users share the same clients and plan-year data. Administrators manage user accounts. This is intentional for one internal firm workspace; the current data model is not suitable for hosting unrelated customer organizations in one installation.

## Requirements

- Node.js 20 or newer
- PostgreSQL
- A persistent filesystem location for generated decks and uploaded logos
- A reverse proxy terminating HTTPS in production

## Configuration

Copy `.env.example` to `.env` and replace every placeholder:

```sh
cp .env.example .env
openssl rand -base64 32
```

Required variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `AUTH_SECRET` | Random secret used by Auth.js to sign sessions |
| `BOOTSTRAP_TOKEN` | One-time token required to create the first administrator |
| `STORAGE_DIR` | Persistent private directory for decks and new logos; defaults to `./storage` |

`BOOTSTRAP_TOKEN` should be generated independently from `AUTH_SECRET`. Remove it from the runtime environment after the first administrator has been created. Later users are created by an administrator from **Settings**.

Never commit `.env` files or real credentials.

## Install and initialize

```sh
npm ci
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The development server is available at `http://localhost:3000`.

Open `/register` for the initial setup, then enter the configured `BOOTSTRAP_TOKEN`. First-admin creation is serialized in PostgreSQL, so concurrent setup requests cannot create multiple bootstrap administrators.

The seed command is required: it creates or updates the chart-definition catalog used by the chart selection screen and deck generator.

## Production

Build and run the application with:

```sh
npm ci
npx prisma migrate deploy
npm run db:seed
npm run build
npm start
```

`npm start` listens on port `3030`. Place it behind an HTTPS reverse proxy such as Caddy and do not expose port `3030` directly to the internet.

### First-time systemd setup

The release workflow expects a systemd unit to keep Benefit HQ running and restart it after deployments or server reboots. On a new server, first prepare the production build without attempting a restart:

```sh
./scripts/deploy-release.sh --no-restart
```

Then run the one-time installer as the Linux user that owns the production checkout. Do not prefix this command with `sudo`; the installer requests sudo only when it installs and manages the system unit.

```sh
./scripts/install-systemd-service.sh
```

The installer detects the checkout, Linux user, Node.js, and npm paths; creates and enables `benefit-hq.service`; starts the application; and verifies `http://127.0.0.1:3030/login`. It refuses to replace an existing unit unless `--force` is explicitly supplied.

### Repeatable release deployment

After the desired release has been pushed to GitHub, run the bundled deployment script from the production checkout:

```sh
./scripts/deploy-release.sh
```

The script refuses a dirty working tree, pulls with `--ff-only`, runs `npm ci`, explicitly regenerates Prisma Client, validates the environment, runs tests/lint/type-checking, builds before changing the database, deploys migrations, seeds chart definitions, prunes development dependencies, restarts `benefit-hq.service`, and checks `http://127.0.0.1:3030/login`.

If the systemd unit has another name:

```sh
systemctl list-unit-files --type=service | grep -i benefit
./scripts/deploy-release.sh --service the-real-unit-name.service
```

Replace `the-real-unit-name.service` with a unit name returned by the first command; do not use it literally. If the service is named `benefit-hq.service`, omit `--service` entirely. For a user-level systemd unit, add `--user-service`. Use `--no-restart` when another supervisor handles startup, or `--health-url` when the local health-check address differs. Run `./scripts/deploy-release.sh --help` for every option. The script verifies that the selected unit exists before installing dependencies or changing the database.

Database migrations are forward-only. The script deliberately stops before migration if verification or the production build fails, but it does not attempt to reverse a migration after one has been applied.

The application uses `X-Real-IP`, falling back to the first `X-Forwarded-For` value, for credential and bootstrap throttling. The reverse proxy must overwrite these headers rather than trust client-supplied values. The built-in limiter is process-local and is appropriate for this application's current single-process deployment. Multi-instance deployments must enforce login throttling at the proxy or use a shared rate-limit store.

The proxy or host firewall should also:

- Redirect HTTP to HTTPS.
- Restrict direct access to the Next.js port.
- Set a request-body limit slightly above the application's 20 MB census limit.
- Preserve the original host and supply canonical client-IP headers.
- Apply an additional coarse rate limit to `/api/auth/*` and `/api/register`.

New logos are stored under `STORAGE_DIR/logos` and served only through an authenticated route. Generated decks are stored under `STORAGE_DIR/decks` and are also downloaded through an authenticated route. PNG, JPEG, and WebP logos are accepted after file-signature validation; SVG is deliberately rejected. Installations upgraded from older releases may still have legacy logos under `public/uploads/logos`, which should be included in backups until those logos are replaced.

New storage directories and files are created with owner-only permissions. The service account should own `STORAGE_DIR`; do not place it on a broadly shared filesystem without equivalent access controls.

## Census import contract

Benefit HQ accepts `.xlsx` workbooks up to 20 MB. The workbook is parsed in memory and is never saved to disk. SSNs may be used in memory to join ancillary rows to employees, but are discarded before persistence.

The primary medical/dental/vision sheet must contain recognizable aliases for:

- Employee number
- Employee birth date
- Employee gender
- Benefit plan type
- Benefit plan option

Common aliases for names, employment status, hire date, salary, postal code, dependents, plan names, and SSN are supported in `src/lib/census/headerAliases.ts`. An optional Life/STD/LTD sheet can be joined by SSN.

Workbook processing is bounded to 20 worksheets, 100,000 total rows, and 256 columns per worksheet. A successful import replaces the plan year's prior employee census atomically. PostgreSQL locks concurrent imports for the same plan year, and the old census remains visible unless the complete replacement and its upload-history record commit successfully.

Warnings shown after import should be reviewed before producing a client deck. In particular, unmatched ancillary records and missing birth dates affect chart accuracy.

## Policy rates

Employee and employer costs are entered with an explicit rate period: monthly, per pay period, or annual. All policy lines in one plan year must use the same period. Total premium is calculated server-side and the database enforces:

```text
total premium = employee cost + employer cost
```

The rate period is included in premium tables and aggregate chart titles so unlike units are not presented as comparable totals.

## Client lifecycle

Administrators can archive a client from the collapsed **Edit client details** area. Archived clients are hidden from the active list and shown to administrators in a separate recoverable list. Archived clients are read-only until restored.

Permanent deletion is also restricted to administrators and requires typing the exact client name. It cascades through plan years, census data, policy lines, chart settings, and deck records, then removes the client's managed logo and generated PowerPoint files from storage. Permanent deletion cannot be undone; use archive for normal offboarding and delete only when retention policy permits it.

## Quality checks

```sh
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

The test suite covers census normalization and SSN disposal, atomic census rollback behavior, upload signatures, premium validation, bootstrap controls, and authentication throttling primitives.

## Backups and recovery

Back up PostgreSQL and `STORAGE_DIR` on the same schedule. The database holds users, clients, employee census data, chart selections, and references to stored files; `STORAGE_DIR` holds the corresponding generated decks and logos. A database-only backup is not a complete recovery point.

A practical recovery procedure is:

1. Stop writes or place the application in maintenance mode.
2. Restore PostgreSQL.
3. Restore `STORAGE_DIR` from the matching backup window.
4. Include legacy `public/uploads/logos` assets if the installation predates private logo storage.
5. Run `npx prisma migrate deploy` and `npm run db:seed`.
6. Start the app and verify login, one client logo, one census summary, and one deck download.

Test restoration periodically. Restrict database backups and storage snapshots as sensitive data: employee names, dates of birth, salaries, postal codes, elections, and generated client materials may be present.

## Retention and operations

- Define a retention period for employee census data and generated decks that matches firm policy and contractual requirements.
- Monitor filesystem capacity; generated decks and replaced legacy assets do not belong in source control.
- Rotate `AUTH_SECRET` only with an understood session-invalidation plan because existing sessions will become invalid.
- Review administrator membership regularly.
- Keep PostgreSQL, Node.js, Next.js, Auth.js, Prisma, ExcelJS, and the reverse proxy patched.
- Treat application logs as sensitive and never add raw census rows, credentials, tokens, or SSNs to them.

## Database development

After changing `prisma/schema.prisma`, create a reviewed migration rather than using schema push in production:

```sh
npx prisma migrate dev --name describe_the_change
npm run db:seed
```

Commit both the schema change and generated migration. Prisma Client is generated by `postinstall` and is intentionally ignored by git.
