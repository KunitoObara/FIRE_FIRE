---
name: firestore-rules-review
description: Reviews Firestore security rules (firestore.rules or equivalent) for gaps that would let one user read or write another user's financial data. Use this skill whenever firestore.rules is created or edited, whenever a new Firestore collection is introduced, or whenever the user asks to check, audit, or harden data access permissions — this app stores personal asset and financial information, so any access-control change deserves this review even if not explicitly requested.
---

# Firestoreセキュリティルールレビュー

## なぜこのスキルが必要か

docs/fire-asset-management-requirements.md 5章(非機能要件)は「Firestoreのセキュリティルールでユーザー単位のデータアクセス制御を行う」ことを明示的に要求している。個人の資産・金融情報を扱うため、ルールの抜け穴は他のバグよりも影響が大きい。

現時点(初期リリース)はシングルユーザー運用だが、docs/fire-asset-management-requirements.md 2章に将来のSaaS化(第三者への公開)が構想として記載されている。今のうちにルールをユーザーIDベースで正しく設計しておくことが、後のマルチユーザー化の土台になる。

## 落としてはいけない不変条件

現在の `firestore.rules` は、**ユーザー単位の分離に加えて次の2つ**を持っている。どちらも**外しても既存のテストは緑のまま通る**ので、差分でこれらが弱まっていないかを最初に見る。

- **TOTP を通したセッションだけがデータに触れる** — `canAccessOwnData()` が ID トークンの `firebase.sign_in_second_factor == 'totp'` を要求する(カード [X7])。2FA未完了のセッションは、画面をすり抜けてFirestoreを直接叩いても `permission-denied` になる。`AppAccessGuard` は表示制御であって保護ではない、というのが要件の立て付け(`CLAUDE.md`)
- **リカバリーコードはクライアントから読めない** — `mfaRecoveryCodes/{uid}` はscryptハッシュを持ち、クライアントには全拒否。読み書きはCloud Functions(`src/backend/src/mfa-recovery`)のAdmin SDK経由だけ

`storage.rules` も見る。**現在は全パス拒否**(`allow read, write: if false`)で、生CSVを保存しない設計のため用途が無い。ここを開ける差分が出てきたら、何を置くためかと、ユーザー単位に閉じているかを必ず確認する。

## レビュー手順

1. `firestore.rules` / `storage.rules` の差分・全体を読む。
2. コレクションごとに以下を確認する。
   - `request.auth != null` などの未認証アクセス拒否があるか
   - ドキュメントの `resource.data.userId`(またはパスに埋め込まれたUID)と `request.auth.uid` を比較する条件があるか。単に「ログインしていれば誰でも読み書き可」になっていないか
   - `list`/`get`のクエリ経由で他ユーザーのデータを横断的に読めてしまう抜け道がないか(例: `allow read: if true` の残存、ワイルドカードパスの範囲が広すぎる)
   - 書き込み(`create`/`update`)時に、送信データの`userId`フィールドを送信者が任意の値に書き換えられないか(なりすまし)
3. CSV取込やダッシュボード集計など、Cloud Functions経由での書き込みがある場合、Functions側がAdmin SDKでルールをバイパスしていないか、バイパスする場合はFunctions側で同等のユーザーID検証をしているか確認する。
4. 新しいコレクション(資産分類マスタ、不動産情報、FIRE目標設定など)を追加した際は、既存コレクションと同じ「ユーザー単位」パターンに沿っているか、シングルユーザー前提で確認を省略していないか確認する。**TOTPの要求も同じヘルパー経由になっているか**を見る(新しいコレクションだけ `request.auth != null` で済ませていないか)。
5. 構文が通ることを確かめる。

   ```bash
   firebase emulators:exec --only firestore "true"
   ```

   これは構文チェックであって、条件が正しいかは見ていない。ルールのユニットテスト(`@firebase/rules-unit-testing`)はまだ導入していないので、**条件の正しさは読んで判断するしかない**。読み切れない場合はそう報告する。

## 出力

発見した抜け穴を、影響を受けるコレクション/ルール行・想定される攻撃シナリオ・修正案の3点セットで報告する。問題がなければその旨を簡潔に報告する。
