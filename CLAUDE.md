# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**FIRE-FIRE** is a personal FIRE (Financial Independence, Retire Early) asset management web app. All authoritative specs live under `docs/` — the docs lead the code, so check them before assuming behaviour from what is implemented. Implementation has started with Phase 1 (auth): `src/frontend` is a working Next.js project (A1 signup implemented), `src/backend` is a Cloud Functions scaffold. See "Commands" below for the real build/lint/test commands.

`docs/.env` is a real secrets file (excluded via `.gitignore`) — never read, print, or commit its contents.

## Documentation map

- [docs/fire-asset-management-requirements.md](docs/fire-asset-management-requirements.md) — top-level requirements: architecture, features, phased MVP scope. Read this first; other docs detail specific sections of it.
- [docs/auth-login-requirements.md](docs/auth-login-requirements.md) — detailed spec for §4.1 (auth)
- [docs/screen-list-and-transitions.md](docs/screen-list-and-transitions.md) — full screen inventory (IDs A1–A8, B1–B10) and Mermaid transition diagrams
- [docs/screen-requirements-auth.md](docs/screen-requirements-auth.md), [screen-requirements-dashboard.md](docs/screen-requirements-dashboard.md), [screen-requirements-real-estate.md](docs/screen-requirements-real-estate.md), [screen-requirements-fire-goal.md](docs/screen-requirements-fire-goal.md), [screen-requirements-account.md](docs/screen-requirements-account.md) — per-screen field/behavior detail, keyed to the screen IDs above
- [DESIGN.md](DESIGN.md) — frontend design system: Tailwind/shadcn-based stack, color/typography rules, layout patterns, and the screen-ID-to-library mapping. Read this before adding any UI library or component pattern.
- [src/frontend/docs/TECH_STACK.md](src/frontend/docs/TECH_STACK.md), [src/backend/docs/TECH_STACK.md](src/backend/docs/TECH_STACK.md) — full technical stack per side (language, data fetching, testing, lint/format, deployment). Read these before adding a dependency or scaffolding either project; they complement rather than repeat DESIGN.md.
- [src/frontend/docs/CODING_STANDARDS.md](src/frontend/docs/CODING_STANDARDS.md) — TypeScript/Next.js coding conventions (naming, import order, Server vs Client Components, styling). Read this before writing frontend code, not just before adding a dependency.
- [docs/ci-cd-setup.md](docs/ci-cd-setup.md) — CI/deploy setup: what the GitHub Actions workflows do, plus the one-time manual setup (service accounts, Workload Identity, GitHub secrets, App Hosting backend, branch protection, Identity Platform upgrade + TOTP 2FA enablement, Google sign-in provider enablement) that lives outside the repo.

When a requirement seems ambiguous or missing, check the "今後の検討事項" (open issues) section at the end of the relevant doc before assuming — several decisions (hosting target, MFA recovery, social login, multi-tenant model) are explicitly deferred rather than omitted.

## Commands

There is no root-level package — run commands inside `src/frontend` or `src/backend`. These are exactly what CI runs; if one fails locally, the PR will not be mergeable.

| | `src/frontend` | `src/backend` |
|---|---|---|
| Install | `npm ci` | `npm ci` |
| Lint | `npm run lint` | `npm run lint` |
| Format check | `npm run format:check` | — (Prettier not set up yet) |
| Type check | `npm run typecheck` | `npm run typecheck` (`npm run build` also type-checks) |
| Test | `npm run test` | `npm run test` |
| Build | `npm run build` | `npm run build` (tsc → `lib/`) |
| Dev server | `npm run dev` | `firebase emulators:start` (repo root) |

Node.js 22 / npm is pinned via Volta in `src/frontend/package.json`.

Running the frontend against auth needs `firebase emulators:start` (repo root) alongside `npm run dev`: `.env.local` points at the Auth emulator by default, so with the emulator down every auth call fails with `auth/network-request-failed`. The emulator prints the email-verification link to its own terminal instead of sending mail, and it does not persist data between restarts. Server-side password policy, real emails, TOTP MFA and login-notification Blocking Functions are not reproduced locally — verify those on `fire-fire-dev` after merging to `develop`. Google sign-in is only *mocked* by the emulator (a dummy screen that accepts any address, no real Google auth), and the account-linking branch (`auth/account-exists-with-different-credential`) behaves differently there, so the A8 flow also has to be verified on `fire-fire-dev` — see [docs/ci-cd-setup.md](docs/ci-cd-setup.md) §10.4. See [src/frontend/README.md](src/frontend/README.md) "セットアップ".

## CI / deployment

Branch model: feature branch → PR → `develop` (deploys to `fire-fire-dev`) → PR → `main` (deploys to `fire-fire-prod`).

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on PRs targeting `develop`/`main`: `wip-check` (fails if the PR title contains `WIP`), `frontend`, and `backend`. Branch protection cannot be enabled on this repo (private repo on a plan without it), so a red check does *not* block the merge button — treat these three as required by convention and don't merge a PR that fails them.
- **Claude review** ([.github/workflows/claude-review.yml](.github/workflows/claude-review.yml)) posts review comments on every PR. It is deliberately *not* a required check. The action only runs when the workflow file matches the copy on the default branch (`main`) — edits to it stay inert, and the job still reports success, until they land on `main`.
- **Deploy** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs on push to `develop`/`main`: `firebase deploy --only functions,firestore,storage`, then an App Hosting rollout for the frontend. Auth is via Workload Identity — no service account keys in the repo. There is no automatic rollback; a failed deploy is caught via GitHub notifications.
- Files excluded from deploy artifacts live in [.gcloudignore](.gcloudignore) (repo-wide) and the `functions.ignore` list in [firebase.json](firebase.json). App Hosting builds only `src/frontend`, configured by [src/frontend/apphosting.yaml](src/frontend/apphosting.yaml). Keep `docs/` and other non-runtime files out — App Hosting build minutes are billed.

The one-time cloud/GitHub-side setup is in [docs/ci-cd-setup.md](docs/ci-cd-setup.md).

## Architecture (planned)

| Layer | Choice |
|---|---|
| Frontend | Next.js (React) built to behave as an SPA per [Next.js's own SPA guide](https://nextjsjp.org/docs/app/guides/single-page-applications) — client-side transitions via `next/link`, Server Components/Server Actions kept (no `output: 'export'`) — adaptive layout for PC/tablet/mobile |
| Backend | Serverless (Firebase) |
| Auth | Firebase Authentication upgraded to **Identity Platform** (required for TOTP-based MFA) |
| Data store | Cloud Firestore — schemas for master data (e.g. asset category axes) must stay extensible, not hardcoded |
| File storage | Firebase Storage (CSV uploads) |
| Hosting | Firebase App Hosting (decided — see [src/frontend/docs/TECH_STACK.md](src/frontend/docs/TECH_STACK.md) §7) |

See [src/frontend/docs/TECH_STACK.md](src/frontend/docs/TECH_STACK.md) §0 for what "built as an SPA" concretely means here — it is not a static export; Next.js's server features stay in use.

Single-user (developer-only) in the initial release; multi-tenant/role-based access is explicitly out of scope until a later SaaS phase — don't design auth or data access around multiple users prematurely.

### Core domain flow

1. User manually uploads Money Forward CSV exports (asset balance history, then later transaction history) — no automated fetching in MVP.
2. Imported data drives a dashboard: net worth over time, category breakdown (pie), FIRE progress gauge/ETA, income/expense summary.
3. Asset category axes (総資産/純金融資産/投資性資産/etc.) are user-editable master data, not hardcoded enums — this is a stated hard requirement in §4.3 of the main requirements doc.
4. Real estate holdings are tracked separately with manually-updated market value minus mortgage balance (利ざや) auto-computed.
5. FIRE goals support two modes: direct target amount, or reverse-calculated from annual expenses (e.g. via the 4% rule).

### Screen navigation model

Post-login, the app is a dashboard-app-style shell: common header/sidebar gives free navigation between primary screens (B1 Dashboard, B2 CSV Import, B3 Transactions, B4 Category Master, B5 Real Estate List, B8 FIRE Goal, B9 Assumption Settings, B10 Account Settings). Auth screens (A1–A8) instead follow a linear flow (signup → email verify → forced MFA setup → dashboard; login → MFA verify → dashboard; Google sign-in → [A8 account link] → MFA setup/verify → dashboard) — see the Mermaid diagrams in [screen-list-and-transitions.md](docs/screen-list-and-transitions.md) for exact edges before adding new transitions.

### Auth-specific constraints worth knowing before touching auth flows

- TOTP-based 2FA is **mandatory for all users**, enforced immediately after signup — the app must block main features until 2FA is registered (see §3.3 of auth-login-requirements.md).
- Password policy (min 8 chars, mixed case + digit + symbol) must be enforced server-side via Identity Platform's password policy feature, not just client-side validation.
- Login notification emails are sent on every successful login via Identity Platform Blocking Functions → Cloud Functions → an external email service (provider not yet chosen).
- No custom brute-force/lockout logic — this is intentionally left to Firebase Authentication's built-in rate limiting.
- Google social login (§3.8 of auth-login-requirements.md) is in scope: a "Googleで続ける" button on A1/A4, and A8 アカウント連携画面 for the same-email collision with an existing password account. Google sign-in does **not** exempt a user from mandatory TOTP 2FA.

## MVP phasing

Work should generally respect this phase order (see §7 of the main requirements doc) rather than building later-phase features first:

1. Auth (Identity Platform) + manual CSV upload (balance history) + basic dashboard
2. Transaction CSV import + income/expense summary
3. Real estate management
4. FIRE goal setting/progress/ETA + yield/risk assumptions and simulation
5. (Future) Automated Money Forward sync, SaaS multi-tenancy — out of scope for now
