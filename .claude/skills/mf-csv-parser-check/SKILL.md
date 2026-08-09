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

## 実装の場所

**パースはブラウザで行う。`src/backend` には来ない。** 生CSVを保存しない設計(要件 4.2、`CLAUDE.md`)なので、Firestoreへ渡るのは数値だけ。

| | パス |
|---|---|
| パーサー本体(資産残高推移) | `src/frontend/src/lib/csv/asset-balance-csv.ts` |
| 文字コードの判定・デコード | `src/frontend/src/lib/csv/decode.ts` |
| Firestoreへの書き込み | `src/frontend/src/lib/csv-import/asset-balance-repository.ts` |
| スキーマ・上限値 | `src/frontend/src/schemas/csv-import.ts`、`src/frontend/src/constants/csv-import.ts` |
| B2 画面 | `src/frontend/src/components/csv-import/`、`src/frontend/src/app/(dashboard)/csv-import/page.tsx` |

**入出金明細CSV(B3)はまだ取り込んでいない。** B3の画面は `src/frontend/src/lib/transactions/sample-data.ts` を表示しているだけなので、そのパーサーを検証しようとして探し回らない。着手するときは下の異常系リストを先にテストとして書く。

## 検証手順

1. 対象のパーサーコードを上の表から特定する。既存のテスト(`*.test.ts`)にどのケースが既にあるかを先に見て、重複を書かない。
2. リポジトリ内に実際のサンプルCSV(fixtures等)があればそれを使う。なければ、実装中のパーサーが期待する列構成に基づいて以下2種類の最小サンプルを作成する。**実データを貼らない** — このリポジトリは公開されているので、金額は明らかに架空の丸い数字にする(`CLAUDE.md`)。
   - 正常系: 資産残高推移CSV、入出金明細CSVそれぞれ数行分
   - 異常系: 列が不足している、日付/金額が数値として不正、文字コードが想定外、空ファイルなど
3. パーサーを実行し、以下を確認する。
   - 正常系: 件数・期間(最古〜最新の日付)・サンプル行を含むプレビューが生成されるか。取込実行前にデータがコミットされていないか。
   - 異常系: 例外が握りつぶされて空データとして取込まれていないか。ユーザーに分かるエラーメッセージが返るか。
4. 取込済みデータの型(日付・金額)が想定通りにパースされているか、境界値(0円、マイナス残高、カンマ区切りの金額表記など)も確認する。
5. 資産残高推移と入出金明細で取込先データモデルが異なる場合、タブ切り替え(取込種別)によって正しいパーサーにルーティングされているか確認する。
6. 同じCSVを2回取り込んだときに何が起きるか確認する(重複行が積み上がるか、同じ日付の残高が上書きされるか)。要件がどちらを求めているかを `docs/screen-requirements-dashboard.md` のB2で確かめ、実装がそれと一致しているかを見る。

## 確認したことはテストに残す

資産残高推移のパーサーには既にテストがある(`asset-balance-csv.test.ts`、`decode.test.ts`、`schemas/csv-import.test.ts`)。**手元で確かめただけで終わらせず、拾った異常系はそこへ足す。** 新しい列構成に対応したときも同じで、対応したことをテストで示す。

## 出力

確認した項目ごとに合否を示し、不合格の項目は再現手順(使ったサンプルCSVの内容)と原因箇所を報告する。
