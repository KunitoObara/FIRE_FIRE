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

値は Firebase コンソール（プロジェクトの設定 → マイアプリ → ウェブアプリ）のものを使う。`NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` はローカル開発専用なので**登録しない**（デプロイ環境に設定するとエミュレータへ繋ごうとして認証が壊れる）。

登録後、App Hosting のバックエンドから読めるように IAM を付与する。これを忘れるとビルドがシークレット解決で失敗する。

```bash
firebase apphosting:secrets:grantaccess \
  NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID \
  --project fire-fire-dev --backend fire-fire
```

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

## 9. 今後の検討事項（オープン課題）

- デプロイ失敗時の自動ロールバックは導入していない。失敗は GitHub の通知で気づく運用とする
- `docs` のみの変更でもデプロイジョブは走る構成。ビルド時間を節約したい場合は `paths-ignore` の追加を検討する
- `src/backend` に Prettier を導入していない（`src/backend/docs/TECH_STACK.md` 8章では ESLint + Prettier としている）。CI の backend ジョブは現状 Lint / ビルド / テストのみ

## 10. 参考リンク

- [Firebase App Hosting のドキュメント](https://firebase.google.com/docs/app-hosting)
- [google-github-actions/auth（Workload Identity 連携）](https://github.com/google-github-actions/auth)
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
