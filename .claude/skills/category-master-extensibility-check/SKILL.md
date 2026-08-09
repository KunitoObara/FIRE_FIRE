---
name: category-master-extensibility-check
description: Checks whether code touching asset category axes (総資産, 純金融資産, 投資性資産, etc.) treats categories as editable master data rather than hardcoded constants/enums. Use this skill whenever the user adds a new asset category, changes dashboard breakdown/filtering logic, or touches the category master (B4) screen or its data model — even if they frame it as "just add a new category" rather than a design review.
---

# 資産分類マスタ拡張性チェック

## なぜこのスキルが必要か

docs/fire-asset-management-requirements.md 4.3は「分類軸は開発中・運用中に追加される可能性があるため、コードにハードコードせず、マスタデータとして追加・編集可能な拡張性のある設計とする」と明記している。これは努力目標ではなく設計上の要件であり、要件が例示する5つ(総資産・純金融資産・金融資産・投資性資産・流動限定金融資産)がコード中にリテラルで埋め込まれると、後からの追加・編集がマスタ画面(B4)だけで完結しなくなる。

**分類軸の集計対象には資産種別だけでなく負債も選べる**(同 4.3 後段、要件 4.8 の負債)。「純金融資産 = 資産 − 負債」のような軸を、専用の計算式をコードに持たずにマスタデータだけで表せるようにするための仕組みで、**ハードコードの温床になりやすいのはこちら**。分類名の直書きより、「この軸だけは負債を引く」という分岐がコードに入るほうが起きやすい。

## チェック手順

1. 変更されたコードの中に、分類名を直接比較・分岐に使っている箇所がないか探す(例: `if (category === "投資性資産")` のような文字列/enum直書き)。
2. 分類の集計ロジック(どの資産が投資性資産に含まれるか等)が、コード内の固定マッピングではなく、Firestore上のマスタデータ(分類定義・分類に属する資産項目の紐付け)を参照しているか確認する。
3. ダッシュボード(B1)の分類軸切替セレクタが、マスタデータから動的に選択肢を生成しているか、それとも固定リストを表示しているか確認する。
4. 資産分類マスタ設定画面(B4)での追加・編集・削除が、実際にダッシュボードの表示・集計に反映される設計になっているか(マスタを更新してもコード側の固定リストが優先されてしまう、といった不整合がないか)確認する。
5. **負債を含む軸の集計が、軸ごとの分岐ではなくマスタの定義から導かれているか**確認する。B4は「対象の資産種別の合計 − 対象の負債の残債」で計算する立て付けで、`if (axis.name === "純金融資産")` のような分岐も、特定の軸だけ負債を引く固定マッピングも要件違反になる。実装は `src/frontend/src/lib/asset-categories/`、`src/frontend/src/lib/dashboard/aggregation.ts`、定数は `src/frontend/src/constants/asset-categories.ts` にある。
6. 例外として、初期シードデータ(マイグレーション/シーディングスクリプトで初期の分類軸を投入する処理)はハードコードして問題ない。区別すべきは「実行時のロジックが分類名に依存しているか」であり、「初期データ投入時に分類名を書いているか」ではない。同じく、**画面に出す固定の文言**(グループ見出し、未選択時の説明)は分類軸そのものではないので対象外。

## 出力

ハードコードを検出した場合は該当ファイル・行と、マスタデータ参照に置き換える具体的な修正案を示す。問題がなければその旨を簡潔に報告する。
