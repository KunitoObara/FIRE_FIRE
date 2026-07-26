# CI / デプロイ セットアップ手順

GitHub Actions による CI（Lint・型チェック・テスト・ビルド）と、Firebase への自動デプロイの設定手順。

ワークフロー本体はリポジトリに入っているが、**クラウド側（Google Cloud / GitHub の設定画面）の作業は手動で行う必要がある**。本ファイルはその手順書。

## 1. 全体像

| ブランチ | Firebase プロジェクト | 用途 |
|---|---|---|
| `develop` | `fire-fire-dev` | 開発・検証 |
| `main` | `fire-fire-prod` | 本番 |

| ワークフロー | トリガー | 内容 |
|---|---|---|
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | `develop` / `main` 宛ての PR | `wip-check` / `frontend` / `backend` の3ジョブを並列実行 |
| [.github/workflows/claude-review.yml](../.github/workflows/claude-review.yml) | PR の `opened` / `synchronize` | Claude による自動レビューコメント（マージはブロックしない） |
| [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | `develop` / `main` への push（=マージ） | Functions / Firestore / Storage をデプロイし、App Hosting のロールアウトを作成 |

デプロイ対象は Frontend（Next.js / App Hosting）・Backend（Cloud Functions）・Firestore ルール/インデックス・Storage ルールの4つ。App Hosting の GitHub 自動連携は使わず、CI がパスしたことをデプロイの前提にできるよう GitHub Actions から Firebase CLI を叩く方式に統一している。

## 2. サービスアカウントと Workload Identity 連携

`fire-fire-dev` / `fire-fire-prod` の**両方**で実施する。長期有効なサービスアカウント鍵は GitHub に置かない。

```bash
# ここを dev / prod で切り替えて2回実行する
PROJECT_ID=fire-fire-dev
GITHUB_REPO=KunitoObara/private_room

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT_ID"

gcloud iam service-accounts create github-actions-deployer \
  --project="$PROJECT_ID" --display-name="GitHub Actions Deployer"

for role in \
  roles/firebaseapphosting.admin \
  roles/cloudfunctions.admin \
  roles/datastore.owner \
  roles/firebaserules.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.writer
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" --role="$role" --condition=None
done

# Workload Identity プール／プロバイダを作り、対象リポジトリからのみ引き受けられるよう条件を絞る
gcloud iam workload-identity-pools create github \
  --project="$PROJECT_ID" --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${GITHUB_REPO}'"

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}"

# Secrets に登録する値
echo "GCP_WIF_PROVIDER: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github"
echo "GCP_SA_EMAIL:     ${SA}"
```

> 上記のロールは最小構成の想定。`firebase deploy` が権限エラーで落ちる場合は、エラーメッセージが要求するロール（`roles/run.admin`・`roles/cloudbuild.builds.editor`・`roles/storage.admin` など）を必要な分だけ追加する。

## 3. GitHub の Secrets / Variables

リポジトリの Settings → Secrets and variables → Actions で登録する。

**Secrets**

| 名前 | 値 |
|---|---|
| `GCP_WIF_PROVIDER_DEV` | `fire-fire-dev` のプロバイダのリソース名 |
| `GCP_WIF_PROVIDER_PROD` | `fire-fire-prod` のプロバイダのリソース名 |
| `GCP_SA_EMAIL_DEV` | `github-actions-deployer@fire-fire-dev.iam.gserviceaccount.com` |
| `GCP_SA_EMAIL_PROD` | `github-actions-deployer@fire-fire-prod.iam.gserviceaccount.com` |
| `ANTHROPIC_API_KEY` | PR 自動レビュー用の API キー |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | CI のフロントエンドビルド用。Firebase コンソール（プロジェクトの設定 → マイアプリ → ウェブアプリ）の値 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 同上 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 同上 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 同上 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 同上 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 同上 |

`NEXT_PUBLIC_*` は CI の `npm run build` にのみ渡す（CI からはデプロイしない）。デプロイ環境で使う値は GitHub の Secrets ではなく、5章のとおり各 Firebase プロジェクトの Secret Manager に登録する。

**Variables**

| 名前 | 値 |
|---|---|
| `APPHOSTING_BACKEND_ID` | 4章で作成する App Hosting バックエンドの ID（dev/prod で同じ ID を使う前提） |

未設定のまま `develop` / `main` に push した場合、`deploy` ジョブは冒頭の確認ステップで「設定が不足しています」と表示して停止する（環境をまたいだ誤デプロイを防ぐため）。

`main` 向けには GitHub Environment `production` を作成し、承認を必須にするかを判断する（`deploy.yml` は `main` で `production`、`develop` で `development` の Environment を参照する）。

## 4. App Hosting バックエンドの作成

**ルートディレクトリは `src/frontend`** にする。これによりビルド対象がフロントエンド配下に閉じ、`docs/` などが Next.js のビルドに含まれなくなる。

```bash
firebase apphosting:backends:create --project fire-fire-dev
```

対話で以下を指定する。

- リージョン: `asia-east1`（東京に近い対応リージョンを選ぶ）
- GitHub リポジトリ: `KunitoObara/private_room`
- ルートディレクトリ: `src/frontend`
- ライブブランチ: **設定しない／自動ロールアウトは無効にする**（デプロイは `deploy.yml` から明示的に行うため）
- バックエンド ID: 例 `fire-fire`（`fire-fire-prod` でも同じ ID で作成し、3章の `APPHOSTING_BACKEND_ID` に設定する）

`src/frontend/apphosting.yaml` はこのルートディレクトリ直下にあるため、そのままビルド設定として読まれる。ルートディレクトリ自体は `apphosting.yaml` では指定できず、このバックエンド作成時の設定である点に注意。

## 5. 環境変数（Secret Manager）の登録

`src/frontend/apphosting.yaml` は Firebase クライアント SDK の設定値を Secret Manager から読む。dev/prod それぞれのプロジェクトに、**同じ名前**でシークレットを作る。

```bash
cd src/frontend
for key in \
  NEXT_PUBLIC_FIREBASE_API_KEY \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
  NEXT_PUBLIC_FIREBASE_APP_ID
do
  firebase apphosting:secrets:set "$key" --project fire-fire-dev
done
```

値は Firebase コンソール（プロジェクトの設定 → マイアプリ → ウェブアプリ）のものを使う。`NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` はローカル開発専用なので**登録しない**（デプロイ環境に設定するとエミュレータへ繋ごうとして認証が壊れる）。

## 6. ブランチ保護ルール

`develop` と `main` の両方に設定する（Settings → Branches）。

- Pull Request 必須（直接 push を禁止）
- 必須ステータスチェック: `wip-check` / `frontend` / `backend`
  - これにより Lint・テストが NG の PR、タイトルに `WIP` を含む PR はマージボタンが押せなくなる
  - `claude-review` は**含めない**（レビューはコメントのみで、人間の判断を残す）
- 「Require branches to be up to date before merging」を有効化
- Force push / ブランチ削除を禁止
- `main` は加えて、`develop` からの PR のみ受け付ける運用とする

## 7. 動作確認

1. わざと Lint エラーを含む PR を出し、CI が落ちてマージがブロックされることを確認
2. タイトルを `WIP: ...` にした PR で `wip-check` が落ち、`WIP` を外して再実行するとパスすることを確認
3. PR 作成時に Claude のレビューコメントが自動で付くことを確認
4. `develop` へマージし、`fire-fire-dev` にデプロイされて画面が開くことを確認
5. `main` へマージし、`fire-fire-prod` にデプロイされることを確認
6. `docs` のみを変更した PR をマージし、デプロイ成果物に `docs` が含まれないことを確認

## 8. 今後の検討事項（オープン課題）

- デプロイ失敗時の自動ロールバックは導入していない。失敗は GitHub の通知で気づく運用とする
- `docs` のみの変更でもデプロイジョブは走る構成。ビルド時間を節約したい場合は `paths-ignore` の追加を検討する
- `src/backend` に Prettier を導入していない（`src/backend/docs/TECH_STACK.md` 8章では ESLint + Prettier としている）。CI の backend ジョブは現状 Lint / ビルド / テストのみ
