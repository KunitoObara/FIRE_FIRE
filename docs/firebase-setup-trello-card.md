# Firebase設定

## 背景

FIRE-FIREはバックエンドをFirebase(Identity Platform / Cloud Firestore / Firebase Storage / Cloud Functions / Firebase App Hosting)で構成する。Phase 1(認証 + CSV取込 + 基本ダッシュボード)の実装に入る前に、Firebaseプロジェクトの作成とローカル開発環境の準備を完了させる必要がある。

**前提**: Googleアカウントは作成済み。

## 何をやらないといけないのか

- [ ] Firebaseプロジェクトを開発用・本番用の2つ作成する
- [ ] 両プロジェクトの課金プランをBlaze(従量課金)にアップグレードする — Identity Platform / Cloud Functions 2nd gen / App Hostingの利用に必須
- [ ] 各プロジェクトで以下のサービスを有効化する
  - Cloud Firestore
  - Firebase Storage
  - Authentication → **Identity Platform** へのアップグレード(TOTP型2FA必須化のため)
  - Cloud Functions for Firebase
  - Firebase App Hosting
- [ ] ローカルにFirebase CLIをセットアップし、両プロジェクトへログイン・操作できる状態にする
- [ ] `firebase init` でリポジトリにFirebase設定を紐付け、Emulator Suite(Firestore/Auth/Functions)をローカルで起動できる状態にする
- [ ] Firebase App HostingとGitHubリポジトリを接続し、本番用プロジェクトは`main`ブランチ、開発用プロジェクトは開発用ブランチ(未定)に紐付ける
- [ ] Firebase設定値(APIキー等)を`.env.local`(未コミット)へ反映する
- [ ] お支払いアカウントに月額10,000円の予算アラート(Cloud Billing Budgets)を設定し、50%/90%/100%到達時にメール通知が届くようにする

## 手順

1. **プロジェクト作成**
   Firebase Consoleで開発用・本番用のプロジェクトを2つ作成する(例: `fire-fire-dev` / `fire-fire-prod`)

2. **課金プラン変更**
   各プロジェクトの「使用量と請求」からBlazeプランへアップグレードする(クレジットカード登録が必要)

3. **各サービスの有効化**(2プロジェクト分繰り返す)
   - Build → Firestore Database → データベースを作成(リージョン: 未定、本番モードで開始)
   - Build → Storage → 開始
   - Build → Authentication → 始める、その後Identity Platformへアップグレード(Google Cloud Console側のIdentity Platform画面からの有効化が必要になる場合あり)
   - Build → App Hosting → 開始

4. **Firebase CLIセットアップ**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

5. **`firebase init` の実行**
   リポジトリで `firebase init` を実行し、Firestore / Storage / Functions / Emulators を設定する。`.firebaserc` にdev/prodのプロジェクトエイリアスを登録する

6. **Emulator Suiteの動作確認**
   ```bash
   firebase emulators:start
   ```
   Firestore / Auth / Functions のエミュレータがローカルで起動することを確認する

7. **App HostingとGitHubの接続**
   Firebase Console → App Hosting からGitHubリポジトリを接続し、本番/開発それぞれのプロジェクトを対応するブランチ(開発用ブランチ名は未定)に紐付ける

8. **Web設定値の反映**
   各プロジェクトの「プロジェクトの設定」からWebアプリを追加し、発行された設定値を `src/frontend/.env.local` に設定する(リポジトリにはコミットしない)

9. **予算アラートの設定**
   Google Cloud Console → お支払い → 予算とアラート から新しい予算を作成する
   - 対象範囲: 開発用・本番用プロジェクトが同じお支払いアカウントに紐付いている場合はお支払いアカウント単位(両プロジェクト合算)で設定する。お支払いアカウントを分けている場合はプロジェクトごとに設定する(例: 各5,000円ずつ等、合計で月1万円を超えない配分にする)
   - 予算額: 月額10,000円
   - しきい値: 50% / 90% / 100%(いずれもデフォルトの「実績額」ベースで可)
   - 通知先: 請求先アカウント管理者(自分)のメールアドレス

## コストに関する方針

- 個人利用規模ではFirestore/Storage/Cloud Functions/Identity Platformいずれも無料枠内に収まる想定([docs/auth-login-requirements.md](docs/auth-login-requirements.md) 3.1参照)
- Blazeプランには自動の支出上限機能がない(廃止済み)ため、今回は**予算アラート(通知のみ)**で対応し、予算超過を検知して自動的に課金を停止する仕組み(Cloud Functionsによるお支払いアカウント無効化等)は導入しない。アラート受信後は手動で原因調査・対応する
- 費用が想定外に膨らみうる主な要因は「Firestore/Storageのセキュリティルールの不備による外部からの不正アクセス」「Cloud Functionsのバグによる無限ループ的実行」「App Hostingへの頻繁なデプロイによるビルド時間消費」の3つ。セキュリティルールは[firestore-rules-review](.claude/skills/firestore-rules-review/SKILL.md)スキルで都度確認する

## 注意点 / オープン課題

- ログイン通知メールの送信サービスは未定(別カードで検討。docs/auth-login-requirements.md 8章)
- Cloud FunctionsのNode.jsバージョン固定は別途検討
- Firestoreのリージョン、App Hosting接続先の開発用ブランチ名は未定
- `docs/.env` は既存の実際のシークレットファイル。誤って上書き・削除しないこと
