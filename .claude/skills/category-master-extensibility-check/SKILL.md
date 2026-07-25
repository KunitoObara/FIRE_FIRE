---
name: category-master-extensibility-check
description: Checks whether code touching asset category axes (総資産, 純金融資産, 投資性資産, etc.) treats categories as editable master data rather than hardcoded constants/enums. Use this skill whenever the user adds a new asset category, changes dashboard breakdown/filtering logic, or touches the category master (B4) screen or its data model — even if they frame it as "just add a new category" rather than a design review.
---

# 資産分類マスタ拡張性チェック

## なぜこのスキルが必要か

docs/fire-asset-management-requirements.md 4.3は「分類軸は開発中・運用中に追加される可能性があるため、コードにハードコードせず、マスタデータとして追加・編集可能な拡張性のある設計とする」と明記している。これは努力目標ではなく設計上の要件であり、初期の4分類(総資産・純金融資産・金融資産・投資性資産・流動限定金融資産)がコード中にリテラルで埋め込まれると、後からの追加・編集がマスタ画面(B4)だけで完結しなくなる。

## チェック手順

1. 変更されたコードの中に、分類名を直接比較・分岐に使っている箇所がないか探す(例: `if (category === "投資性資産")` のような文字列/enum直書き)。
2. 分類の集計ロジック(どの資産が投資性資産に含まれるか等)が、コード内の固定マッピングではなく、Firestore上のマスタデータ(分類定義・分類に属する資産項目の紐付け)を参照しているか確認する。
3. ダッシュボード(B1)の分類軸切替セレクタが、マスタデータから動的に選択肢を生成しているか、それとも固定リストを表示しているか確認する。
4. 資産分類マスタ設定画面(B4)での追加・編集・削除が、実際にダッシュボードの表示・集計に反映される設計になっているか(マスタを更新してもコード側の固定リストが優先されてしまう、といった不整合がないか)確認する。
5. 例外として、初期シードデータ(マイグレーション/シーディングスクリプトで初期4分類を投入する処理)はハードコードして問題ない。区別すべきは「実行時のロジックが分類名に依存しているか」であり、「初期データ投入時に分類名を書いているか」ではない。

## 出力

ハードコードを検出した場合は該当ファイル・行と、マスタデータ参照に置き換える具体的な修正案を示す。問題がなければその旨を簡潔に報告する。
