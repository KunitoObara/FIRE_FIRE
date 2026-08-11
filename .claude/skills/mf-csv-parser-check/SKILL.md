---
name: mf-csv-parser-check
description: Verifies Money Forward CSV import/parsing logic (asset balance history and transaction/income-expense CSVs) against the app's requirements — successful parses must show a preview (row count, date range, sample rows) before committing the import, and malformed CSVs must block the import with a visible error rather than partially importing. Use this skill whenever code touching CSV upload, parsing, or the B2 CSV import screen is written or changed, even if the user just says "CSVの読み込みを直した" or "add support for a new Money Forward export column" — don't wait for an explicit "test this" request.
---

# マネーフォワードCSVパーサー検証

## なぜこのスキルが必要か

docs/fire-asset-management-requirements.md の4.2と、docs/screen-requirements-dashboard.md のB2画面要件は、CSV取込に関して2つの明確な振る舞いを要求している。**入出金明細(取引データ)側の正本は docs/transaction-import-requirements.md** で、列構成・データモデル・冪等性・集計から外す行はそちらにある。

- パース成功時: 実行前にプレビュー(件数・期間・サンプル行)を表示し、ユーザーの確認を経てから取込を実行する
- パース失敗時(フォーマット不正): エラー表示のうえ取込不可のまま画面に留まる(部分取込や不整合なデータのコミットをしない)

マネーフォワードのCSVエクスポート形式は同社の非公式フォーマットであり、公式な仕様書がない。列構成やエンコーディングが将来変わりうる前提でパーサーを検証する必要がある。

## 実装の場所

**パースはブラウザで行う。`src/backend` には来ない。** 生CSVを保存しない設計(要件 4.2、`CLAUDE.md`)なので、Firestoreへ渡るのは数値だけ。

| | パス |
|---|---|
| パーサー本体(資産残高推移) | `src/frontend/src/lib/csv/asset-balance-csv.ts` |
| パーサー本体(入出金明細) | `src/frontend/src/lib/csv/transaction-csv.ts` |
| 文字コードの判定・デコード | `src/frontend/src/lib/csv/decode.ts`(両種別で共通) |
| Firestoreへの書き込み | `src/frontend/src/lib/csv-import/asset-balance-repository.ts`、`src/frontend/src/lib/csv-import/transaction-repository.ts` |
| スキーマ・上限値 | `src/frontend/src/schemas/csv-import.ts`、`src/frontend/src/constants/csv-import.ts`、`src/frontend/src/constants/transactions-import.ts` |
| B2 画面 | `src/frontend/src/components/csv-import/`、`src/frontend/src/app/(dashboard)/csv-import/page.tsx` |

**入出金明細CSVの取込は実装済み(B2-1〜B2-3)。** タブごとにパーサー・リポジトリ・失敗時の文言・プレビュー表が別々にあり、共有しているのは文字コードの判定とファイルサイズの歯止めだけになる。「未実装だから探さない」と書いてあった時期のメモを見つけたら、それは B2-3 より前の記述で古い。

**B3 収支明細一覧も [B3-1] でFirestoreに接続済み。** `src/frontend/src/lib/transactions/transactions-data.ts` の `fetchTransactionsData` が選択中の期間だけを読み、サンプルデータは撤去した。

**B1の収支サマリも [B1-8] で実データを集計している**(`fetchMonthlyTransactions` で当月分を読み、`buildCashflowSummary` が振替・計算対象外を除いて集計する)。B3側も費目の2段絞り込み・振替/計算対象外のバッジ・選択中の値をその期間に無くても選択肢へ残す扱いまで実装済みで、**Phase 2 は一通り実装済み**。状況は docs/transaction-import-requirements.md 9章にある。

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

### 入出金明細を触ったときに追加で見るもの

正本は docs/transaction-import-requirements.md。実装がそこから外れていないかを次の順で見る。

| 見るもの | 期待 | 外れると起きること |
|---|---|---|
| ドキュメントID | CSVの `ID` 列をそのまま使う(3.2)。`^[A-Za-z0-9_-]{1,200}$` に一致せず `__…__` でもないことを検証し、外れた行があればファイル全体を `invalid-id` で失敗させる | IDを加工して通すと、加工規則を変えた瞬間に同じ取引が二重に入る |
| 再取込 | 同じファイルを2回取り込んで**件数が変わらない**(4章)。`set` はマージなしで、費目を直して出し直した値が反映される | 取引が積み上がり、収支サマリが倍になる |
| `振替` / `計算対象` | **保存はする。集計から外すだけ**(5章)。B3の一覧には印付きで出す | 取り込まない実装にすると、B3に出ない取引が生まれ「失敗したのか除外されたのか」を画面から区別できない |
| 収支サマリの集計 | 振替でも計算対象外でもない行だけを数える(5章)。**収入も支出も0以上で持つ** — 収入は `amount > 0` の合計、支出は `amount < 0` の合計の**絶対値**(5章「集計した値の符号」) | 除外を忘れると自口座間の移動が収入と支出の両方に立ち、収支0のまま両者だけ膨らむ。支出を負のまま持つと`CashflowSummaryCard`が`income - expense`で計算するため**赤字が黒字として出る** |
| 収支サマリの読み取り | 当月分だけを読む(8章)。`fetchMonthlyTransactions` が当月1日〜月末を範囲にする | 全件を読むと表示のたびに読み取りが増え続ける |
| 費目 | 大項目・中項目を両方保存する(6章)。B1は大項目で集計、B3は2段で絞り込む | 中項目を捨てると再取込しないと戻らない |
| 同日・同額・同内容の複数行 | 別々の取引として残る(`ID` が違うため) | ハッシュを鍵にした実装だと1件に潰れる。交通費で実際に起きる |
| 上限と読み取り | `MAX_TRANSACTION_ROWS` と `TRANSACTION_SCAN_LIMIT`(8章)。**`limit()` に渡るのは `TRANSACTION_SCAN_LIMIT + 1` なので、超えられないのはそちら** | 超えるとクエリが `invalid-argument` で拒否され、1件も読めない |
| 打ち切りの判定 | 1件余分に読んで `TRANSACTION_SCAN_LIMIT` 件を超えたか(8章)。件数が上限と一致したかで判定しない | ちょうど上限と同じ件数のときに、欠けていないのに打ち切りの案内が出る |
| 打ち切りの通知 | 打ち切ったことを画面に出す。`periodId === 'all'` で分岐しない | 黙って古い側が欠け、一覧に無いことを「取り込んでいない」と読み違える |

**サンプルCSVに実データを貼らない。** このリポジトリは公開されている(`CLAUDE.md`)。`ID` 列も架空の値にする。

## 確認したことはテストに残す

資産残高推移のパーサーには既にテストがある(`asset-balance-csv.test.ts`、`decode.test.ts`、`schemas/csv-import.test.ts`)。**手元で確かめただけで終わらせず、拾った異常系はそこへ足す。** 新しい列構成に対応したときも同じで、対応したことをテストで示す。

## 出力

確認した項目ごとに合否を示し、不合格の項目は再現手順(使ったサンプルCSVの内容)と原因箇所を報告する。
