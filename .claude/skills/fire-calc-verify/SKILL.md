---
name: fire-calc-verify
description: Verifies FIRE achievement-rate and projected-date calculations, and the annual-expense-to-target-amount reverse calculation (e.g. 4% rule), against known inputs and expected outputs. Use this skill whenever code implementing or modifying the FIRE goal (B8), achievement gauge, or projection logic is written — financial math is easy to get subtly wrong (off-by-one in date math, percentage vs ratio confusion, wrong rounding), and this skill exists to catch that before it reaches the dashboard.
---

# FIRE達成度・到達予測の計算検証

## なぜこのスキルが必要か

docs/fire-asset-management-requirements.md 4.6は、目標設定に2方式(目標資産額の直接設定/年間支出額からの逆算)を要求し、達成度と到達予測日を算出するとしている。これらは単純に見えて割合と資産成長率の複合計算であり、以下のような間違いが起きやすい。

- 達成度を%表示すべき箇所で比率(0〜1)のまま表示してしまう
- 到達予測日の計算で、資産成長を単利/複利のどちらで見込むか実装によってブレる
- 4%ルールなど「年間支出額→必要資産額」の逆算で、年率と月率を取り違える
- 目標未達成(現在資産が想定利回りでも目標に届かない)ケースで到達予測日がinfinity/NaN/過去日付などおかしな値になる

## 検証手順

1. 変更対象の計算関数を特定する(達成度計算、到達予測日計算、年間支出額からの目標資産額逆算)。
2. 既知の入力に対して手計算で期待値を出し、それと実装の出力を比較する。例:
   - 目標3,000万円・現在1,500万円 → 達成度50%
   - 年間支出300万円・4%ルール → 必要資産額7,500万円(300万 ÷ 0.04)
3. 境界値を確認する。
   - 現在資産が目標を超えている(達成度100%超、到達予測日は「達成済み」を返すべきで過去日付や負の日数にならないか)
   - 現在資産が0、または資産の増加ペースが0以下(到達不能なケースで無限ループやNaNにならず、明示的に「到達見込みなし」等を返すか)
   - 目標資産額が0または未設定
4. 表示層(ゲージ・到達予測日の文言)で、計算結果の単位(円、%、日付)が正しく反映されているか確認する。
5. 自動テストのフレームワークが導入済みであれば、上記のケースをユニットテストとして`src/frontend`または`src/backend`の該当ディレクトリに追加することを提案する。まだテスト基盤がなければ、このスキルの中で手計算による検証結果をレポートするだけでよい。

## 出力

各テストケースについて「期待値/実際の値/一致するか」を一覧で示し、不一致があれば原因箇所を指摘する。
