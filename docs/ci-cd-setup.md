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

# デプロイに必要なAPIを先に有効化しておく。
# デプロイ用サービスアカウントにAPI有効化権限（serviceusage.services.enable）を
# 与えずに済ませるため、ここでまとめて有効化する。
# 複数を1コマンドで指定すると失敗することがあるので1件ずつ実行する。
for api in \
  iamcredentials.googleapis.com sts.googleapis.com \
  cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com storage.googleapis.com \
  firestore.googleapis.com firebaserules.googleapis.com firebasestorage.googleapis.com \
  secretmanager.googleapis.com cloudbilling.googleapis.com firebaseextensions.googleapis.com
do
  gcloud services enable "$api" --project="$PROJECT_ID"
done

gcloud iam service-accounts create github-actions-deployer \
  --project="$PROJECT_ID" --display-name="GitHub Actions Deployer"

for role in \
  roles/firebaseapphosting.admin \
  roles/cloudfunctions.admin \
  roles/datastore.owner \
  roles/firebaserules.admin \
  roles/firebasestorage.admin \
  roles/developerconnect.user \
  roles/developerconnect.readTokenAccessor \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.writer
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" --role="$role" --condition=None
done

# ログイン通知の Blocking Function（`sendLoginNotification`）のデプロイには、
# Identity Platform の設定（テナント設定に相当）の書き換えが要る。既定のロールには
# 含まれないため、必要な2権限だけのカスタムロールを作って付与する。
# 付与しないと、関数の作成まで進んだあと 403 でデプロイが失敗する（13.4）。
#
# 既に作成済みなら作り直さない。下の注記のとおりこのブロックは失敗時に再実行する運用で、
# `roles create` は同名ロールがあると ALREADY_EXISTS で止まってしまうため。
# 逆に、後から `--permissions` を変えたい場合はこの分岐では反映されない（`describe` が
# 通ってスキップされる）。そのときは `gcloud iam roles update` で明示的に更新する。
gcloud iam roles describe firebaseAuthConfigWriter --project="$PROJECT_ID" >/dev/null 2>&1 || \
gcloud iam roles create firebaseAuthConfigWriter \
  --project="$PROJECT_ID" \
  --title="Firebase Auth Config Writer" \
  --description="Blocking Functions の登録に必要な Identity Platform 設定の読み書き" \
  --permissions=firebaseauth.configs.get,firebaseauth.configs.update \
  --stage=GA

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="projects/$PROJECT_ID/roles/firebaseAuthConfigWriter" --condition=None

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

> 作成直後のサービスアカウントは伝播に少し時間がかかり、続けて実行する `add-iam-policy-binding` が最初の1〜2件だけ失敗することがある。失敗したロールを再実行すれば通る。

> `developerconnect` の2つは App Hosting のロールアウト作成に必要。`user` が `gitRepositoryLinks.fetchGitRefs`、`readTokenAccessor` が `fetchReadToken` を担当し、片方だけでは足りない（`roles/developerconnect.viewer` は `user` に包含されるので不要）。

> 上記のロールは最小構成の想定。`firebase deploy` が権限エラーで落ちる場合は、エラーメッセージが要求するロール（`roles/run.admin`・`roles/cloudbuild.builds.editor`・`roles/storage.admin` など）を必要な分だけ追加する。IAM の変更は反映まで1〜2分かかることがあるため、付与直後に失敗した場合は少し待って再実行する。

### Firebase Storage を初期化しておく

`firebase deploy --only storage` はデフォルトバケットの存在を前提にする。未初期化のプロジェクトでは以下のエラーになる。

```
Permission 'firebasestorage.defaultBucket.get' denied on resource
'//firebasestorage.googleapis.com/projects/fire-fire-dev/defaultBucket' (or it may not exist).
```

権限エラーに見えるが、実際にはバケットが存在しないだけのことが多い。まず存在を確認する。

```bash
gcloud storage buckets list --project=fire-fire-dev --format='value(name,location)'
```

無ければ Firebase コンソール（Storage → 始める）か、以下の API で作成する。**ロケーションは後から変更できない**ので dev / prod で揃えること（本プロジェクトは `asia-northeast1`）。

```bash
curl -s -X POST \
  "https://firebasestorage.googleapis.com/v1beta/projects/fire-fire-dev/defaultBucket" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"location":"asia-northeast1"}'
```

### `GCP_WIF_PROVIDER_*` の値の形式に注意する

`GCP_WIF_PROVIDER_*` に入れるのは**プロバイダのフルリソース名だけ**。

```
projects/<プロジェクト番号>/locations/global/workloadIdentityPools/<プールID>/providers/<プロバイダID>
```

形式を誤ると、デプロイの「Google Cloudに認証する」ステップで以下のエラーになる。

```
failed to generate Google Cloud federated token for //iam.googleapis.com/***:
Invalid value for "audience". This value should be the full resource name of the Identity Provider.
```

ありがちな誤りは3つ。

- **`//iam.googleapis.com/` を含めてしまう** — Google Cloud コンソールの「Workload Identity 連携」画面が表示する*既定の対象ユーザー（audience）*はこのプレフィックス付き。action 側が自分で付けるため、コピーする際は `projects/` 以降だけにする。**コンソールで設定した場合はこれを踏みやすい**
- **プロジェクトID（`fire-fire-dev`）を使う** — ここは**プロジェクト番号**（数字）
- **`/providers/<プロバイダID>` が抜ける** — プール止まりの値になっている

コンソールで設定した場合は、次のコマンドで正しい値を確認できる（出力をそのまま Secret に入れる）。

```bash
gcloud iam workload-identity-pools providers describe github \
  --project=fire-fire-dev --location=global \
  --workload-identity-pool=github --format='value(name)'
```

## 3. GitHub の Secrets / Variables

リポジトリの Settings → Secrets and variables → Actions で登録する。

**Secrets**

| 名前 | 値 |
|---|---|
| `GCP_WIF_PROVIDER_DEV` | `fire-fire-dev` のプロバイダのリソース名 |
| `GCP_WIF_PROVIDER_PROD` | `fire-fire-prod` のプロバイダのリソース名 |
| `GCP_SA_EMAIL_DEV` | `github-actions-deployer@fire-fire-dev.iam.gserviceaccount.com` |
| `GCP_SA_EMAIL_PROD` | `github-actions-deployer@fire-fire-prod.iam.gserviceaccount.com` |
| `CLAUDE_CODE_OAUTH_TOKEN` | PR 自動レビュー用。ローカルで `claude setup-token` を実行して発行する（Claude Pro / Max の契約が必要） |
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

**PR 自動レビューの認証方式**

サブスクリプション（Claude Pro / Max）の OAuth トークンを使う。API の従量課金は使わない。

```bash
claude setup-token
```

出力された**トークン文字列だけ**を `CLAUDE_CODE_OAUTH_TOKEN` として登録する。説明文やターミナルの折り返しを一緒にコピーすると値が壊れ、認証リクエストが送信時点で弾かれる。API キー方式（`anthropic_api_key`）でも動作するが、その場合は Anthropic Console でのクレジット購入が別途必要になる。

### レビューが失敗するときは `show_full_output` を有効にする

action は失敗しても既定では `is_error: true` としか出さず、**エラー本文を握りつぶす**。原因を見るには action の入力に以下を追加する。

```yaml
show_full_output: true
```

`claude_args` に `--debug` を渡しても SDK には届かないので効果がない（入力パラメータであって CLI 引数ではない）。これを有効にすると、例えば次のように実際の理由が出る。

```
API Error: Header 'Authorization' has invalid value
"terminal_reason": "api_error"
```

上はトークンの値が壊れていたときのもの。原因が分かったら、ログが大量に出るうえ機微な情報が出る可能性もあるため**外すこと**。

**Claude GitHub App のインストール**

トークンの登録だけでは PR 自動レビューは動かない。https://github.com/apps/claude からアプリを **`KunitoObara/private_room` に対してインストール**する必要がある。未インストールだと `claude-review` ジョブが以下のエラーで失敗する（CI の必須チェックには含めていないため、マージ自体はブロックされない）。

```
401 Unauthorized - Claude Code is not installed on this repository.
```

**自動レビューはデフォルトブランチ（`main`）に入るまで動かない**

App をインストールしても、`claude-review.yml` が `main` に存在して**内容が完全一致**するまで、action は Claude を起動せずスキップする。PR 側でワークフローを書き換えて `ANTHROPIC_API_KEY` を盗み出す攻撃を防ぐための仕様。

```
Skipping action due to workflow validation: The workflow file must exist and have
identical content to the version on the repository's default branch.
```

スキップされてもジョブは**成功扱いで終わる**ため、「CI は緑なのにレビューコメントだけ付かない」という見え方になる。原因を調べるときはジョブのログを確認する。

本リポジトリのブランチモデル（feature → `develop` → `main`）では、検証先は常にデフォルトブランチの `main` である点に注意する。

- `develop` へマージしただけでは動かない。`develop` → `main` のマージまで済ませて初めて、以降の PR でレビューが投稿される
- 同じ理由で、`claude-review.yml` を後から編集した場合、その変更は `main` に入るまで反映されない（編集を含む PR 自体は再びスキップされる）

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

値は Firebase コンソール（プロジェクトの設定 → マイアプリ → ウェブアプリ）のものを使う。

登録後、App Hosting のバックエンドから読めるように IAM を付与する。これを忘れるとビルドがシークレット解決で失敗する。

```bash
firebase apphosting:secrets:grantaccess \
  NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID \
  --project fire-fire-dev --backend fire-fire
```

### Cloud Functions 用のシークレット（`IDENTITY_PLATFORM_WEB_API_KEY`）

2FA リカバリーコードの検証（`useMfaRecoveryCode`）と、B10 の本人確認（`resetMfaEnrollment`・`generateMfaRecoveryCodes` の再発行時）は、サーバー側から Identity Platform の REST API でパスワードを再確認する（[auth-login-requirements.md](./auth-login-requirements.md) 3.3、[screen-requirements-account.md](./screen-requirements-account.md) B10）。そのための Web API キーを Secret Manager に登録する。**登録しないと functions のデプロイが「シークレットが存在しない」で失敗する。**

```bash
firebase functions:secrets:set IDENTITY_PLATFORM_WEB_API_KEY --project fire-fire-dev
```

- 値は `NEXT_PUBLIC_FIREBASE_API_KEY` と同じ Web API キー（フロントエンドのバンドルにも含まれる公開値）。秘密ではないが、CI からの非対話デプロイで確実に解決できる置き場が必要なため Secret Manager を使う（`.env` 系ファイルはリポジトリで除外している。firebase-tools はパラメータを `.env` ファイルからしか解決せず、CI の環境変数は見ない）
- dev / prod それぞれのプロジェクトで実行する（キーの値はプロジェクトごとに異なる）
- ローカルの Functions エミュレータでは Auth エミュレータがキーを検証しないため、**設定は不要**（コード側でダミーキーに切り替える）

続けて、**デプロイ用サービスアカウントにこのシークレットへの権限を付与する**。忘れると deploy が次のエラーで落ちる。

```
Permission 'secretmanager.secrets.get' denied on resource (or it may not exist)
```

```bash
for PROJECT_ID in fire-fire-dev fire-fire-prod; do
  gcloud secrets add-iam-policy-binding IDENTITY_PLATFORM_WEB_API_KEY \
    --project="$PROJECT_ID" \
    --member="serviceAccount:github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.admin"
done
```

- 付与範囲は**このシークレット1件のみ**にする（プロジェクト全体には付けない）。2章のロール一覧に Secret Manager 系を入れていないのは、シークレットを使う関数が増えたときに対象を絞って追加する運用にするため
- ロールが `roles/secretmanager.admin` なのは、firebase-tools がデプロイ時にシークレットを読むだけでなく、**関数の実行用サービスアカウントへ `roles/secretmanager.secretAccessor` を自動付与する**（`setIamPolicy` を呼ぶ）ため。`viewer` や `secretVersionManager` には `setIamPolicy` が無く、2回目のエラーになる
- gcloud を使わない場合は Cloud Console → Secret Manager → 対象シークレット → 権限 → アクセスを許可 で、上記のプリンシパルに「Secret Manager 管理者」を付与しても同じ

### Cloud Functions 用のシークレット（`RESEND_API_KEY`）

ログイン通知メール（[auth-login-requirements.md](./auth-login-requirements.md) 3.6）は Resend の HTTP API から送る。その API キーを登録する。**登録しないと functions のデプロイが「シークレットが存在しない」で失敗する。** キーの取得と送信ドメインの前提は 13 章にある。

```bash
firebase functions:secrets:set RESEND_API_KEY --project fire-fire-dev
```

- dev / prod それぞれのプロジェクトで実行する。値は同じ Resend アカウントのキーでよいが、どちらの環境からの通知かは**メールの件名**（本番以外は `[dev]` 付き）で見分ける
- ローカルの Functions エミュレータでは未設定でよい。キーが空のときは送信を試みずログに残すだけになる（`src/backend/src/login-notification/mailer.ts`）

デプロイ用サービスアカウントへの権限付与も `IDENTITY_PLATFORM_WEB_API_KEY` と同様に必要。

```bash
for PROJECT_ID in fire-fire-dev fire-fire-prod; do
  gcloud secrets add-iam-policy-binding RESEND_API_KEY \
    --project="$PROJECT_ID" \
    --member="serviceAccount:github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.admin"
done
```

### Artifact Registry のクリーンアップポリシー

Cloud Functions のコンテナイメージは Artifact Registry に蓄積する。firebase-tools は初回デプロイ時に自動削除ポリシーの設定を促すが、**CI は非対話のため確認プロンプトを出せず、関数のデプロイ自体は成功した状態でエラー終了する**（その結果、後続の App Hosting ロールアウトがスキップされる）。

```
Error: Functions successfully deployed but could not set up cleanup policy in location asia-northeast1.
```

一度だけ設定しておけば以後の deploy は通る。

```bash
firebase functions:artifacts:setpolicy --project fire-fire-dev --location asia-northeast1 --force
```

- 保持日数は既定の1日。イメージはビルド済みの成果物で、再デプロイはソースから行えるため長く持つ理由が無い（[src/backend/docs/TECH_STACK.md](../src/backend/docs/TECH_STACK.md) 9章のコスト管理）
- **リポジトリ（`gcf-artifacts`）は最初の functions デプロイで作られる**ため、一度もデプロイしていないプロジェクトでは先回りして設定できない（`does not exist in Artifact Registry` になる）。prod は `main` への初回デプロイが同じ理由で一度失敗するので、そのあとに上記を `--project fire-fire-prod` で実行し、デプロイを再実行する
- `firebase deploy` 側に `--force` を付ける方法もあるが、`--force` はソースから消えた関数の削除確認もスキップしてしまうため採らない

## 6. ブランチ保護ルール

> **現時点では設定できない。** プライベートリポジトリでのブランチ保護は有料プランの機能で、クラシックな Branch protection・Rulesets のどちらも API が 403 を返す。
>
> ```
> Upgrade to GitHub Pro or make this repository public to enable this feature.
> ```
>
> このため **CI が失敗してもマージボタンは押せる**。CI 自体は動作しているので、赤いチェックが付いた PR はマージしない運用でカバーする。解消するには GitHub Pro へのアップグレードか、リポジトリの公開が必要（本アプリは個人資産データを扱うため公開は現実的でない）。以下は有効化できるようになった時点で設定する内容。

`develop` と `main` の両方に設定する（Settings → Branches）。

- Pull Request 必須（直接 push を禁止）
- 必須ステータスチェック: `wip-check` / `frontend` / `backend`
  - これにより Lint・テストが NG の PR、タイトルに `WIP` を含む PR はマージボタンが押せなくなる
  - `claude-review` は**含めない**（レビューはコメントのみで、人間の判断を残す）
- 「Require branches to be up to date before merging」を有効化
- Force push / ブランチ削除を禁止
- `main` は加えて、`develop` からの PR のみ受け付ける運用とする

## 7. 動作確認

1. わざと Lint エラーを含む PR を出し、CI が落ちることを確認（6章のとおり、マージのブロック自体は現行プランでは効かない）
2. タイトルを `WIP: ...` にした PR で `wip-check` が落ち、`WIP` を外して再実行するとパスすることを確認
3. PR 作成時に Claude のレビューコメントが自動で付くことを確認（3章のとおり、`claude-review.yml` が `main` に入った後の PR で確認する）
4. `develop` へマージし、`fire-fire-dev` にデプロイされて画面が開くことを確認
5. `main` へマージし、`fire-fire-prod` にデプロイされることを確認
6. `docs` のみを変更した PR をマージし、デプロイ成果物に `docs` が含まれないことを確認

## 8. 既知の問題

### firebase-tools のバージョンを 15.22.1 に固定している

15.22.2 以降、`requireAuth` 内のタイムアウトに Workload Identity の資格情報交換が間に合わず、ADC が正しく設定されていても以下のエラーでデプロイが失敗する回帰がある（[firebase-tools#10716](https://github.com/firebase/firebase-tools/issues/10716)）。

```
Error: Failed to authenticate, have you run firebase login?
```

実際の ADC のエラーが握りつぶされて汎用メッセージになるため、認証設定側を疑って時間を溶かしやすい。`deploy.yml` では 15.22.1 に固定して回避している。上流で修正されたら固定を外す。

### Storage ルールはデプロイターゲットでバケットを明示している

`firebase.json` の `storage` を**配列**にし、`.firebaserc` の `targets` でプロジェクトごとのバケットを指定している。単一オブジェクトで書くと firebase-tools が `getDefaultBucket()` を呼び、`GET firebasestorage.googleapis.com/v1alpha/projects/<project>/defaultBucket` の結果に依存する（[prepare.js](https://github.com/firebase/firebase-tools/blob/master/src/deploy/storage/prepare.ts) 参照）。

このエンドポイントは**デプロイ用サービスアカウントに対してのみ 404 を返す**（オーナー権限では 200）。`firebasestorage.defaultBucket.get` を保持していても 404 になり、firebase-tools は 404 を「未セットアップ」と解釈するため、次の誤解を招くエラーになる。

```
Error: Firebase Storage has not been set up on project 'fire-fire-dev'.
Go to https://console.firebase.google.com/.../storage and click 'Get Started'
```

コンソールでは Storage のファイルブラウザが正常に表示され、バケットも実在するのにこう出るため原因が掴みにくい。切り分け結果は以下のとおり。

| 呼び出し主体 | `buckets`（一覧） | `defaultBucket` |
|---|---|---|
| オーナー | 200 | 200 |
| デプロイ用サービスアカウント | 200 | **404** |

`storage` を配列にすると `getDefaultBucket()` 自体が呼ばれなくなるため、この問題を回避できる。バケットを増やす場合は `.firebaserc` の `targets` に追加する。

## 9. Identity Platform へのアップグレードと TOTP 2FA の有効化

`fire-fire-dev` / `fire-fire-prod` の**両方**で実施する。A3（2FA登録画面）はこの設定なしでは動かない。

### 9.1 Identity Platform へアップグレードする

Firebase コンソール → Authentication → **Settings（設定）** タブから実行する。コード変更は不要で、既存のクライアント / Admin SDK はそのまま動く。

これで多要素認証・Blocking Functions・監査ログが解禁される（[docs/auth-login-requirements.md](auth-login-requirements.md) 2章・3.3・4.4 の前提）。課金は Blaze プランで MAU 50,000 まで無料。Spark プランのままだと DAU 3,000 の上限が付く。

TOTP を使う前提条件は次の2つで、どちらもアプリ側で満たしている。

- MFA 対応プロバイダが有効であること → メール/パスワードは対応済み
- メールアドレス確認が実装されていること → A2 で実装済み

### 9.2 TOTP を有効化する

**Firebase コンソールに TOTP のトグルは無い。** Admin SDK か REST API でしか設定できない（[TOTP MFA の有効化手順](https://cloud.google.com/identity-platform/docs/admin/enabling-totp-mfa)）。

```bash
curl -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/fire-fire-dev/config?updateMask=mfa" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: fire-fire-dev" \
  -d '{"mfa":{"providerConfigs":[{"state":"ENABLED","totpProviderConfig":{"adjacentIntervals":1}}]}}'
```

`adjacentIntervals` は前後いくつの時間枠のコードまで受け付けるかで、1枠が約30秒。指定できるのは 0〜10 で既定値は 5。既定の 5 は前後約2.5分ぶんを許容するため、資産情報を扱う本アプリでは 1（前後30秒）に絞っている。端末の時刻ずれで弾かれる事象が出たら 2〜3 に緩める。

`fire-fire-prod` にも `fire-fire-dev` を2箇所とも置換して実行する。

### 9.3 有効化を確認する

```bash
curl -s "https://identitytoolkit.googleapis.com/admin/v2/projects/fire-fire-dev/config" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "X-Goog-User-Project: fire-fire-dev" \
  | python3 -c 'import json,sys;m=json.load(sys.stdin).get("mfa",{});t=[p for p in m.get("providerConfigs",[]) if "totpProviderConfig" in p];print(json.dumps(t,indent=2) if t else "TOTP未設定")'
```

> **`mfa` 直下の `"state": "DISABLED"` は異常ではない。**
> `mfa` には2種類の `state` がある。TOTP を制御するのは `mfa.providerConfigs[].state` の方で、`mfa` 直下の `state` は SMS を含む MFA 全体のポリシー（`DISABLED` / `ENABLED` / `MANDATORY`）である。9.2 の公式手順は `mfa` 直下の `state` を設定しないため、TOTP を有効化しても DISABLED のまま残る。設定状況は必ず `providerConfigs` 側で確認すること。
>
> なお `mfa` 直下を `MANDATORY` にすると MFA をサーバー側で全ユーザーに強制できるが、**本アプリでは設定しない**。2FA 必須化はサインアップ後に A3 を挟むアプリ側のフローで実現しており（auth-login-requirements.md 3.3）、`MANDATORY` にすると第2要素を登録する前のログイン自体が弾かれてこのフローが成立しなくなる。

### 9.4 動作確認

フロントエンドはローカル開発でも Firebase Emulator を使わず `fire-fire-dev` に直接繋ぐため（[src/frontend/README.md](../src/frontend/README.md) 「セットアップ」、B0-1）、QR コード表示 → 認証アプリ登録 → 検証成功までローカルの `npm run dev` からそのまま確認できる。

TOTP が未有効の場合、A3 は「2段階認証(TOTP)がプロジェクトで有効になっていません」というエラー表示になる。この文言が出たら本章の設定を疑う。

## 10. Google ログイン（ソーシャルログイン）の有効化

`fire-fire-dev` / `fire-fire-prod` の**両方**で実施する。A8（アカウント連携画面）と A1・A4 の「Googleで続ける」導線は、この設定なしでは `auth/operation-not-allowed` で失敗する（[docs/auth-login-requirements.md](auth-login-requirements.md) 3.8）。

### 10.1 Google プロバイダを有効化する

Firebase コンソール → Authentication → **Sign-in method** タブ → Google → 有効化。プロジェクトの公開名とサポートメールの入力を求められる。OAuth クライアントは Firebase 側が自動生成するため、GCP コンソールでの手動作成は不要。

### 10.2 「メールアドレスごとに 1 つのアカウント」を確認する

Authentication → **Settings** → ユーザーアカウントのリンク設定で、**「メールアドレスごとに 1 つのアカウントを作成する」**（既定）になっていることを確認する。

これが「複数のアカウントを作成する」になっていると、同じメールアドレスでパスワードアカウントと Google アカウントが**別々に**作られ、資産データの所有者が分岐する。A8 の連携フローは前者の設定を前提に `auth/account-exists-with-different-credential` を受けて動くため、必ず既定のままにする。

### 10.3 承認済みドメインを登録する

Authentication → Settings → **承認済みドメイン**に、App Hosting のドメインを追加する。`localhost` と `<project-id>.firebaseapp.com` / `.web.app` は既定で登録済み。App Hosting のカスタムドメインや `*.hosted.app` のドメインを使う場合は、そのホスト名を明示的に追加しないとポップアップが `auth/unauthorized-domain` で失敗する。

### 10.4 動作確認

フロントエンドはローカル開発でも `fire-fire-dev` に直接繋ぐため（B0-1）、実際の Google 認証と連携分岐（`auth/account-exists-with-different-credential`）を含め、A8 の連携フローはローカルの `npm run dev` からそのまま確認できる。`localhost` は 10.3 の承認済みドメインに既定で登録済み。

## 11. 2FA リカバリーコードの動作確認

リカバリーコード（[auth-login-requirements.md](./auth-login-requirements.md) 3.3）は Cloud Functions + Firestore で実装している。フロントエンドはローカル開発でも `fire-fire-dev` にデプロイ済みの Functions / Firestore に直接繋ぐため（B0-1）、発行 → 使用 → TOTP 解除 → A3 で再登録までの通しの確認もローカルの `npm run dev` から行える。次の切り分けも参考にする。

| 確認対象 | 場所 |
|---|---|
| コード生成・正規化・scrypt ハッシュ照合 | `src/backend` のユニットテスト（`npm run test`） |
| パスワード再検証の応答の解釈 | 同上（`fetch` を差し替えて検証） |
| A3 の一覧表示・ダウンロード、A5 の切り替えと失敗表示 | `src/frontend` のユニットテスト（`npm run test`） |
| 発行 → 使用 → TOTP 解除 → A3 で再登録の通し | ローカルの `npm run dev`（`fire-fire-dev` に直結） |

## 12. メールリンクのアクション URL を自前の画面に向ける

`fire-fire-dev` / `fire-fire-prod` の**両方**で実施する。この設定を入れるまで、パスワードリセットメールのリンクは Firebase 標準のリセット画面を開き、**A7（パスワード再設定画面）には到達しない**。

### 12.1 アクション URL の性質

Firebase が送るメール（パスワード再設定・メールアドレス確認）のリンク先は、**プロジェクトに 1 つだけ**設定できる。テンプレートごとには分けられず、どのメールのリンクも同じ URL に `mode` / `oobCode` などのクエリ付きで届く。

```
https://<ホスト>/auth/action?mode=resetPassword&oobCode=XXXX&apiKey=...&lang=ja
```

そのためアプリ側は `/auth/action` を共通の受け口とし、`mode` で振り分ける（`src/frontend/src/app/(auth)/auth/action/page.tsx`）。

| `mode` | 遷移先 |
|---|---|
| `resetPassword` | `/reset-password?oobCode=...`（**A7**） |
| `verifyEmail` | その場で確認を適用し結果を表示（**A2** 側のタブはポーリングで A3 へ進む） |
| その他 | 「このリンクは処理できませんでした」と表示 |

**`verifyEmail` を同じ受け口で扱うのは必須**。アクション URL を切り替えると確認メールのリンクもこの URL に来るため、`resetPassword` だけを実装するとメールアドレス確認（A2）が機能しなくなる。

### 12.2 コンソールで設定する

Firebase コンソール → Authentication → **Templates** タブ → 任意のテンプレート（「パスワードの再設定」など）の編集（鉛筆アイコン）→ **アクション URL をカスタマイズ**。

| プロジェクト | 設定値 |
|---|---|
| `fire-fire-dev` | `https://<dev の App Hosting ドメイン>/auth/action` |
| `fire-fire-prod` | `https://<prod の App Hosting ドメイン>/auth/action` |

保存後、他のテンプレート（メールアドレスの確認）にも同じ URL が反映されていることを確認する。ドメインは 10.3 の**承認済みドメイン**にも登録されている必要がある。

### 12.3 動作確認

アクション URL はプロジェクトに 1 つだけで `fire-fire-dev` の App Hosting ドメインに固定されるため、フロントエンドがローカルの `fire-fire-dev` に直結していても（B0-1）**メールのリンクをそのまま踏むと `localhost` ではなく `fire-fire-dev` の画面が開く**。ローカルの画面(A7)で確認したいときは、届いたメールのリンクから `oobCode` の値を取り出し、次の URL を直接開く。

```
http://localhost:3000/reset-password?oobCode=<コピーした値>
```

メールアドレス確認（A2）は確認状態が Firebase プロジェクト側で更新されるため、リンクを開いたブラウザが `fire-fire-dev` の画面でも、サインアップ元の `localhost` タブがポーリングで自動検知する。メールのリンクから直接 A7 に到達する経路そのもの（`localhost` をアクション URL に設定する経路）は用意していない。

## 13. ログイン通知メール（Resend）の準備

ログイン通知（[auth-login-requirements.md](./auth-login-requirements.md) 3.6 / 3.8）は Blocking Function `sendLoginNotification` が Resend の HTTP API を叩いて送る。repo の外の作業は 2 つある。

1. Resend の API キーを発行し、Secret Manager に登録する（13.1 → 5 章）
2. デプロイ用サービスアカウントに Identity Platform の設定書き換え権限を付与する（2 章のカスタムロール）

**Identity Platform 側へのトリガー登録そのものは `firebase deploy --only functions` が自動で行う**ためコンソールでの登録操作は不要だが、その書き込みを CI のサービスアカウントが行う以上、2 の権限が要る。これが無いと 13.4 のエラーになる。

### 13.1 API キーを発行する

1. <https://resend.com> でアカウントを作る。ログイン通知の宛先になるメールアドレスで登録する（次項の制約のため）
2. API Keys → Create API Key。権限は **Sending access** で足りる
3. 発行された `re_` で始まるキーを、5 章の手順で dev / prod 双方の Secret Manager に登録する

### 13.2 送信元ドメインと宛先の制約

送信元は Resend の共有ドメイン `onboarding@resend.dev` を使う（`src/backend/src/login-notification/mailer.ts` の定数）。DNS 設定なしで送れる代わりに、**宛先は Resend アカウントの登録メールアドレスに限られる**。利用者が開発者 1 人である現状は制約にならないが、他のユーザーへ送る必要が出た時点で所有ドメインの検証（SPF/DKIM）と定数の差し替えが要る（[auth-login-requirements.md](./auth-login-requirements.md) 8 章のオープン課題）。

### 13.3 動作確認

フロントエンドはローカル開発でも `fire-fire-dev` に直結するため（B0-1）、`npm run dev` からログインすれば実際に通知が届く。

- 件名が `[FIRE-FIRE][dev] ログインがありました (パスワード)` / `(Google)` になっていること。ログイン方法が両方とも正しく出るかは、A4 のパスワードログインと「Googleで続ける」の両方で確かめる
- **prod への初回デプロイ後は、本番のログインで件名に `[dev]` が付かないこと**を必ず確認する。環境の判定は実行環境のプロジェクト ID（`GCLOUD_PROJECT` 等、無ければ `FIREBASE_CONFIG`）に依存しており、どれも読めない場合は安全側に倒して本番以外として扱う。つまり設定漏れは「本番の通知に `[dev]` が付いたまま」という形で現れる
- 本文の日時が JST、IP アドレスとブラウザが実際の環境と一致していること
- 2FA を登録済みのアカウントで、**確認コードを入力する前には届かない**こと。`beforeUserSignedIn` は第 2 要素の検証後に発火するため、第 1 要素だけ通った時点では送られない

届かない場合は Cloud Functions のログ（`sendLoginNotification`）を見る。`RESEND_API_KEYが未設定` の警告が出ていればシークレットの登録漏れ、`メールを送信できませんでした` とステータスコードが出ていれば Resend 側の拒否（宛先制約か無効なキー）。**通知の失敗はログインを妨げない**設計なので、ログインが成功していても送信は失敗していることがある。

### 13.4 デプロイが `identitytoolkit` の 403 で失敗する場合

デプロイ用サービスアカウントに 2 章のカスタムロール（`firebaseAuthConfigWriter`）が付いていない。

```
i  functions: creating Node.js 22 (2nd Gen) function sendLoginNotification(asia-northeast1)...
Request to https://identitytoolkit.googleapis.com/admin/v2/projects/<project-id>/config
  had HTTP Error: 403, The caller does not have permission
Functions deploy had errors with the following functions:
	sendLoginNotification(asia-northeast1)
```

**他の関数は成功し、`sendLoginNotification` だけが失敗する**のが特徴。Blocking Function はコードのデプロイに加えて Identity Platform の設定へトリガーの URI を書き込むため、そこだけ追加の権限を要求する。デプロイステップが失敗した時点でジョブが止まるので、後続の App Hosting ロールアウトも実行されず、**フロントエンドも反映されない**。

2 章のカスタムロールを作って付与し、デプロイを再実行する。既定ロールの `roles/firebaseauth.admin` でも解消するが、そちらは**利用者アカウントの作成・削除を含む 16 権限**を CI のサービスアカウントに与えることになるため採っていない。必要なのは `firebaseauth.configs.get` と `firebaseauth.configs.update` の 2 つだけ。

`identitytoolkit.googleapis.com` 自体は 9 章の Identity Platform へのアップグレードで有効化済みのため、API の有効化は不要（未有効なら 403 ではなく `SERVICE_DISABLED` になる）。念のため確かめるなら次のコマンドで、出力があれば有効。

```bash
gcloud services list --enabled --project=fire-fire-dev | grep identitytoolkit
```

## 14. 今後の検討事項（オープン課題）

- デプロイ失敗時の自動ロールバックは導入していない。失敗は GitHub の通知で気づく運用とする
- `docs` のみの変更でもデプロイジョブは走る構成。ビルド時間を節約したい場合は `paths-ignore` の追加を検討する
- `src/backend` に Prettier を導入していない（`src/backend/docs/TECH_STACK.md` 8章では ESLint + Prettier としている）。CI の backend ジョブは現状 Lint / ビルド / テストのみ

## 15. 参考リンク

- [Firebase App Hosting のドキュメント](https://firebase.google.com/docs/app-hosting)
- [google-github-actions/auth（Workload Identity 連携）](https://github.com/google-github-actions/auth)
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
- [Identity Platform: TOTP MFA の有効化](https://cloud.google.com/identity-platform/docs/admin/enabling-totp-mfa)
- [Firebase Authentication: TOTP 多要素認証をウェブアプリに追加する](https://firebase.google.com/docs/auth/web/totp-mfa)
- [Firebase Authentication: Google ログインをウェブアプリに追加する](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase Authentication: 複数の認証プロバイダをアカウントにリンクする](https://firebase.google.com/docs/auth/web/account-linking)
- [Firebase Authentication: メールアクションハンドラをカスタマイズする](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Authentication: ブロッキング関数で拡張する](https://firebase.google.com/docs/auth/extend-with-blocking-functions)
- [Resend: Send with Node.js / REST API](https://resend.com/docs/api-reference/emails/send-email)
