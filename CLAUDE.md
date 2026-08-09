# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**FIRE-FIRE** is a personal FIRE (Financial Independence, Retire Early) asset management web app. All authoritative specs live under `docs/` — the docs lead the code, so check them before assuming behaviour from what is implemented. Phase 1 is largely built: `src/frontend` is a working Next.js project with every screen in the inventory routed (A1–A8 and B1–B11 — see the route/screen-ID table in [.claude/skills/screen-spec-drift-check/SKILL.md](.claude/skills/screen-spec-drift-check/SKILL.md)), and B1 reads real asset balances from Firestore. `src/backend` holds the 2FA recovery-code callables (`src/backend/src/mfa-recovery`), the login-notification blocking function (`src/backend/src/login-notification`), and the linked-provider callable (`src/backend/src/linked-providers`). The main gap inside Phase 1's successors is the transaction CSV import: **B3 renders sample data**, not Firestore — `src/frontend/src/lib/transactions/transactions-data.ts` returns `createSampleTransactionsData` behind `USE_SAMPLE_TRANSACTIONS_DATA` and says so, and that file plus `sample-data.ts` is what a real import replaces. See "Commands" below for the real build/lint/test commands.

`docs/.env` is a real secrets file (excluded via `.gitignore`) — never read, print, or commit its contents.

**This repository is public.** The developer's own financial figures must never enter it: fixtures, docstrings, and mock screens use obviously-fake round amounts, not rows pasted out of a real Money Forward export. The same goes for real addresses and personal email addresses — sample screens use `〇〇マンション101号室` / `taro.yamada@example.com`. Firebase's `NEXT_PUBLIC_*` values are already public in the deployed bundle and are supplied via GitHub Secrets / Secret Manager, so nothing about them belongs in a committed file either. Note that pull requests can now come from forks, where secrets are unavailable — a fork PR's `frontend` job is expected to fail, and that is not a regression to chase. `claude-review` skips such PRs instead of failing; reviewing one is a deliberate `workflow_dispatch` run by the owner (see [docs/ci-cd-setup.md](docs/ci-cd-setup.md) §3).

## Documentation map

- [docs/fire-asset-management-requirements.md](docs/fire-asset-management-requirements.md) — top-level requirements: architecture, features, phased MVP scope. Read this first; other docs detail specific sections of it.
- [docs/auth-login-requirements.md](docs/auth-login-requirements.md) — detailed spec for §4.1 (auth)
- [docs/screen-list-and-transitions.md](docs/screen-list-and-transitions.md) — full screen inventory (IDs A1–A8, B1–B11) and Mermaid transition diagrams
- [docs/screen-requirements-auth.md](docs/screen-requirements-auth.md), [screen-requirements-dashboard.md](docs/screen-requirements-dashboard.md), [screen-requirements-real-estate.md](docs/screen-requirements-real-estate.md), [screen-requirements-fire-goal.md](docs/screen-requirements-fire-goal.md), [screen-requirements-account.md](docs/screen-requirements-account.md) — per-screen field/behavior detail, keyed to the screen IDs above
- [DESIGN.md](DESIGN.md) — frontend design system: Tailwind/shadcn-based stack, color/typography rules, layout patterns, and the screen-ID-to-library mapping. Read this before adding any UI library or component pattern.
- [src/frontend/docs/TECH_STACK.md](src/frontend/docs/TECH_STACK.md), [src/backend/docs/TECH_STACK.md](src/backend/docs/TECH_STACK.md) — full technical stack per side (language, data fetching, testing, lint/format, deployment). Read these before adding a dependency or scaffolding either project; they complement rather than repeat DESIGN.md.
- [src/frontend/docs/CODING_STANDARDS.md](src/frontend/docs/CODING_STANDARDS.md) — TypeScript/Next.js coding conventions (naming, import order, Server vs Client Components, styling). Read this before writing frontend code, not just before adding a dependency.
- [docs/development-workflow.md](docs/development-workflow.md) — the Trello-card-driven development flow: which cards are eligible to start, branch/commit/PR conventions, the review round limit, and what Claude must never do (merge, force-push). Canonical source for the `/card-start`, `/card-split`, `/card-ship`, `/card-review`, and `/release` skills — read it before changing any of them. Each skill reads only the chapters its stage needs; §1 has the map.
- [docs/command-guards.md](docs/command-guards.md) — how the §8 prohibitions are backed by `.claude/settings.json` (`permissions` plus the `PreToolUse` hooks): what each pattern catches, the holes it doesn't, why the guard is disabled in the `claude-review` job alone, and the regression test. Read it when changing a guard, not when running the flow.
- [docs/ci-cd-setup.md](docs/ci-cd-setup.md) — CI/deploy setup: what the GitHub Actions workflows do, plus the one-time manual setup (service accounts, Workload Identity, GitHub secrets, App Hosting backend, branch protection, Identity Platform upgrade + TOTP 2FA enablement, Google sign-in provider enablement, Resend API key for login-notification mail) that lives outside the repo.
- [src/frontend/AGENTS.md](src/frontend/AGENTS.md) + [src/frontend/CLAUDE.md](src/frontend/CLAUDE.md) — generated by `create-next-app` when the frontend was scaffolded (commit `1999d22`), not hand-written. Next.js 16 bundles version-matched documentation inside the `next` package at `node_modules/next/dist/docs/`, and `AGENTS.md` points coding agents at those bundled docs instead of their training data; `src/frontend/CLAUDE.md` only imports it via `@AGENTS.md`. Next.js documents this mechanism itself, in the bundled guide `node_modules/next/dist/docs/01-app/02-guides/ai-agents.md`. That directory is created by `npm ci` and is therefore absent from a bare checkout — [.github/workflows/claude-review.yml](.github/workflows/claude-review.yml) installs no dependencies, so the path AGENTS.md points at does not exist while a review runs. Reviewers have read that missing path as evidence of a prompt injection; `ls src/frontend/node_modules/next/dist/docs/` after `npm ci` settles it either way.

When a requirement seems ambiguous or missing, check the "今後の検討事項" (open issues) section at the end of the relevant doc before assuming — several decisions (login-notification mail provider, recovery for Google-only accounts, multi-tenant model) are explicitly deferred rather than omitted.

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

The frontend does **not** use Firebase Emulator locally (B0-1): `.env.local` points `NEXT_PUBLIC_FIREBASE_*` directly at `fire-fire-dev` (STG), which exists precisely so that local/test data reaching it doesn't affect prod. This means server-side password policy, real emails, TOTP MFA, Google sign-in (A8), and the recovery-code flow (A3 issue → A5 redeem) all work end to end from `npm run dev` against the real `fire-fire-dev` project — no separate STG verification pass is needed for those. The one remaining local limitation is that Firebase's per-project action URL (password reset / email verification links) is fixed to `fire-fire-dev`'s App Hosting domain, not `localhost`: email verification (A2) still self-resolves because the local tab polls the same Firebase project, but to view the password-reset screen (A7) itself locally you copy the `oobCode` out of the received email link and open `http://localhost:3000/reset-password?oobCode=...` directly — see [src/frontend/README.md](src/frontend/README.md) "セットアップ". Login-notification mails (A8-3) also arrive for local logins, since the blocking function is deployed to `fire-fire-dev` too — they are subject-tagged `[dev]` to keep them apart from prod. Backend Functions local development is unaffected by B0-1 and still uses `firebase emulators:start` (repo root / `npm run serve` in `src/backend`) to iterate before deploying.

## Development flow

Work is driven by cards on the private Trello board **FIRE-FIRE**, reached through the `mcp__trello__*` tools (`WebFetch` cannot read it). Four skills carry a card from start to merge, and a fifth ships what has landed, with [docs/development-workflow.md](docs/development-workflow.md) as their canonical source of list/label IDs and rules:

| | |
|---|---|
| `/card-start` | Sync merged cards to 完了 → pick a 進行中 card labelled 詳細設計・実装 or テスト実装 → read the specs → **ask every open question at once** → plan the PR split → cut `feature/fire-fire-<id>` off `develop` |
| `/card-split` | Slice one card's work into several PRs that each pass CI alone — planned before implementation (cheap) or carved out of an already-large branch (expensive). A card is the unit of requirements, a PR is the unit of review; **one card may carry several PRs** |
| `/card-ship` | Run the CI commands and the relevant project skills → **self-review the diff** against the fixed checklist in [docs/development-workflow.md](docs/development-workflow.md) §6 (concurrent writes, double submit, delete fallout, partial failure — the classes B11 shipped green tests over) → commit → push → open the PR against `develop` → move the card to 確認中 |
| `/card-review` | Wait for CI and claude-review → fix findings, **max 3 rounds** → past that, fix only CI failures / security / data-loss / broken-screen findings and file the rest as new backlog cards |
| `/release` | The one stage that is not card-driven: check `develop` actually deployed to STG → open the `develop` → `main` PR with `--base main`, titled `リリース YYYY-MM-DD`, listing which cards it carries and what was verified where → after the PO merges, confirm `deploy.yml` succeeded. **No claude-review runs on a release PR and there is no automatic rollback** — see [docs/development-workflow.md](docs/development-workflow.md) §10 |

PRs are kept small for review accuracy, not for the CI's sake: B11 (PR #83, 68 files) hid two data-loss bugs that local tests passed and that only surfaced across successive review rounds. The size thresholds and the slicing order live in [docs/development-workflow.md](docs/development-workflow.md) §5. Note this is a separate concern from claude-review occasionally finishing green without posting anything — that one reproduces on re-runs of the *same* commit, so it is not explained by PR size.

Merging is the PO's call: **never run `gh pr merge`**. `.claude/settings.json` denies it, along with `firebase deploy`, `rm -rf`, and reading `docs/.env`; force-push is blocked by a `PreToolUse` hook instead, because prefix patterns cannot catch trailing `--force` or `+refspec` pushes. The card reaches 完了 on the next `/card-start`, which detects the merge.

## CI / deployment

Branch model: feature branch → PR → `develop` (deploys to `fire-fire-dev`) → PR → `main` (deploys to `fire-fire-prod`).

**`develop` is the repository's default branch, not `main`.** Dependabot raises its security-update PRs against the default branch and offers no setting to change that (`target-branch` in `dependabot.yml` applies to version updates only — set it and the config stops applying to security updates altogether), so pointing the default at `develop` is what keeps those PRs out of a straight-to-production merge. It also means `gh pr create` and the web UI default to `develop`, which is the base a feature PR wants; a `develop` → `main` release PR now needs an explicit `--base main`.

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on PRs targeting `develop`/`main`: `wip-check` (fails if the PR title contains `WIP`), `hooks` (runs `.claude/hooks/run-dangerous-command-tests.sh`, the regression test for the dangerous-command `PreToolUse` hooks), `frontend`, and `backend`. These four are the required status checks on `develop` and `main` — a red check blocks the merge button. That protection only became available when the repo went public (branch protection on a personal free account is a public-repo feature; while it was private both the Rulesets and the branch-protection APIs answered 403), so anything written as "treat them as required by convention" predates the move. `claude-review` is deliberately excluded from the required set. Setup steps are in [docs/ci-cd-setup.md](docs/ci-cd-setup.md) §6.
- **Claude review** ([.github/workflows/claude-review.yml](.github/workflows/claude-review.yml)) posts review comments on PRs **targeting `develop`**. A `develop` → `main` release PR is not reviewed — the same diff was already reviewed on its way into `develop`, so a second pass costs 2–4 minutes and returns nothing new. It is deliberately *not* a required check. The action only runs when the workflow file matches the copy on the **default branch, which is `develop`** — edits to it stay inert, and the job still reports success, until they land on `develop`. (The default branch was `main` until the Dependabot routing change; anything claiming edits must reach `main` predates that.)
- **Deploy** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs on push to `develop`/`main`: `firebase deploy --only functions,firestore,storage`, then an App Hosting rollout for the frontend. Auth is via Workload Identity — no service account keys in the repo. There is no automatic rollback; a failed deploy is caught via GitHub notifications, which is why `/release` checks the run itself after the release PR is merged.
- Files excluded from deploy artifacts live in [.gcloudignore](.gcloudignore) (repo-wide) and the `functions.ignore` list in [firebase.json](firebase.json). App Hosting builds only `src/frontend`, configured by [src/frontend/apphosting.yaml](src/frontend/apphosting.yaml). Keep `docs/` and other non-runtime files out — App Hosting build minutes are billed.

The one-time cloud/GitHub-side setup is in [docs/ci-cd-setup.md](docs/ci-cd-setup.md).

## Architecture (planned)

| Layer | Choice |
|---|---|
| Frontend | Next.js (React) built to behave as an SPA per [Next.js's own SPA guide](https://nextjsjp.org/docs/app/guides/single-page-applications) — client-side transitions via `next/link`, Server Components/Server Actions kept (no `output: 'export'`) — adaptive layout for PC/tablet/mobile |
| Backend | Serverless (Firebase) |
| Auth | Firebase Authentication upgraded to **Identity Platform** (required for TOTP-based MFA) |
| Data store | Cloud Firestore — schemas for master data (e.g. asset category axes) must stay extensible, not hardcoded |
| File storage | Firebase Storage — reserved for future use; **raw CSVs are not stored** (parsed in the browser, only the numbers reach Firestore — see §4.2 of the requirements doc) |
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

Post-login, the app is a dashboard-app-style shell: common header/sidebar gives free navigation between primary screens (B1 Dashboard, B2 CSV Import, B3 Transactions, B4 Category Master, B5 Real Estate List, B11 Debt Input, B8 FIRE Goal, B9 Assumption Settings, B10 Account Settings). Auth screens (A1–A8) instead follow a linear flow (signup → email verify → forced MFA setup → dashboard; login → MFA verify → dashboard; Google sign-in → [A8 account link] → MFA setup/verify → dashboard) — see the Mermaid diagrams in [screen-list-and-transitions.md](docs/screen-list-and-transitions.md) for exact edges before adding new transitions.

### Auth-specific constraints worth knowing before touching auth flows

- TOTP-based 2FA is **mandatory for all users**, enforced immediately after signup — the app must block main features until 2FA is registered (see §3.3 of auth-login-requirements.md). `firestore.rules` enforces the same thing at the data layer: `canAccessOwnData()` requires `firebase.sign_in_second_factor == 'totp'` on the ID token, so a session that has not passed TOTP gets `permission-denied` even when it calls Firestore directly. `AppAccessGuard` is display control only, not protection.
- Password policy (min 8 chars, mixed case + digit + symbol) must be enforced server-side via Identity Platform's password policy feature, not just client-side validation.
- Login notification emails are sent on every successful login via Identity Platform Blocking Functions → Cloud Functions → **Resend**'s HTTP API (`src/backend/src/login-notification`, needs the `RESEND_API_KEY` secret per project, plus a `firebaseAuthConfigWriter` custom role on the deploy service account — without it only this function fails to deploy, with a 403 on `identitytoolkit`; see [docs/ci-cd-setup.md](docs/ci-cd-setup.md) §5, §13, and the role block in §2). `beforeUserSignedIn` fires **after** the TOTP second factor, so a first-factor-only attempt never mails. A send failure is logged and swallowed — it must never block sign-in, and the 7-second blocking-function budget is why the HTTP call is cut off at 5s. The From address is Resend's shared `onboarding@resend.dev`, which can only deliver to the Resend account's own address; that is fine while the app is single-user but is the thing to change first if it ever isn't.
- No custom brute-force/lockout logic — this is intentionally left to Firebase Authentication's built-in rate limiting.
- Firebase's email links (password reset, email verification) all land on **one** project-wide action URL, so `/auth/action` (`src/frontend/src/app/(auth)/auth/action/page.tsx`) dispatches on `mode` — `resetPassword` hands off to A7 at `/reset-password?oobCode=…`, `verifyEmail` applies the code in place. Pointing that URL at the app is manual console setup per project ([docs/ci-cd-setup.md](docs/ci-cd-setup.md) §12); until it is done, reset mails open Firebase's own page and never reach A7. The emulator ignores it entirely — open `/reset-password?oobCode=…` by hand with the code from the emulator's printed link.
- Google social login (§3.8 of auth-login-requirements.md) is in scope: a "Googleで続ける" button on A1/A4, and A8 アカウント連携画面 for the same-email collision with an existing password account. Google sign-in does **not** exempt a user from mandatory TOTP 2FA.
- TOTP recovery codes (§3.3) are hand-rolled — Identity Platform has no backup-code feature. Callables in `src/backend/src/mfa-recovery` issue them (A3 on enrollment, B10 on reissue) and redeem them (A5); Firestore stores only scrypt hashes in `mfaRecoveryCodes/{uid}`, denied to clients by `firestore.rules`. Redeeming a code **unenrolls TOTP** and sends the user back through A3 rather than signing them straight in to B1 — no custom-token path that skips MFA. The same module also holds B10's `resetMfaEnrollment`, which unenrolls TOTP so the user can re-register through A3. Redeeming, resetting, and *reissuing* codes all re-verify the password server-side via Identity Platform's REST API, so they need the `IDENTITY_PLATFORM_WEB_API_KEY` secret in each project (see [docs/ci-cd-setup.md](docs/ci-cd-setup.md) §5) and are unavailable to Google-only accounts. Reissuing *requires* the password only when codes that are still valid for the *current* TOTP enrollment exist — that keeps A3's automatic first issuance password-free while closing the direct-callable path that would otherwise let a hijacked session wipe the legitimate user's codes — but a password supplied when not required is verified all the same, so B10 never claims a check it didn't do. Unenrolling TOTP discards the stored codes.

## MVP phasing

Work should generally respect this phase order (see §7 of the main requirements doc) rather than building later-phase features first:

1. Auth (Identity Platform) + manual CSV upload (balance history) + basic dashboard
2. Transaction CSV import + income/expense summary
3. Real estate management + debt management (manual entry only — Money Forward does not export liabilities to CSV; debts feed the category axes and the dashboard)
4. FIRE goal setting/progress/ETA + yield/risk assumptions and simulation
5. (Future) Automated Money Forward sync, SaaS multi-tenancy — out of scope for now
