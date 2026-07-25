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

- **Cloud Firestore**: セキュリティルールは`firestore.rules`に定義し、[firestore-rules-review](../../.claude/skills/firestore-rules-review/SKILL.md)スキルでユーザー単位のアクセス制御を都度確認する
- **Firebase Storage**: マネーフォワードCSVアップロードファイルの保管

## 4. 認証

- **Identity Platform**: TOTP型2FA・パスワードポリシーの実体([docs/auth-login-requirements.md](../../docs/auth-login-requirements.md)参照)
- ログイン通知メールはBlocking Functions経由でCloud Functionsを起動し、外部メール送信サービスから送信する構成(docs/auth-login-requirements.md 3.6)。**送信サービスは未定**(7章オープン課題)

## 5. バリデーション

- **zod**: フロントエンドと同じライブラリを使い、CSV取込データやFirestoreへの書き込みペイロードの検証ロジックの書き方を揃える。スキーマ自体の共有(パッケージ化)は今のところ行わず、必要になった時点で検討する

## 6. CSVパース

- **papaparse**: マネーフォワードCSV(資産残高推移/入出金明細)のパースに使用。[mf-csv-parser-check](../../.claude/skills/mf-csv-parser-check/SKILL.md)スキルで、正常系/異常系それぞれの挙動を検証する

## 7. テスト(ユニットのみ)

- **Firebase Emulator Suite**: Firestore/Auth/Functionsをローカルで再現し、実際のFirebaseプロジェクトに影響を与えずに検証する
- **Vitest**: Cloud Functionsのユニットテスト。ユニットのみとし、E2Eは現時点では導入しない

## 8. Lint / Format

- ESLint + Prettier(フロントエンドと同等の構成)

## 9. 今後の検討事項(オープン課題)

- ログイン通知メールの送信サービス選定(未定。docs/auth-login-requirements.md 8章の課題と対応)
- Cloud FunctionsのNode.jsバージョン固定
- フロントエンドとのバリデーションスキーマ共有の要否
