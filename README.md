# Benefit HQ

Benefit HQ is a single-workspace benefits renewal application. Authenticated brokerage staff can manage clients and plan years, import carrier census workbooks, enter policy rates, preview benefits analyses, and generate branded, presentation-ready PowerPoint decks.

All authenticated users share the same clients and plan-year data. Administrators manage user accounts. This is intentional for one internal firm workspace; the current data model is not suitable for hosting unrelated customer organizations in one installation.

## Requirements

- Node.js 20 or newer
- PostgreSQL
- A persistent filesystem location for generated decks, client intake documents, and uploaded logos
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
| `STORAGE_DIR` | Persistent private directory for decks, client intake documents, and new logos; defaults to `./storage` |

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

The seed command is required: it creates or updates the chart-definition catalog used by the chart selection screen and deck generator, and imports the versioned Mercer benchmark dataset bundled with the release.

## Product workflow

1. Create a client with its core identity, industry, renewal date, headquarters, and optional branding. The short setup creates the workspace and opens the guided onboarding profile.
2. Complete the five onboarding sections progressively: company profile, internal team and client contacts, organization and locations, goals and constraints, and private source documents. The client overview shows completion progress and links back to the dedicated editor.
3. Create a plan year. The form proposes the next calendar year's **Plan Year** label and defaults its effective date to January 1 of that year.
4. Upload the carrier census workbook. A successful upload atomically replaces the census previously stored for that plan year.
5. Configure the benefits the client offers. Add plans or classes from census suggestions, copy a prior plan year, or add them manually; then enter the applicable rates and policy provisions.
6. Open **Charts & tables** to review the analyses, enable or disable slides, and choose supported alternate views. Settings save to the plan year and are used by the PowerPoint generator.
7. Select **Generate deck**, then use the displayed **Download PowerPoint** action when generation completes.

The application layout, navigation, forms, login screen, chart previews, and action controls are responsive across mobile and desktop widths.

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

New logos are stored under `STORAGE_DIR/logos`, intake documents under `STORAGE_DIR/documents`, and generated decks under `STORAGE_DIR/decks`. All are served only through authenticated routes. Intake uploads are limited to 25 MB and accept validated PDF, Excel, Word, PowerPoint, CSV, and text files. PNG, JPEG, and WebP logos are accepted after file-signature validation; SVG is deliberately rejected. Installations upgraded from older releases may still have legacy logos under `public/uploads/logos`, which should be included in backups until those logos are replaced.

New storage directories and files are created with owner-only permissions. The service account should own `STORAGE_DIR`; do not place it on a broadly shared filesystem without equivalent access controls.

### Multi-tenant deployments

The data model is single-tenant: `User` and `Client` carry no organization/tenant field, so one installation serves one firm's shared workspace (see [Client lifecycle](#client-lifecycle)). To host another, separate firm, provision a second, fully independent installation rather than adding rows to the existing one:

```sh
./scripts/provision-tenant.sh acme
```

This clones a fresh checkout next to the current one, creates a dedicated Postgres role and database, generates a tenant-specific `.env` (its own `DATABASE_URL`, `AUTH_SECRET`, `BOOTSTRAP_TOKEN`, and `STORAGE_DIR`), builds and migrates it via `deploy-release.sh --no-restart`, and installs it as its own systemd service via `install-systemd-service.sh --port <port>` on the next unused port. It records each tenant it provisions in `<base-dir>/tenants.tsv`. It does not touch DNS or Caddy — it prints the `reverse_proxy` block to add for the new subdomain, matching the pattern already used for the primary instance's Caddy site. No DNS change is needed if the domain already has a wildcard record. Run `./scripts/provision-tenant.sh --help` for every option, including using an existing/managed Postgres instance via `--database-url` instead of local provisioning.

Because each tenant is its own process and its own database, there is no data path between tenants — this is the same isolation as running the application on separate hosts, just consolidated onto one. The login-throttling caveat above still applies per tenant: if a single tenant is later scaled to more than one process, its rate limiting must move to the proxy or a shared store.

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

## Policy details and rates

Policy details use a benefit → plan/class → rate-tier structure. Medical, dental, and vision support an unlimited number of plans, two-, three-, or four-tier rates, explicit rate periods, optional enrollment overrides, and census aliases. Life and disability are class-based and store the applicable provisions without forcing irrelevant premium tiers. Plan-specific sections remain collapsed until needed, and conditional fields appear only for the selected plan type or funding arrangement.

The standalone **Voluntary Plan Offerings** section records additional benefits through a simple checklist. These selections have no rates, census matching, readiness requirements, or Mercer comparisons. When one or more offerings are selected, the generated presentation automatically includes an **Additional Benefits Offered** slide; otherwise that slide is omitted.

Gross premium and employee contribution are entered; employer contribution is derived at cent precision. The database enforces that the three amounts reconcile. Reporting annualizes monthly rates by 12, per-pay-period rates by 26, and annual rates as entered, then weights them by enrollment. An entered enrollment override controls projected spend while census matches remain visible in data-quality reporting.

Census elections match policy rates by benefit, plan name or alias, and compatible tier. Combined Employee + Dependent and Employee + Family rate structures accept the corresponding detailed census tiers. A readiness panel surfaces missing rates and inconsistent limits before charts and deck generation.

The additive migration retains and backfills the legacy `PolicyLine` table. Medical, dental, and vision saves continue synchronizing that table during the transition, so the previous application build remains usable if a code rollback is required.

### Policy-details rollback

Before the migration is deployed, rollback is only a code/branch switch. After deployment, the safest rollback is to deploy the previous application build and leave the four additive tables in place; the old build ignores them and reads the synchronized legacy rates. Do not drop the new tables after users have entered policy provisions unless the database has first been backed up, because the old flat model cannot represent those additional fields.

The additive tables are `BenefitProgram`, `BenefitPlan`, `PlanRate`, and `PlanAlias`. If the migration was applied but no one has used the new editor, they can be dropped in dependency order (`PlanAlias`, `PlanRate`, `BenefitPlan`, `BenefitProgram`) before marking the migration rolled back. Production migration state should be changed only through the documented Prisma recovery procedure, not by deleting migration records manually.

## Mercer market benchmarking

Each medical plan year retains an advanced **Benchmark QA** workspace for internal exploration. It compares the client's calculated plan rates and provisions with the national Mercer baseline and one focused peer cohort. The application recommends an industry, employer-size, or geographic cohort when the client profile supports it; an advanced override can save a different choice without changing the source data. A comparison is shown only when the company value can be calculated and at least one corresponding Mercer value exists; missing values are never estimated or substituted.

The **Charts & tables** screen contains only company analyses. Matching Mercer context is applied automatically after the contribution strategy and medical plan-enrollment analyses rather than appearing as a selectable benchmark workflow or separate Mercer section. Cost per employee is shown only when at least 90% of active medical elections match policy rates. Unavailable comparisons are omitted quietly, while displayed comparisons retain the national baseline, saved peer cohort, dataset version, and methodology note.

The committed benchmark file is versioned independently from plan-year data. Seeding imports it transactionally and records the source workbook checksum, import time, metric count, and cohort count. A later Mercer release can therefore coexist with historical comparisons instead of silently changing prior results.

To regenerate the bundled 2025 dataset from an authorized copy of the source workbook:

```sh
python3 scripts/extract-mercer-benchmark.py \
  --workbook "/path/to/Alliant BOB - BM Tool - 2026v2.xlsm" \
  --manifest prisma/data/mercer-2025-manifest.json \
  --output prisma/data/mercer-2025.json
npm run db:seed
```

The extractor reads the workbook as ZIP/XML and never modifies it. Review the generated warnings and diff before committing a replacement dataset. Treat both the source workbook and extracted benchmark values as licensed, confidential business data.

## Charts, tables, and PowerPoint generation

The **Charts & tables** page presents the catalog in collapsible story groups. Individual analyses can be enabled or disabled without changing the underlying census or policy data. The generated deck follows the same catalog order and honors the saved selections.

The concise default presentation includes:

- **Executive Summary** with headcount, average age, average tenure, geographic footprint, medical participation, and automatically generated observations.
- **Renewal Comparison** with prior-versus-current rates and modeled annual employer, employee, and total cost changes. When only one plan year is available, the preview explains that a comparison year is required and the generated deck omits the renewal slide.
- **Employer vs. Employee Cost Strategy** with contribution rates, employer-paid percentages, matched enrollment, and estimated annual spend by benefit, plan, and tier.
- **Benefits Participation & Waivers** for Medical, Dental, and Vision, including eligible, enrolled, waived, not-recorded, and participation totals.
- **Coverage Tier Enrollment** across Medical, Dental, and Vision.
- **Workforce Risk & Continuity Profile** combining age and tenure into new-hire, established-workforce, Medicare-horizon, and continuity indicators.
- **Workforce Geography**, which uses a state heat map when employees span multiple states, drills into counties when they are concentrated in one state, and falls back to a ZIP summary when a map would add no useful detail.
- **Dependent Profile** and **Ancillary Benefits** summaries when matching source data is available.
- **Additional Benefits Offered** when the plan year includes one or more voluntary-plan checklist selections.
- **Data Quality Appendix** covering core census completeness, valid ZIP coverage, unmatched elections, and missing dates or salaries.

Additional demographic, enrollment, premium, dependent, and ancillary charts remain available in the catalog but are disabled by default to keep the standard deck concise.

### Alternate views

Selected views are persisted with the plan year and carry through to the generated PowerPoint:

| Analysis | Available views |
| --- | --- |
| Workforce Geography | Map, ranked bars, table |
| Benefits Participation & Waivers | Participation cards, stacked bars, table |
| Renewal Comparison | Comparison table, cost bars |
| Employer vs. Employee Cost Strategy | Detailed table, contribution bars |
| Medical, Dental, and Vision Coverage Tier Enrollment | Grouped bars, 100% stacked bars, table |

Coverage-tier view changes stay synchronized across Medical, Dental, and Vision so the combined slide uses one coherent format. Unsupported or obsolete saved view values fall back to the curated default.

### Presentation design

PowerPoint output is designed as a complete client presentation rather than a direct export of the browser preview. It includes:

- A branded cover using the client's logo and colors.
- A consistent content master with the client name, plan-year label, effective date, and slide number.
- Data-derived, insight-led slide titles rather than chart names alone.
- Visual section dividers inserted only for sections that contain selected output.
- **Key Takeaway** treatments that summarize the most important fact shown on applicable slides.
- A final prioritized recommendations slide generated only from measurable conditions in the selected analyses, such as data gaps, low participation, modeled renewal increases, contribution variation, workforce continuity exposure, or geographic concentration.

Browser previews and PowerPoint slides use the same calculation results, but each is laid out for its medium. Generated decks and client logos are private files and require an authenticated application request to download.

## Client lifecycle

Administrators can archive a client from the danger zone at the bottom of the dedicated client profile editor. Archived clients are hidden from the active list and shown to administrators in a separate recoverable list. Archived clients are read-only until restored.

Permanent deletion is also restricted to administrators and requires typing the exact client name. It cascades through onboarding data, private intake documents, plan years, census data, policy lines, chart settings, and deck records, then removes the client's managed logo, intake uploads, and generated PowerPoint files from storage. Permanent deletion cannot be undone; use archive for normal offboarding and delete only when retention policy permits it.

## Quality checks

```sh
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

The test suite covers client onboarding validation and progress, census normalization and SSN disposal, atomic census rollback behavior, upload signatures, premium validation, bootstrap controls, authentication throttling primitives, chart calculations, renewal behavior, geography selection, alternate chart views, narrative titles, and data-derived presentation recommendations.

## Application icons

Benefit HQ's favicon, browser icon, Apple touch icon, and installable application icons are generated from `public/brand/benefit-hq-mark.svg`:

```sh
npm run assets:icons
```

Commit the regenerated icon files whenever the source brand mark changes.

## Backups and recovery

Back up PostgreSQL and `STORAGE_DIR` on the same schedule. The database holds users, clients, onboarding profiles, employee census data, chart selections, and references to stored files; `STORAGE_DIR` holds the corresponding generated decks, intake documents, and logos. A database-only backup is not a complete recovery point.

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
