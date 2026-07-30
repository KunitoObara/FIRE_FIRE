# バックエンド技術スタック

対象: `src/backend`(Cloud Functions for Firebase)

## 1. 実行基盤

- **Cloud Functions for Firebase(2nd gen)**: Cloud Runベースで実行時間・メモリの制約が1st genより緩く、今後のCSV処理やシミュレーション計算の負荷増にも対応しやすい
- **Node.js LTS** + **TypeScript**
- **npm**

## 2. Firebase連携

- **firebase-admin**: Firestore/Storage/Authへの管理者権限アクセス
- **firebase-functions**: HTTPSトリガー、Firestoreトリガー、Identity PlatformのBlocking Functions(ログイン通知用)

## 3. データストア/ストレージ

- **Cloud Firestore**: セキュリティルールは`firestore.rules`に定義し、[firestore-rules-review](../../../.claude/skills/firestore-rules-review/SKILL.md)スキルでユーザー単位のアクセス制御を都度確認する
- **Firebase Storage**: マネーフォワードCSVアップロードファイルの保管

## 4. 認証

- **Identity Platform**: TOTP型2FA・パスワードポリシーの実体([docs/auth-login-requirements.md](../../../docs/auth-login-requirements.md)参照)
- ログイン通知メールはBlocking Functions経由でCloud Functionsを起動し、外部メール送信サービスから送信する構成(docs/auth-login-requirements.md 3.6)。**送信サービスは未定**(10章オープン課題)
- 2FAリカバリーコード(docs/auth-login-requirements.md 3.3)はIdentity Platformに機能が無いためcallableで自前実装する。コードのハッシュ化はNode標準の`node:crypto`のscryptを使い、外部のハッシュライブラリは入れない
- 設定値のうち秘密でないもの(Identity PlatformのWeb APIキー)も、CIからの非対話デプロイで確実に解決できるよう`firebase-functions/params`の`defineSecret`(Secret Manager)に置く。`.env`系ファイルはリポジトリで除外しているため、そちらは使わない

## 5. バリデーション

- **zod**: フロントエンドと同じライブラリを使い、CSV取込データやFirestoreへの書き込みペイロードの検証ロジックの書き方を揃える。スキーマ自体の共有(パッケージ化)は今のところ行わず、必要になった時点で検討する

## 6. CSVパース

- **papaparse**: マネーフォワードCSV(資産残高推移/入出金明細)のパースに使用。[mf-csv-parser-check](../../../.claude/skills/mf-csv-parser-check/SKILL.md)スキルで、正常系/異常系それぞれの挙動を検証する

## 7. テスト(ユニットのみ)

- **Firebase Emulator Suite**: Firestore/Auth/Functionsをローカルで再現し、実際のFirebaseプロジェクトに影響を与えずに検証する
- **Vitest**: Cloud Functionsのユニットテスト。ユニットのみとし、E2Eは現時点では導入しない

## 8. Lint / Format

- ESLint + Prettier(フロントエンドと同等の構成)

## 9. コスト管理

- 個人利用規模ではFirestore/Storage/Cloud Functions/Identity Platformいずれも無料枠内に収まる想定([docs/auth-login-requirements.md](../../../docs/auth-login-requirements.md) 3.1参照)
- Blazeプラン(従量課金)には自動の支出上限機能がない(廃止済み)ため、Google Cloud Billing Budgetsで月額10,000円の予算アラートを50%/90%/100%のしきい値で設定し、メール通知で異常な利用を検知する。予算超過を検知して自動的に課金を停止する仕組みは導入せず、アラート受信後は手動で原因調査・対応する
- 費用が想定外に膨らみうる主な要因は「Firestore/Storageのセキュリティルールの不備による外部からの不正アクセス」「Cloud Functionsのバグによる無限ループ的実行」「App Hostingへの頻繁なデプロイによるビルド時間消費」の3つ。セキュリティルールは[firestore-rules-review](../../../.claude/skills/firestore-rules-review/SKILL.md)スキルで都度確認する

## 10. 今後の検討事項(オープン課題)

- ログイン通知メールの送信サービス選定(未定。docs/auth-login-requirements.md 8章の課題と対応)
- Cloud FunctionsのNode.jsバージョン固定
- フロントエンドとのバリデーションスキーマ共有の要否
