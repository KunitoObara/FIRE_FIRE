---
name: real-estate-debt-check
description: Verifies the Phase 3 money rules — real-estate spread (時価 - ローン残高, must stay signed so over-leveraged properties show negative), monthly rental balance, and the debt side's "no automatic calculation" rule (no repayment schedule derived from interest rate or term, no balance decaying over time), plus the append-only balance history and how it is back-filled from 発生年月. Use this skill whenever code touching real estate (B5/B6/B7, users/{uid}/properties) or debts (B11, users/{uid}/debts, 残債履歴, the debt deduction in the asset-trend graph) is written or changed — even when the user frames it as "just adding a field" or "fixing the display", since these values feed the dashboard and a sign or unit slip is invisible until the numbers are wrong.
---

# 不動産・負債の計算とデータ整合の検証

## なぜこのスキルが必要か

Phase 3([要件定義書](../../../docs/fire-asset-management-requirements.md) 4.5・4.8)の金額は、CSV由来ではなく**すべて手入力**で、しかも一方は「計算する」もの、他方は「計算しない」ものである。この非対称が取り違えの元になる。

- **不動産の利ざやは自動計算する**(時価 - ローン残高)。保存してはならず、負の値(オーバーローン)を0で止めてもならない
- **負債は自動計算しない**。金利・残りの返済期間から毎月の返済額や完済日を導いたり、時間の経過で残債を減らしたりしてはならない。集計に使うのは残債だけである

「親切に補完する」方向の変更は、どちらの側でも要件違反になる。実装中は自然に見えてしまうため、レビューまで残りやすい。

さらに、負債は**残債の履歴**を持ち、資産推移グラフが各時点の残債を差し引く。履歴は追記のみで、過去へ遡って書き換えない。B11ではこの周辺で**ローカルのテストが緑のままデータ損失のバグが2件**出ている(別タブの追加が保存で消える / 連続保存で負債が複製され履歴が消える。[開発フロー](../../../docs/development-workflow.md) 6章)。

## 実装の場所

| | パス |
|---|---|
| 不動産の計算(利ざや・賃貸収支) | `src/frontend/src/lib/real-estate/calculation.ts` |
| 物件の読み書き | `src/frontend/src/lib/real-estate/property-repository.ts` |
| 物件の入力値↔保存値 | `src/frontend/src/lib/real-estate/form-values.ts`、`src/frontend/src/schemas/real-estate.ts` |
| 負債の読み書き・残債履歴 | `src/frontend/src/lib/debts/debt-repository.ts` |
| 負債の集計(負債サマリ) | `src/frontend/src/lib/debts/summary.ts` |
| 負債の資産推移への反映 | `src/frontend/src/lib/dashboard/aggregation.ts` |
| 書ける形の担保 | `firestore.rules`(`isValidProperty()`、`isAppendOnlyBalanceHistory()`) |

要件の正本は [4.5・4.8](../../../docs/fire-asset-management-requirements.md)、画面側は [不動産 B5〜B7](../../../docs/screen-requirements-real-estate.md) と [B11](../../../docs/screen-requirements-dashboard.md#b11-負債入力画面)。

## 検証手順

変更が触れた側だけを見ればよい。両方に触れていれば両方を見る。

### 不動産(B5〜B7)

1. **利ざやの符号**。ローン残高 > 時価 の物件で負の値が返り、そのまま表示されるか。`Math.max(0, ...)` や `Math.abs()` で潰していないか
   - 時価1,000万・ローン残高1,200万 → **-200万**(0ではない)
2. **保存していないか**。利ざや・賃貸収支がFirestoreのドキュメントに書かれていないこと。`isValidProperty()` の `hasOnly` に増えていないことでも確かめられる
3. **賃貸収支の単位**。月額のまま計算しているか(12を掛けた値が混ざっていないか)。支出が収入を上回る場合に負になるか
4. **収益物件の判定が1つに保たれているか**。区分のフラグと金額を別々に持っていないこと。収益物件から外して保存したとき、以前の賃貸収入/支出が残らないこと
5. **ローン残高を集計に入れていないか**。B7のローン残高はダッシュボードの負債控除に入らない(そちらはB11の負債)。同じ住宅ローンが二重に差し引かれないこと
6. **最終更新日**。保存のたびに更新されること、登録日時(`createdAt`)は編集で変わらないこと

### 負債(B11)

1. **自動計算を持ち込んでいないか**。金利・残りの返済期間から返済額・完済日・将来の残債を導く処理が無いこと。時間の経過で残債が減る処理が無いこと
2. **集計に使うのは残債だけか**。金利・返済期間が合計や控除に混ざっていないこと
3. **残債履歴は追記のみか**。既存の日付の記録を書き換えていないこと(同じ日に2回保存したときだけ、その日の記録は上書きされる)。**残債が変わった日だけ**記録が増えること
4. **発生年月からの遡り**。遡る期間には**最も古い記録の残債**を当てる。当初借入額からの補間や、金利・返済期間からの逆算はしない
5. **完済(残債0)の扱い**。残債は0円を許し、完済した負債を0円のまま残せること。**「いまの残債の合計」や「件数」で判定を切り替えていないか** — 完済した負債は現在の残債が0でも過去の期間には帯が出るため、その条件では帯を消す手段が画面から消える([B1の資産推移グラフ](../../../docs/screen-requirements-dashboard.md#b1-ダッシュボード画面)の切替条件)
6. **削除の波及**。削除した負債を集計対象にしている分類軸がどうなるか(B4の要件。詳しくは `category-master-extensibility-check`)

### 両方に共通して見るもの

7. **同時更新**。読んでから書くまでの間に他方のタブが書いた内容を上書きしないか。上書きするなら、それが要件として決まっているか([不動産の今後の検討事項](../../../docs/screen-requirements-real-estate.md#今後の検討事項)は後勝ちを許容と明記している)
8. **二重実行**。同じ保存を連続で2回実行したときに、複製や履歴の消失が起きないか
9. **確かめたケースをユニットテストとして残す。** vitest は導入済み(`npm run test`)で、上記の各ファイルには `*.test.ts` がある。既存のテストと重複するケースは足さない

## 出力

見た項目ごとに「要件どおり / 違反 / 該当なし」を一覧で示す。違反にはファイルと行、要件のどの記述に反するかを添える。**要件そのものに書かれていない判断が必要になった場合は、勝手に寄せずユーザーに確認する**([開発フロー](../../../docs/development-workflow.md) 8章)。
