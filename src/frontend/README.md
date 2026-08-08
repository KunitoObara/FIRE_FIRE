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
| `NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD` | 【開発時のみ】ログイン後の画面の認証ガードを迂回する。既定は `false`(下記「ログイン後の画面をローカルで開く」) |

Firebaseの値は本番(`fire-fire-prod`)ではなく**`fire-fire-dev`(STG)のもの**を使う。`fire-fire-dev` はテスト用・開発用データが入っても本番に影響しないため、ローカル開発ではFirebase Emulatorを使わずSTGに直接繋ぐ方針にしている。サインアップすると`fire-fire-dev`に実アカウントが作られ、入力したアドレスへ実際に確認メールが送信される点に注意する。

エミュレータを廃止したことで接続先は`.env.local`の値だけで決まるため、`NEXT_PUBLIC_FIREBASE_PROJECT_ID` に誤って `fire-fire-prod` を設定すると本番に実アカウント・実データが入ってしまう。これを防ぐため、**開発時に本番プロジェクトを指していた場合はFirebaseの初期化時点でエラーにして止める**(`src/lib/firebase/client.ts`)。本番ビルドではこの判定自体が成果物から消えるため影響しない。

`.env.local` は `.gitignore` で除外済み。コミットしない(`.env.example` のみコミットする)。

### 4. 開発サーバーを起動する

```bash
npm run dev
```

<http://localhost:3000> を開く。

#### 確認メール(A2)をローカルで開く

サインアップした宛先に`fire-fire-dev`から実際に確認メールが届く。メール本文のリンクを開くと確認は完了する
(リンク先はメールのアクションURL設定により`fire-fire-dev`のApp Hostingドメインになるが、確認自体は
Firebaseプロジェクト側の状態更新のため、開いたブラウザがlocalhostと別でも構わない)。確認が完了すると、
サインアップ元のlocalhostタブのA2画面がポーリングで数秒以内に検知し、A3(2FA登録画面)へ自動遷移する。

#### パスワード再設定画面(A7)をローカルで開く

リセットメールのリンクも同じくアクションURL(`fire-fire-dev`のApp Hostingドメイン)を指すため、
そのまま開くとSTGのデプロイ済み画面が開いてしまう。ローカルの画面(A7)で確認したいときは、
届いたメールのリンクから `oobCode` の値をコピーして次のURLを直接開く。

```
http://localhost:3000/reset-password?oobCode=<コピーした値>
```

アクションURLの設定手順は [docs/ci-cd-setup.md](../../docs/ci-cd-setup.md) 12章を参照。

#### テストアカウントとメール送信の扱い

エミュレータと違い、ローカルで作ったアカウントは`fire-fire-dev`に残り続け、確認メール・リセットメールも
実際に送信される(再起動で消えることはない)。このため次の2点に注意する。

- **テストアカウントは溜まっていく。** 同じメールアドレスで作り直したいときは、先にFirebaseコンソールの
  Authentication → Users で該当ユーザーを削除する。消さずにサインアップすると
  `auth/email-already-in-use` になる。不要になったテストアカウントは適宜まとめて削除しておく
- **メール送信には1日あたりの上限がある。** Firebase既定のメールテンプレートによる送信はプロジェクト単位で
  制限されるため、サインアップとやり直しを繰り返すと上限に達し、メールが届かなくなることがある。
  設定を何も変えていないのに確認メールが来なくなったらこれを疑う。上限に達したときは時間を置くか、
  Firebaseコンソールの Authentication → Templates から独自のSMTPサーバーを設定する

#### ログイン後の画面(B1〜B11)をローカルで開く

サインアップ → メール確認 → TOTP登録という一連の流れは`fire-fire-dev`に直結していれば実際に通しで
確認できるが、画面の見た目や遷移だけを毎回それを経由せず素早く確認したいときは、`.env.local` で
次の値を有効にする。

```
NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD=true
```

有効にすると次の2つが変わる。

- ログイン画面(A4)に「開発用: ログインせずダッシュボードへ」の導線が出る
- ログイン後の画面の一番上に、迂回中であることを示す赤い帯が常時表示される

**これは認証ガードを飛ばすだけで、サインインはしていない**(`auth.currentUser` は `null` のまま)。
ログイン・2FA・セッションまわりの挙動そのものを確認する用途には使えないので、その場合は
`false` に戻すか `fire-fire-dev` で確認する。

本番ビルド(`NODE_ENV=production`)では、この値に関係なく迂回は無効になる。Next.jsが
`process.env.NODE_ENV` をビルド時にリテラルへ置き換えるため、迂回する側の分岐は本番の成果物に残らない
(`src/constants/dev.ts`)。

#### ローカルで確認できるようになったもの / 残る制約

`fire-fire-dev`に直結しているため、Identity Platform側で強制されるパスワードポリシー、TOTPによる
2FA登録・ログイン、Google連携(A8)、2FAリカバリーコードの発行(A3)・使用(A5)、B2 CSV取込の実際の
Firestore書き込みは、いずれもローカルで通しに確認できる。

残る制約はメールのアクションURLに起因するものだけ。パスワードリセット・メールアドレス確認のリンク先は
プロジェクトに1つだけ設定でき、`fire-fire-dev`のApp Hostingドメインに固定している([docs/ci-cd-setup.md](../../docs/ci-cd-setup.md) 12章)。
メール確認(A2)は確認状態がFirebaseプロジェクト側で更新されるためlocalhostのタブでも自動検知できるが、
パスワード再設定(A7)はlocalhostの画面自体を開く必要があるため、上記「パスワード再設定画面(A7)をローカルで開く」の
`oobCode`コピーの手順を使う。

ログイン通知メール(Identity Platform Blocking Functions経由)も同様にローカルで確認できる。関数は
`fire-fire-dev`側で発火するため、ローカルの`npm run dev`からログインしても通知が届く。本番の通知と混ざらない
よう、件名には`[dev]`が付く(準備と動作確認の手順は[docs/ci-cd-setup.md](../../docs/ci-cd-setup.md) 13章)。

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
│   ├── app/                    # App Router。画面ID(A1〜A8 / B1〜B11)をルーティング規約に対応させる
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
