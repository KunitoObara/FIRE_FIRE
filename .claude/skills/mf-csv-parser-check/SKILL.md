---
name: mf-csv-parser-check
description: Verifies Money Forward CSV import/parsing logic (asset balance history and transaction/income-expense CSVs) against the app's requirements — successful parses must show a preview (row count, date range, sample rows) before committing the import, and malformed CSVs must block the import with a visible error rather than partially importing. Use this skill whenever code touching CSV upload, parsing, or the B2 CSV import screen is written or changed, even if the user just says "CSVの読み込みを直した" or "add support for a new Money Forward export column" — don't wait for an explicit "test this" request.
---

# マネーフォワードCSVパーサー検証

## なぜこのスキルが必要か

docs/fire-asset-management-requirements.md の4.2と、docs/screen-requirements-dashboard.md のB2画面要件は、CSV取込に関して2つの明確な振る舞いを要求している。

- パース成功時: 実行前にプレビュー(件数・期間・サンプル行)を表示し、ユーザーの確認を経てから取込を実行する
- パース失敗時(フォーマット不正): エラー表示のうえ取込不可のまま画面に留まる(部分取込や不整合なデータのコミットをしない)

マネーフォワードのCSVエクスポート形式は同社の非公式フォーマットであり、公式な仕様書がない。列構成やエンコーディングが将来変わりうる前提でパーサーを検証する必要がある。

## 検証手順

1. 対象のパーサーコード(`src/backend`配下、CSVアップロード/パース処理)を特定する。
2. リポジトリ内に実際のサンプルCSV(fixtures等)があればそれを使う。なければ、実装中のパーサーが期待する列構成に基づいて以下2種類の最小サンプルを作成する。
   - 正常系: 資産残高推移CSV、入出金明細CSVそれぞれ数行分
   - 異常系: 列が不足している、日付/金額が数値として不正、文字コードが想定外、空ファイルなど
3. パーサーを実行し、以下を確認する。
   - 正常系: 件数・期間(最古〜最新の日付)・サンプル行を含むプレビューが生成されるか。取込実行前にデータがコミットされていないか。
   - 異常系: 例外が握りつぶされて空データとして取込まれていないか。ユーザーに分かるエラーメッセージが返るか。
4. 取込済みデータの型(日付・金額)が想定通りにパースされているか、境界値(0円、マイナス残高、カンマ区切りの金額表記など)も確認する。
5. 資産残高推移と入出金明細で取込先データモデルが異なる場合、タブ切り替え(取込種別)によって正しいパーサーにルーティングされているか確認する。

## 実装がまだない場合

`src/backend`にパーサー実装がまだ存在しない場合は、このスキルをテスト駆動の出発点として使ってよい。上記の異常系リストを先にテストケースとして書き、それに通るように実装する。

## 出力

確認した項目ごとに合否を示し、不合格の項目は再現手順(使ったサンプルCSVの内容)と原因箇所を報告する。
