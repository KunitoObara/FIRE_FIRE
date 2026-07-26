# FIRE-FIRE Frontend

FIRE-FIRE(パーソナルFIRE資産管理アプリ)のフロントエンド。Next.js(App Router)を使いつつ、[Next.js公式のSPA構築ガイド](https://nextjsjp.org/docs/app/guides/single-page-applications)に沿って挙動としてのSPA(画面遷移時にフルページリロードが発生しない)を実現する構成。

> **注記**: 本READMEは開発環境構築タスクの一部として作成したドキュメントです。実際のプロジェクト(`package.json`等)がまだ生成されていない場合、以下のスクリプトは生成後に有効になります。

## 技術スタック概要

詳細な選定理由は [docs/TECH_STACK.md](docs/TECH_STACK.md)・[../../DESIGN.md](../../DESIGN.md) を参照。

| 分類 | 選定 |
|---|---|
| 言語 | TypeScript(strict） |
| フレームワーク | Next.js(App Router) |
| パッケージ管理 / Node管理 | npm / Volta |
| スタイリング | Tailwind CSS + shadcn/ui |
| データ取得・状態管理 | firebase(クライアントSDK) / TanStack Query / Zustand / URL検索パラメータ |
| フォント | next/font(Noto Sans JP) |
| テスト | Vitest + React Testing Library |
| Lint / Format | ESLint(eslint-config-next + Airbnb系) / Prettier |
| デプロイ | Firebase App Hosting |

画面固有ライブラリ(Recharts, react-hook-form + zod, input-otp, react-qr-code, date-fns, sonner, @tanstack/react-table)は、対応する画面([docs/screen-list-and-transitions.md](../../docs/screen-list-and-transitions.md))を実装するタスクで必要になった時点で追加する。詳細は [../../DESIGN.md](../../DESIGN.md) 7章。

## セットアップ

1. [Volta](https://volta.sh/) をインストール(未導入の場合)
2. `src/frontend` ディレクトリに入ると `package.json` の `volta` フィールドに従い、Node.js / npm のバージョンが自動的に切り替わる
3. 依存関係をインストール

   ```bash
   npm install
   ```

4. `.env.local` を作成し、Firebase設定値を記入(コミットしない。`.gitignore`で除外済み)

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   ```

5. 開発サーバーを起動

   ```bash
   npm run dev
   ```

## 利用可能なスクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLintによる静的解析 |
| `npm run format` | Prettierによる整形 |
| `npm run test` | Vitestによるユニットテスト実行 |

## ディレクトリ構成の方針

- `src/frontend` は独立した `package.json` を持つ単独のNext.jsプロジェクト(モノレポツールは現時点では導入しない)
- 画面ID(A1〜A7, B1〜B10、[docs/screen-list-and-transitions.md](../../docs/screen-list-and-transitions.md)参照)は `app` ディレクトリのルーティング規約に対応させる
- コーディング規約(命名・import順序・スタイリング等)は [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) を参照

## 関連ドキュメント

- [docs/TECH_STACK.md](docs/TECH_STACK.md) — 技術スタックの選定理由
- [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) — コーディング規約
- [../../DESIGN.md](../../DESIGN.md) — デザインシステム・UI実装方針
- [../../docs/screen-list-and-transitions.md](../../docs/screen-list-and-transitions.md) — 画面一覧・遷移図
