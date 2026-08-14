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
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | `develop` / `main` 宛ての PR | `wip-check` / `hooks` / `frontend` / `backend` の4ジョブを並列実行 |
| [.github/workflows/claude-review.yml](../.github/workflows/claude-review.yml) | PR の `opened` / `synchronize` | Claude による自動レビューコメント（マージはブロックしない） |
| [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | `develop` / `main` への push（=マージ） | Functions / Firestore / Storage をデプロイし、App Hosting のロールアウトを作成 |

デプロイ対象は Frontend（Next.js / App Hosting）・Backend（Cloud Functions）・Firestore ルール/インデックス・Storage ルールの4つ。App Hosting の GitHub 自動連携は使わず、CI がパスしたことをデプロイの前提にできるよう GitHub Actions から Firebase CLI を叩く方式に統一している。

## 2. サービスアカウントと Workload Identity 連携

`fire-fire-dev` / `fire-fire-prod` の**両方**で実施する。長期有効なサービスアカウント鍵は GitHub に置かない。

> **リポジトリのフルネームが2箇所に焼き込まれる。** 下のプロバイダの `--attribute-condition` と、サービスアカウントの IAM バインディングの `principalSet` である。GitHub の OIDC トークンの `repository` クレームは**現在の**名前を返すため、リポジトリを改名したり Organization へ移管したりすると、両方を直すまで `deploy.yml` の認証ステップが落ちる。dev / prod の2プロジェクト × 2箇所で計4箇所。
>
> 直す順番は「先に広げてから改名する」。デプロイが落ちる時間帯を作らずに済む。
>
> 1. 条件を `assertion.repository == '<旧>' || assertion.repository == '<新>'` に広げ、新名の `principalSet` を**追加**する（`gcloud iam workload-identity-pools providers update-oidc` と `add-iam-policy-binding`）
> 2. GitHub 側で改名する
> 3. `develop` へのマージでデプロイが緑になるのを確認する
> 4. 条件を新名だけに戻し、旧名の `principalSet` を `remove-iam-policy-binding` で外す
>
> 3 の確認前に 4 をやらないこと。認証が通ることを確かめないまま退路を断つことになる。

```bash
# ここを dev / prod で切り替えて2回実行する
PROJECT_ID=fire-fire-dev
GITHUB_REPO=KunitoObara/FIRE_FIRE

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

トークンの登録だけでは PR 自動レビューは動かない。https://github.com/apps/claude からアプリを **`KunitoObara/FIRE_FIRE` に対してインストール**する必要がある。未インストールだと `claude-review` ジョブが以下のエラーで失敗する（CI の必須チェックには含めていないため、マージ自体はブロックされない）。

```
401 Unauthorized - Claude Code is not installed on this repository.
```

**自動レビューはデフォルトブランチ（`develop`）に入るまで動かない**

App をインストールしても、`claude-review.yml` がデフォルトブランチに存在して**内容が完全一致**するまで、action は Claude を起動せずスキップする。PR 側でワークフローを書き換えて `ANTHROPIC_API_KEY` を盗み出す攻撃を防ぐための仕様。

```
Skipping action due to workflow validation: The workflow file must exist and have
identical content to the version on the repository's default branch.
```

スキップされてもジョブは**成功扱いで終わる**ため、「CI は緑なのにレビューコメントだけ付かない」という見え方になる。原因を調べるときはジョブのログを確認する。

本リポジトリのデフォルトブランチは **`develop`** である（`main` ではない。理由は Trelloカード [X9](https://trello.com/c/2o49Qdli) — Dependabot のセキュリティ更新PRがデフォルトブランチに向くため、`main` のままだと本番へ直行する）。したがって検証先も `develop` になる。

- `claude-review.yml` を編集した場合、その変更は `develop` に入るまで反映されない（編集を含む PR 自体は再びスキップされる）
- **デフォルトブランチが `main` だった頃は `develop` → `main` のマージまで済ませないと反映されなかった。** 1段ぶん早く効くようになっている

### 外部PRを手動でレビューする

**fork から出た PR は自動レビューの対象外**である。`claude-review.yml` の `review` ジョブに、PR の head がこのリポジトリ内にあり、かつ作成者が `OWNER` / `COLLABORATOR` / `MEMBER` のときだけ走る条件を付けてある。

除いているのは、**fork からの PR には Secrets が渡らず `claude_code_oauth_token` が空になり、レビューを投稿しないままジョブが失敗するから**である。失敗させても得るものが無いので、スキップに倒している。あわせて Actions の fork PR 承認ポリシーを `all_external_contributors` にしてあり、そもそもオーナーが承認するまで外部 PR ではどのワークフローも起動しない。

外部 PR をレビューしたいときは、オーナーが手動で実行する。

```bash
gh workflow run claude-review.yml -f pr_number=<PR番号>
```

Actions タブの "Claude PR Review" → "Run workflow" からでも同じ。`workflow_dispatch` は**ベースリポジトリの文脈で走るため Secrets が使え**、fork からの PR でもレビューできる。

- 実行できるのは書き込み権限を持つ者だけなので、「オーナーが承認したときだけレビューする」という運用がこれで成立する
- 手動実行は対象 PR の `refs/pull/<番号>/head` をチェックアウトする（`merge` ではない。コンフリクトしている PR では `merge` ref が作られずチェックアウトごと失敗するため）
- **`workflow_dispatch` はワークフローファイルがデフォルトブランチに載って初めて選べるようになる。** トリガーを足した PR の時点では実行できない

`main` 向けには GitHub Environment `production` を作成し、承認を必須にするかを判断する（`deploy.yml` は `main` で `production`、`develop` で `development` の Environment を参照する）。

## 4. App Hosting バックエンドの作成

**ルートディレクトリは `src/frontend`** にする。これによりビルド対象がフロントエンド配下に閉じ、`docs/` などが Next.js のビルドに含まれなくなる。

```bash
firebase apphosting:backends:create --project fire-fire-dev
```

対話で以下を指定する。

- リージョン: `asia-east1`（東京に近い対応リージョンを選ぶ）
- GitHub リポジトリ: `KunitoObara/FIRE_FIRE`
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

2FA リカバリーコードの検証（`useMfaRecoveryCode`）と、B10 の本人確認（`resetMfaEnrollment`・`unlinkPasswordProvider`・`generateMfaRecoveryCodes` の再発行時）は、サーバー側から Identity Platform の REST API でパスワードを再確認する（[auth-login-requirements.md](./auth-login-requirements.md) 3.3、[screen-requirements-account.md](./screen-requirements-account.md) B10）。そのための Web API キーを Secret Manager に登録する。**登録しないと functions のデプロイが「シークレットが存在しない」で失敗する。**

本人確認を使う関数が増えても、参照するシークレットは同じ 1 件なので、この節の設定を追加でやり直す必要はない。

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

### Artifact Registry のクリーンアップポリシー（手動設定は不要）

**この節に手動作業は無い。** [deploy.yml](../.github/workflows/deploy.yml) の「Artifact Registry のクリーンアップポリシーを設定する」ステップが毎回設定するので、通常は読み飛ばしてよい。以下は、なぜそのステップが要るのかと、新しいプロジェクト／リージョンを足したときに何が起きるかの説明。

Cloud Functions のコンテナイメージは Artifact Registry に蓄積する。firebase-tools は自動削除ポリシーが未設定のリージョンを見つけると保持日数を尋ねるが、**CI は非対話のため確認プロンプトを出せず、関数のデプロイ自体は成功した状態でエラー終了する**。

```
Error: Functions successfully deployed but could not set up cleanup policy in location asia-northeast1.
```

`firebase deploy` が exit != 0 で終わるため**ジョブがそこで止まり、後続の App Hosting ロールアウトごと飛ぶ**（フロントエンドだけ古いまま残る）。再実行しても同じ場所で止まるので、放っておくとデプロイが赤のまま固定される。実際に prod で発生した（2026-08-07、関数6つの初回デプロイ）。

そのため deploy.yml では、**functions のデプロイより前**に次を実行する。

```bash
firebase functions:artifacts:setpolicy --project "$FIREBASE_PROJECT" --location "$region" --force
```

- 保持日数は既定の1日。イメージはビルド済みの成果物で、再デプロイはソースから行えるため長く持つ理由が無い（[src/backend/docs/TECH_STACK.md](../src/backend/docs/TECH_STACK.md) 9章のコスト管理）
- `$region` はワークフローに直書きせず、`firebase functions:list --json` が返すデプロイ済み関数のリージョンから引く。リージョンを増やしてもワークフローの変更は要らない
- 冪等。設定済みのリージョンでは `No changes needed.`、`gcf-artifacts` がまだ無いリージョンでは `does not exist in Artifact Registry` と出て、**いずれも exit 0** で終わる。毎回無条件に流してよい
- `firebase deploy` 側に `--force` を付ける方法もあるが、`--force` はソースから消えた関数の削除確認もスキップしてしまう（誤ってファイルを消したときに本番の関数が黙って消える）ため採らない

**新しいプロジェクト、または新しいリージョンを足したときだけ、初回のデプロイが1度失敗する。** リポジトリ（`gcf-artifacts`）は最初の functions デプロイで作られるため、それまでは `functions:list` にも現れず先回りして設定できないため。ただし関数自体はその回に作成されるので、**ワークフローを再実行すれば上のステップが効いて緑に戻る**。手で `setpolicy` を打つ必要は無い。

## 6. ブランチ保護ルール

**リポジトリを公開した時点で設定できるようになる。** 個人アカウントの無料プランでは、ブランチ保護はパブリックリポジトリの機能であり、プライベートの間はクラシックな Branch protection・Rulesets のどちらも API が 403 を返していた。

```
Upgrade to GitHub Pro or make this repository public to enable this feature.
```

保護が無い間は **CI が失敗してもマージボタンが押せる**状態で、「赤いチェックが付いた PR はマージしない」という運用でカバーしていた。公開後はそれを GitHub 側に強制させる。

`develop` と `main` の両方に設定する（Settings → Branches）。

- Pull Request 必須（直接 push を禁止）
- 必須ステータスチェック: `wip-check` / `hooks` / `frontend` / `backend`
  - これにより Lint・テストが NG の PR、タイトルに `WIP` を含む PR はマージボタンが押せなくなる
  - `claude-review` は**含めない**（レビューはコメントのみで、人間の判断を残す）
  - **fork からの PR では `frontend` が必ず失敗する。** Secrets が渡らないためで、ビルドは `NEXT_PUBLIC_FIREBASE_*` を要求する（[3 章](#3-github-の-secrets--variables)）。必須チェックにしている以上そのままではマージできないが、これは意図した状態であり、外部からの PR を取り込む必要が出たときに改めて考える
  - `claude-review` は fork からの PR では**スキップ**される（失敗ではない）。必須チェックに含めていないのでマージ判定には影響しない。レビューする手順は [3 章](#外部prを手動でレビューする)
- 「Require branches to be up to date before merging」を有効化
- Force push / ブランチ削除を禁止
  - force push はローカルでも `.claude/settings.json` の `PreToolUse` フックが止めている。こちらはサーバー側の裏付けで、二重に掛ける
- 「Do not allow bypassing the above settings」（管理者にも適用）
  - 入れないと、リポジトリ管理者である開発者本人は既定ですべてを迂回できる。1 人開発なので迂回しない運用も成り立つが、規律をツール側に持たせる方針（`gh pr merge` の deny、force push のフック）と揃える
- 「Require approvals」は**設定しない**。1 人開発では自分の PR を自分で承認できず、マージが不可能になる
- `main` は加えて、`develop` からの PR のみ受け付ける運用とする

### マージできるユーザーを名指しで限定することについて

**個人アカウントのリポジトリではできない。** 「Restrict who can push to matching branches」は Organization 所有のリポジトリ専用の設定で（GitHub Free の Organization が持つパブリックリポジトリ、および Team / Enterprise の全リポジトリ）、個人アカウントの設定画面には現れない。

ただし**必要でもない**。個人リポジトリで push・マージができるのは、明示的に招待したコラボレーターだけであり、現在それは開発者 1 人（admin）である。パブリックにしても外部の人間にできるのは fork して PR を出すところまでで、マージ権限は生じない。「限定されたユーザーだけがマージできる」状態は既に満たされている。

将来「push はできるがマージはできない協力者」のような区別が要るようになったら、Organization への移管が必要になる（Free の Organization + パブリックリポジトリで branch restrictions が使えるので、費用は増えない）。**その際は Workload Identity 連携が壊れる**ことに注意する。[2 章](#2-サービスアカウントと-workload-identity-連携)の principalSet が `attribute.repository/${GITHUB_REPO}` でリポジトリのフルネームに紐づいているため、IAM バインディングの貼り直しと Secrets / Variables の再登録が要る。1 人で開発している間は移管する利点が無いので、人を増やすときに初めて検討する。

## 7. 動作確認

1. わざと Lint エラーを含む PR を出し、CI が落ち、6 章の必須ステータスチェックによってマージボタンが押せなくなることを確認
2. タイトルを `WIP: ...` にした PR で `wip-check` が落ち、`WIP` を外して再実行するとパスすることを確認
3. PR 作成時に Claude のレビューコメントが自動で付くことを確認（3章のとおり、`claude-review.yml` が `main` に入った後の PR で確認する）
4. `develop` へマージし、`fire-fire-dev` にデプロイされて画面が開くことを確認
5. `main` へマージし、`fire-fire-prod` にデプロイされることを確認
6. `docs` のみを変更した PR をマージし、デプロイ成果物に `docs` が含まれないことを確認

## 8. 既知の問題

### firebase-tools は 15.22.3 以降を使う必要がある

デプロイが以下のエラーで失敗することがある（[firebase-tools#10716](https://github.com/firebase/firebase-tools/issues/10716)）。ADC は正しく設定されているのに出るため、認証設定側を疑って時間を溶かしやすい。

```
Error: Failed to authenticate, have you run firebase login?
```

原因は認証設定でもタイムアウトでもない。google-auth-library のトランスポートが **keep-alive したソケットを再利用**する際に、Node.js 22.23.0 / 24.17.0 のリグレッションで `Premature close` になる。firebase-tools は `autoAuth()` の例外を握りつぶして上のメッセージに差し替えるため（[requireAuth.ts](https://github.com/firebase/firebase-tools/blob/master/src/requireAuth.ts)）、実際の失敗理由が表に出ない。

ソケット再利用が起きるかどうかはタイミング次第なので、**同じコミット・同じ環境でも成功したり失敗したりする**。再実行で直るのはこのため。

[firebase-tools#10717](https://github.com/firebase/firebase-tools/pull/10717) が `GoogleAuth` に keep-alive しないエージェントを渡す回避を入れ、**15.22.3** で出荷された。`deploy.yml` はこれを含む 15.26.0 に固定している。**バージョンを下げるときは 15.22.3 を下回らせないこと。**

> **かつて「15.22.2 以降の回帰なので 15.22.1 に固定して回避している」と書いていたのは誤り。**
> 15.22.1 と 15.22.3 の `google-auth-library` 依存はどちらも `^9.11.0` で同一なので、15.22.1 も同じリグレッションを踏む。固定先が回避の入る手前を指していたぶん、むしろ踏み続ける状態だった。実際、15.22.1 に固定したまま失敗した（[PR #54 マージ後のデプロイ](https://github.com/KunitoObara/FIRE_FIRE/actions/runs/31123642113)。再実行3回目で成功）。
>
> 切り分けの参考として、否定できた仮説も残しておく。
>
> - **`requireAuth` のタイムアウト説** — `autoAuth()` のタイムアウトは 15.22.1 から最新まで一貫して15秒。上記の失敗はステップ開始から4.6秒で起きており発火していない
> - **`google-github-actions/auth` に `token_format: access_token` を指定してアクセストークンを直接渡す案** — firebase-tools は `GOOGLE_OAUTH_ACCESS_TOKEN` を参照しない（gcloud とは異なる）。[firebase-tools#10726](https://github.com/firebase/firebase-tools/issues/10726) に機能要望として挙がっている段階で、現状は取れない手段

再発した場合は、まずデプロイを再実行して切り分ける。それで通るならこの問題で、firebase-tools 側の回避が効かなくなった可能性を疑う（Node.js のバージョンが上がったときなど）。再実行しても通らないなら別の原因なので、認証設定側（2章のサービスアカウント権限、Workload Identity の設定）を見る。

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

## 14. サインアップ許可リストの運用（ベータ期間中）

ベータ期間中は、あらかじめ承認したメールアドレスだけがアカウントを作成できる（[auth-login-requirements.md](./auth-login-requirements.md) 3.10）。判定は Blocking Function `restrictSignUpToAllowlist` が行い、**承認の操作はコンソールでのドキュメント追加だけ**である。

**この節の作業はコードのデプロイでは済まない。** 許可リストは Firestore のデータであり、リポジトリには入らない。

### 承認する（招待する）

Firebase コンソール → Firestore Database → コレクション `signupAllowlist` に、**ドキュメント ID を招待するメールアドレス**としてドキュメントを1件作る。

- **ドキュメント ID は小文字・前後の空白なし**にする。判定側も同じ正規化をしてから照合するので大文字で登録しても通るが、リストを目で見たときに揃っていたほうが重複に気づける
- **フィールドは判定に使わない。** ドキュメントが存在すること自体が承認の印である。誰をいつ招待したかを残したい場合は `note` / `invitedAt` のような任意のフィールドを足してよい
- **プロジェクトごとに別のリストになる。** `fire-fire-dev`（STG）と `fire-fire-prod`（本番）の両方で有効なので、**開発用のテストアカウントを作るには dev 側のリストにもそのアドレスを入れる**

### 承認を取り消す

ドキュメントを削除する。**既に作成済みのアカウントには影響しない** — このリストが効くのはアカウント作成の瞬間だけである。作成済みのアカウントを止めたい場合は、コンソールでそのユーザーを無効化する。

### 締め出されたときの逃げ道

**Blocking Functions は Admin SDK・コンソールからのユーザー作成では発火しない。** リストの設定を誤っても、コンソールからユーザーを直接作る手段は残る。

> **この挙動は初回のデプロイ後に `fire-fire-dev` で実際に確かめる。** 前提が外れていた場合、リストの誤設定から復旧できなくなるため（3.10 に同じ注記がある）。

### ベータを終えるとき

この制限は恒久的な仕様ではない。`noindex` の解除・A0 の「現在は招待制」の記述と同じタイミングで外す（[X4](https://trello.com/c/8wpkp9Gt)）。

**順序を守る。先に手動で関数を削除し、そのあとで export を落とす。**

```bash
# 1. プロジェクトごとに手動で削除する（対話実行。dev と prod の両方）
firebase functions:delete restrictSignUpToAllowlist \
  --region asia-northeast1 --project fire-fire-dev

# 2. src/backend/src/index.ts から export を落として、通常どおり develop → main へ流す
```

**逆の順序にするとデプロイが中断する。** export を先に落として push すると、ソースから消えた関数が本番に残っている状態になる。`deploy.yml` の `firebase deploy` は `--non-interactive` で、かつ **`--force` を意図的に付けていない**（8 章。`--force` はソースから消えた関数の削除確認までスキップするため）。この組み合わせでは firebase-tools が削除の確認を出せず、**`FirebaseError` を投げてデプロイを中断する**（`Aborting because deletion cannot proceed in non-interactive mode`）。

デプロイのステップが落ちるとジョブが止まり、**後続の App Hosting ロールアウトごと飛ぶ**（8 章の Artifact Registry の件と同じ壊れ方で、フロントエンドだけ古いまま残る）。回復はできる — エラーが表示するとおり手動で削除してワークフローを再実行すればよい — が、本番のデプロイを一度赤にしてから気づくことになる。

> この挙動は firebase-tools の `lib/deploy/functions/prompts.js`（`promptForFunctionDeletion`）で確かめられる。`options.force` が真なら確認を飛ばして削除し、偽かつ `options.nonInteractive` なら `firebase functions:delete` のコマンドを添えて `FirebaseError` を投げる。

**Firestore のコレクションを空にする形では外さない。** 空のリストは「誰も承認されていない」という意味になり、全員が拒否される。関数を消したあとであれば、コレクションは残しても消してもよい。

## 15. 今後の検討事項（オープン課題）

- デプロイ失敗時の自動ロールバックは導入していない。失敗は GitHub の通知で気づく運用とする
- `docs` のみの変更でもデプロイジョブは走る構成。ビルド時間を節約したい場合は `paths-ignore` の追加を検討する
- `src/backend` に Prettier を導入していない（`src/backend/docs/TECH_STACK.md` 8章では ESLint + Prettier としている）。CI の backend ジョブは現状 Lint / ビルド / テストのみ

## 16. 参考リンク

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
