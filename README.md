# FIRE-FIRE

個人向けのFIRE(Financial Independence, Retire Early)資産管理アプリ。マネーフォワードからエクスポートしたCSVを取り込んで資産全体をダッシュボードで可視化し、FIRE目標に対する達成度と到達時期を見積もる。

**個人開発のプロジェクトであり、利用者は開発者1人を想定している。** マルチテナント化(SaaS化)は将来の検討事項として明示的にスコープ外にしてある。

## 現在の状況

Phase 1 を実装中。認証(A1〜A8)とダッシュボード系(B1〜B11)の画面が一通り動く状態で、B1 は取り込んだ資産残高を Firestore から読む。入出金明細CSVの取込がまだ無いため、収支明細一覧(B3)だけはサンプルデータを表示している。

要件は `docs/` 配下がすべての起点で、**ドキュメントがコードに先行する**。実装から挙動を推測する前にそちらを見てほしい。

| ドキュメント | 内容 |
|---|---|
| [docs/fire-asset-management-requirements.md](docs/fire-asset-management-requirements.md) | 最上位の要件定義。構成・機能・フェーズ分け |
| [docs/screen-list-and-transitions.md](docs/screen-list-and-transitions.md) | 画面一覧(A1〜A8 / B1〜B11)と遷移図 |
| [docs/auth-login-requirements.md](docs/auth-login-requirements.md) | 認証まわりの詳細仕様 |
| [DESIGN.md](DESIGN.md) | フロントエンドのデザインシステム |
| [docs/ci-cd-setup.md](docs/ci-cd-setup.md) | CI/デプロイと、リポジトリ外の手動セットアップ手順 |
| [docs/development-workflow.md](docs/development-workflow.md) | カード駆動の開発フロー |
| [docs/command-guards.md](docs/command-guards.md) | 危険なコマンドを止める設定とその限界 |

## 構成

| レイヤ | 選定 |
|---|---|
| フロントエンド | Next.js(App Router)/ TypeScript / Tailwind CSS + shadcn/ui |
| バックエンド | Cloud Functions for Firebase |
| 認証 | Firebase Authentication(Identity Platform / TOTP 2段階認証を全ユーザー必須) |
| データストア | Cloud Firestore |
| ホスティング | Firebase App Hosting |

```
src/frontend   Next.js アプリ
src/backend    Cloud Functions(2段階認証のリカバリーコード、ログイン通知)
docs/          要件定義・設計
```

ビルド・テストのコマンドは各プロジェクト配下で実行する。詳細は [src/frontend/README.md](src/frontend/README.md) を参照。

```bash
cd src/frontend && npm ci && npm run dev
```

## マネーフォワードについて

**本プロジェクトは株式会社マネーフォワードとは一切関係のない個人プロジェクトであり、同社が提供・承認・後援するものではない。** 「マネーフォワード」は同社の登録商標。

本アプリが扱うのは、利用者が自分でマネーフォワードからエクスポートしたCSVファイルだけで、同社のサービスへ自動アクセスするコードは含まない。また、取り込んだCSVそのものは保存せず、ブラウザ上で解析して数値だけをFirestoreに書き込む([要件定義 4.2](docs/fire-asset-management-requirements.md))。

## ライセンス

ライセンスを設定していないため、著作権法上の権利はすべて留保される。ソースコードは閲覧・参照できるが、複製・改変・再配布は許諾していない。
