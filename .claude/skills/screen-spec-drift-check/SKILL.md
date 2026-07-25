---
name: screen-spec-drift-check
description: Cross-checks implemented frontend screens/pages against the screen requirements docs (docs/screen-list-and-transitions.md and docs/screen-requirements-*.md) — screen IDs A1-A7 and B1-B10, their listed display/input fields, and their transition conditions. Use this skill after implementing or modifying a page/route under src/frontend, or when the user asks whether a screen "matches the spec" or is "done" — proactively run it once real page components exist, since drift is easy to miss without an explicit diff against the docs.
---

# 画面要件⇔実装の整合性チェック

## なぜこのスキルが必要か

docs/screen-list-and-transitions.md と各 docs/screen-requirements-*.md は、画面ID(A1〜A7, B1〜B10)ごとに表示項目・入力項目・主な操作・遷移条件を細かく定義している。画面実装が積み上がるにつれて、要件定義書の更新漏れや実装側の解釈違いによる乖離が起きやすい。このスキルは実装後に定期的に差分を検出するためのものであり、実装前の設計フェーズでは単に要件定義書を読めばよい。

## チェック手順

1. 対象の画面IDを特定する(実装したファイルパスから `src/frontend` 配下のルーティング構造を見て、どの画面IDに対応するか判断する)。
2. 該当する要件定義書のセクションを読む。
   - 認証系(A1〜A7) → docs/auth-login-requirements.md 4章、docs/screen-requirements-auth.md
   - ダッシュボード・データ管理系(B1〜B4) → docs/screen-requirements-dashboard.md
   - 不動産管理系(B5〜B7) → docs/screen-requirements-real-estate.md
   - FIRE目標・シミュレーション系(B8〜B9) → docs/screen-requirements-fire-goal.md
   - アカウント系(B10) → docs/screen-requirements-account.md
   - 画面遷移条件の全体像 → docs/screen-list-and-transitions.md 3章(Mermaid図)
3. 表示項目・入力項目が実装コンポーネントに揃っているか照合する。抜けている項目、要件にない項目が追加されている場合は両方を報告する(要件更新漏れの可能性もあるため、「実装が間違っている」と決めつけない)。
4. 遷移条件(ボタン押下でどの画面に遷移するか)をMermaid図と照合する。特にエラー系の遷移(パース失敗時に画面に留まる、等)は見落とされがちなので注意する。
5. 差分が見つかった場合、それが実装漏れなのか、要件定義書側の更新が必要な仕様変更なのかをユーザーに確認する。無断でどちらかを正としてコードや要件定義書を書き換えない。

## 出力

画面IDごとに「一致」「差分あり(詳細)」を一覧で報告する。
