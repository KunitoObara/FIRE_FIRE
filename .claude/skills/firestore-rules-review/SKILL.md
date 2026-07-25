---
name: firestore-rules-review
description: Reviews Firestore security rules (firestore.rules or equivalent) for gaps that would let one user read or write another user's financial data. Use this skill whenever firestore.rules is created or edited, whenever a new Firestore collection is introduced, or whenever the user asks to check, audit, or harden data access permissions — this app stores personal asset and financial information, so any access-control change deserves this review even if not explicitly requested.
---

# Firestoreセキュリティルールレビュー

## なぜこのスキルが必要か

docs/fire-asset-management-requirements.md 5章(非機能要件)は「Firestoreのセキュリティルールでユーザー単位のデータアクセス制御を行う」ことを明示的に要求している。個人の資産・金融情報を扱うため、ルールの抜け穴は他のバグよりも影響が大きい。

現時点(初期リリース)はシングルユーザー運用だが、docs/fire-asset-management-requirements.md 2章に将来のSaaS化(第三者への公開)が構想として記載されている。今のうちにルールをユーザーIDベースで正しく設計しておくことが、後のマルチユーザー化の土台になる。

## レビュー手順

1. `firestore.rules`(または該当する設定)の差分・全体を読む。
2. コレクションごとに以下を確認する。
   - `request.auth != null` などの未認証アクセス拒否があるか
   - ドキュメントの `resource.data.userId`(またはパスに埋め込まれたUID)と `request.auth.uid` を比較する条件があるか。単に「ログインしていれば誰でも読み書き可」になっていないか
   - `list`/`get`のクエリ経由で他ユーザーのデータを横断的に読めてしまう抜け道がないか(例: `allow read: if true` の残存、ワイルドカードパスの範囲が広すぎる)
   - 書き込み(`create`/`update`)時に、送信データの`userId`フィールドを送信者が任意の値に書き換えられないか(なりすまし)
3. CSV取込やダッシュボード集計など、Cloud Functions経由での書き込みがある場合、Functions側がAdmin SDKでルールをバイパスしていないか、バイパスする場合はFunctions側で同等のユーザーID検証をしているか確認する。
4. 新しいコレクション(資産分類マスタ、不動産情報、FIRE目標設定など)を追加した際は、既存コレクションと同じ「ユーザー単位」パターンに沿っているか、シングルユーザー前提で確認を省略していないか確認する。

## 出力

発見した抜け穴を、影響を受けるコレクション/ルール行・想定される攻撃シナリオ・修正案の3点セットで報告する。問題がなければその旨を簡潔に報告する。
