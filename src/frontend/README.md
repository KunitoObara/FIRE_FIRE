# FIRE-FIRE Frontend

FIRE-FIRE(パーソナルFIRE資産管理アプリ)のフロントエンド。Next.js(App Router)を使いつつ、[Next.js公式のSPA構築ガイド](https://nextjsjp.org/docs/app/guides/single-page-applications)に沿って挙動としてのSPA(画面遷移時にフルページリロードが発生しない)を実現する構成。

## 技術スタック概要

詳細な選定理由は [docs/TECH_STACK.md](docs/TECH_STACK.md)・[../../DESIGN.md](../../DESIGN.md) を参照。

| 分類 | 選定 |
|---|---|
| 言語 | TypeScript(strict) |
| フレームワーク | Next.js 16(App Router / Turbopack)+ React 19 |
| パッケージ管理 / Node管理 | npm / Volta(Node 22 系を固定) |
| スタイリング | Tailwind CSS v4 + shadcn/ui(Radixベース・neutral) |
| データ取得・状態管理 | firebase(クライアントSDK) / TanStack Query / Zustand / URL検索パラメータ |
| フォント | next/font(Noto Sans JP) |
| テスト | Vitest + React Testing Library |
| Lint / Format | ESLint(eslint-config-next + Airbnb系ルールを個別適用) / Prettier |
| デプロイ | Firebase App Hosting |

画面固有ライブラリ(Recharts, react-hook-form + zod, input-otp, react-qr-code, date-fns, sonner, @tanstack/react-table)は、対応する画面([docs/screen-list-and-transitions.md](../../docs/screen-list-and-transitions.md))を実装するタスクで必要になった時点で追加する。詳細は [../../DESIGN.md](../../DESIGN.md) 7章。

## セットアップ

### 1. Volta を導入する(未導入の場合)

```bash
brew install volta
```

インストール後、シェルにVoltaのshimを通す(`~/.zshrc` にPATH設定が追記される)。

```bash
volta setup
```

新しいシェルを開くと `src/frontend` に入った時点で `package.json` の `volta` フィールドに従い、Node.js / npm が自動でそのバージョンに切り替わる。

```bash
cd src/frontend && node -v   # v22.x が表示されればOK
```

### 2. 依存関係をインストールする

```bash
npm install
```

> npm 11 は依存パッケージのinstallスクリプトを既定でブロックする。本プロジェクトで必要なものは `package.json` の `allowScripts` に承認済み(`sharp` / `unrs-resolver` / `@firebase/util` / `protobufjs` / `fsevents`)。新しい依存を追加してブロック警告が出た場合は、内容を確認したうえで `npm install-scripts approve <pkg>` を実行する。

### 3. 環境変数を設定する

`.env.example` をコピーして `.env.local` を作り、Firebaseコンソール(プロジェクトの設定 → マイアプリ → ウェブアプリ)の値を記入する。

```bash
cp .env.example .env.local
```

| キー | 内容 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web APIキー |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 認証ドメイン |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | プロジェクトID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storageバケット |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | メッセージング送信者ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | アプリID |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` | Authエミュレータの接続先。**既定で有効**(`http://127.0.0.1:9099`) |

`.env.local` は `.gitignore` で除外済み。コミットしない(`.env.example` のみコミットする)。

### 4. Firebaseエミュレータを起動する

`.env.local` は既定でAuthエミュレータを向くため、**エミュレータを起動していないと認証が一切通らない**(サインアップが `auth/network-request-failed` で失敗する)。リポジトリルートで別ターミナルを開いて起動しておく。

```bash
firebase emulators:start
```

Emulator UI は <http://127.0.0.1:4000/auth> で、作成済みユーザーを確認・削除できる。

エミュレータを使う理由は、本番のIdentity Platformに実アカウントが作られ、入力したアドレスへ実際に確認メールが飛ぶのを防ぐため。本番プロジェクトに対して手動で確認したいときだけ `.env.local` の `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` をコメントアウトする。

> エミュレータは `--import` / `--export` を付けていないためデータを永続化しない。再起動すると作成済みユーザーは消えるので、同じメールアドレスで作り直せる。

### 5. 開発サーバーを起動する

```bash
npm run dev
```

<http://localhost:3000> を開く。

#### 確認メール(A2)をローカルで開く

エミュレータは確認メールを実際には送信せず、`firebase emulators:start` を実行しているターミナルに確認リンクを出力する。

```
i  To verify the email address you@example.com, follow this link: http://127.0.0.1:9099/emulator/action?mode=verifyEmail&lang=en&oobCode=...&apiKey=fake-api-key
```

このリンクをブラウザで開くと確認が完了し、A2の画面が数秒以内にA3(2FA登録画面)へ自動遷移する。

#### ローカルで確認できないもの

以下はエミュレータでは再現できないため、`develop` マージ後のステージング環境(`fire-fire-dev`)で確認する。

- Identity Platform側で強制するパスワードポリシー(エミュレータは強制しない)
- 実際に送信される確認メール・パスワードリセットメールの文面と到達
- TOTPによる2FA、Blocking Functions経由のログイン通知メール

A3(2FA登録画面)はエミュレータではQRコードを発行できず、TOTPの有効化を促すエラー表示になる。
エミュレータがSMSの多要素認証しか実装しておらず、TOTPの登録要求を `auth/invalid-argument`
(`Missing phoneEnrollmentInfo.`)で拒否するため。登録が成功するところまでは `fire-fire-dev` で確認する。

## 利用可能なスクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動(Turbopack) |
| `npm run build` | 本番ビルド |
| `npm run start` | ビルド済みアプリの起動 |
| `npm run lint` | ESLintによる静的解析 |
| `npm run lint:fix` | ESLintの自動修正 |
| `npm run format` | Prettierによる整形(Tailwindクラスの並び順も自動整形) |
| `npm run format:check` | 整形差分のチェックのみ |
| `npm run typecheck` | ルート型の再生成 + `tsc --noEmit` による型チェック |
| `npm run test` | Vitestによるユニットテスト実行 |
| `npm run test:watch` | Vitestのウォッチ実行 |

## shadcn/ui コンポーネントの追加

必要になったコンポーネントだけをCLIで追加する(フルインストールしない。[../../DESIGN.md](../../DESIGN.md) 2章)。

```bash
npx shadcn@latest add button
```

生成先は `src/components/ui/`。この配下はベンダーコード扱いとし、ESLintの自前コード向けルール(import順序・戻り値型の明示など)は適用していない。

## ディレクトリ構成

```
src/frontend/
├── src/
│   ├── app/                    # App Router。画面ID(A1〜A8 / B1〜B10)をルーティング規約に対応させる
│   │   ├── layout.tsx          # ルートレイアウト(Noto Sans JP・lang="ja")
│   │   ├── globals.css         # Tailwind v4 + shadcn/ui のCSS変数テーマ
│   │   └── (setup-check)/      # ★ 環境構築の動作確認用。画面実装時に削除してよい
│   ├── components/             # 自前コンポーネント(PascalCaseファイル)
│   │   └── ui/                 # shadcn/ui のCLI生成物(初回 add 時に作られる)
│   └── lib/                    # ユーティリティ(cn ヘルパー等)
├── docs/                       # 技術スタック・コーディング規約・HTMLモック
├── components.json             # shadcn/ui 設定
├── eslint.config.mjs           # ESLint flat config
├── vitest.config.ts            # Vitest設定
└── vitest.setup.ts             # RTL / jest-dom のセットアップ
```

- `src/frontend` は独立した `package.json` を持つ単独のNext.jsプロジェクト(モノレポツールは現時点では導入しない)
- `src/app/(setup-check)/` は `next/link` 遷移でフルページリロードが起きないことを目視確認するための足場。画面実装タスク着手時にディレクトリごと削除してよい
- コーディング規約(命名・import順序・スタイリング等)は [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) を参照

## Lint設定について

公式の `eslint-config-airbnb` はESLint 9のflat configに未対応のため、設定パッケージごと導入する方式は採っていない。代わりに `eslint-config-next` をベースとし、[docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) が明記しているAirbnb系ルール(`import/order`、`no-explicit-any`、`no-non-null-assertion`、enum禁止、`jsx-no-leaked-render` 等)を `eslint.config.mjs` で個別に適用している。ルールが競合した場合はCODING_STANDARDS.md 7章のとおりNext.js側を優先する。

なお `import/order` の型import順序は、eslint-plugin-importが「各グループ内で型importを後ろに置く」を表現できないため、型importをまとめて末尾グループに置く形で近似している。

## 関連ドキュメント

- [docs/TECH_STACK.md](docs/TECH_STACK.md) — 技術スタックの選定理由
- [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) — コーディング規約
- [../../DESIGN.md](../../DESIGN.md) — デザインシステム・UI実装方針
- [../../docs/screen-list-and-transitions.md](../../docs/screen-list-and-transitions.md) — 画面一覧・遷移図
