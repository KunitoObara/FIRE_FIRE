# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is currently in the requirements/design phase for a personal FIRE (Financial Independence, Retire Early) asset management web app. There is no application code yet — `src/frontend` and `src/backend` exist as empty scaffolding. All authoritative specs live under `docs/`. When implementation begins, update this file with real build/lint/test commands; do not invent them in the meantime.

`docs/.env` is a real secrets file (excluded via `.gitignore`) — never read, print, or commit its contents.

## Documentation map

- [docs/fire-asset-management-requirements.md](docs/fire-asset-management-requirements.md) — top-level requirements: architecture, features, phased MVP scope. Read this first; other docs detail specific sections of it.
- [docs/auth-login-requirements.md](docs/auth-login-requirements.md) — detailed spec for §4.1 (auth)
- [docs/screen-list-and-transitions.md](docs/screen-list-and-transitions.md) — full screen inventory (IDs A1–A7, B1–B10) and Mermaid transition diagrams
- [docs/screen-requirements-auth.md](docs/screen-requirements-auth.md), [screen-requirements-dashboard.md](docs/screen-requirements-dashboard.md), [screen-requirements-real-estate.md](docs/screen-requirements-real-estate.md), [screen-requirements-fire-goal.md](docs/screen-requirements-fire-goal.md), [screen-requirements-account.md](docs/screen-requirements-account.md) — per-screen field/behavior detail, keyed to the screen IDs above
- [DESIGN.md](DESIGN.md) — frontend design system: Tailwind/shadcn-based stack, color/typography rules, layout patterns, and the screen-ID-to-library mapping. Read this before adding any UI library or component pattern.

When a requirement seems ambiguous or missing, check the "今後の検討事項" (open issues) section at the end of the relevant doc before assuming — several decisions (hosting target, MFA recovery, social login, multi-tenant model) are explicitly deferred rather than omitted.

## Architecture (planned)

| Layer | Choice |
|---|---|
| Frontend | Next.js (React), adaptive layout for PC/tablet/mobile |
| Backend | Serverless (Firebase) |
| Auth | Firebase Authentication upgraded to **Identity Platform** (required for TOTP-based MFA) |
| Data store | Cloud Firestore — schemas for master data (e.g. asset category axes) must stay extensible, not hardcoded |
| File storage | Firebase Storage (CSV uploads) |
| Hosting | undecided (Vercel vs Firebase Hosting) |

Single-user (developer-only) in the initial release; multi-tenant/role-based access is explicitly out of scope until a later SaaS phase — don't design auth or data access around multiple users prematurely.

### Core domain flow

1. User manually uploads Money Forward CSV exports (asset balance history, then later transaction history) — no automated fetching in MVP.
2. Imported data drives a dashboard: net worth over time, category breakdown (pie), FIRE progress gauge/ETA, income/expense summary.
3. Asset category axes (総資産/純金融資産/投資性資産/etc.) are user-editable master data, not hardcoded enums — this is a stated hard requirement in §4.3 of the main requirements doc.
4. Real estate holdings are tracked separately with manually-updated market value minus mortgage balance (利ざや) auto-computed.
5. FIRE goals support two modes: direct target amount, or reverse-calculated from annual expenses (e.g. via the 4% rule).

### Screen navigation model

Post-login, the app is a dashboard-app-style shell: common header/sidebar gives free navigation between primary screens (B1 Dashboard, B2 CSV Import, B3 Transactions, B4 Category Master, B5 Real Estate List, B8 FIRE Goal, B9 Assumption Settings, B10 Account Settings). Auth screens (A1–A7) instead follow a linear flow (signup → email verify → forced MFA setup → dashboard; login → MFA verify → dashboard) — see the Mermaid diagrams in [screen-list-and-transitions.md](docs/screen-list-and-transitions.md) for exact edges before adding new transitions.

### Auth-specific constraints worth knowing before touching auth flows

- TOTP-based 2FA is **mandatory for all users**, enforced immediately after signup — the app must block main features until 2FA is registered (see §3.3 of auth-login-requirements.md).
- Password policy (min 8 chars, mixed case + digit + symbol) must be enforced server-side via Identity Platform's password policy feature, not just client-side validation.
- Login notification emails are sent on every successful login via Identity Platform Blocking Functions → Cloud Functions → an external email service (provider not yet chosen).
- No custom brute-force/lockout logic — this is intentionally left to Firebase Authentication's built-in rate limiting.

## MVP phasing

Work should generally respect this phase order (see §7 of the main requirements doc) rather than building later-phase features first:

1. Auth (Identity Platform) + manual CSV upload (balance history) + basic dashboard
2. Transaction CSV import + income/expense summary
3. Real estate management
4. FIRE goal setting/progress/ETA + yield/risk assumptions and simulation
5. (Future) Automated Money Forward sync, SaaS multi-tenancy — out of scope for now
