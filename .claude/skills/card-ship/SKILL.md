---
name: card-ship
description: Takes a finished card from commit through push to a pull request against develop, then moves its Trello card to the 確認中 (in review) list — running the same verification commands as CI, plus whichever project skills match what changed, before the PR is opened. Use this skill when the user says "実装が終わった", "PRを作って", or "確認中に移して", or when invoked as /card-ship.
---

# 実装完了 → PR → 確認中へ

[docs/development-workflow.md](../../../docs/development-workflow.md) が正本。**まずこの文書を読む**。PR本文のフォーマット、コミット規約、検証コマンド、リストIDはそこにある。

## 手順

### 1. 変更内容の把握

```bash
git status --short
git diff develop...HEAD --stat
```

カードのスコープ外の変更が混ざっていないか確認する。混ざっている場合は消すのではなく、PR本文の「レビューで見てほしい点」に理由つきで明記する。

### 2. 検証を通す

変更した側で、CIと同じコマンドを**すべて**通す(正本の文書「6. PR前のローカル検証」の表)。1つでも落ちていたらPRを作らない。先に直す。

`firestore.rules` を触った場合は `firebase emulators:exec --only firestore` も走らせる。

変更内容に応じて、該当するプロジェクトスキルも実行する(画面なら `screen-spec-drift-check`、ルールなら `firestore-rules-review`、CSVなら `mf-csv-parser-check`、FIRE計算なら `fire-calc-verify`、分類軸なら `category-master-extensibility-check`)。ここで見つかった問題は、レビューに回さずこの場で直す。

### 3. コミット

タイトルは `B7 不動産登録・編集画面を実装` の形式。本文には**なぜそうしたか**を書く。何を変えたかはdiffで読めるので、判断の理由と却下した代案を残す。

トレーラーは既存コミットに合わせる。モデル名は**そのセッションで実際に動いているモデル**を入れる。

```
Co-Authored-By: <セッションのモデル名> <noreply@anthropic.com>
```

既存コミットが `Claude Opus 5` になっているのは、その回のセッションがOpusだったからに過ぎない。固定値としてコピーすると、実際に作業したモデルと違う名前が帰属として残る。

### 4. push と PR 作成

```bash
git push -u origin <ブランチ名>
```

PRは `develop` 宛。タイトルはコミットタイトルと同じ。本文は正本の文書「PR本文のフォーマット」に従い、**先頭行に `Trello: <カードのURL>`** を置く。

- 「変更内容」— 何を実装したか。参照した要件定義書へリンクする
- 「レビューで見てほしい点」— 判断が分かれうる箇所、スコープ外の変更、意図的に見送ったもの
- 「確認したこと」— 実行したコマンドと結果(テスト件数まで書く)

タイトルに `WIP` を入れない(CIの `wip-check` が落ちる)。

### 5. Trelloカードを確認中へ

1. `mcp__trello__move_card` でカードを**確認中**リストへ移動する
2. `mcp__trello__add_comment` でPRのURLをカードにコメントする

```
PR: https://github.com/KunitoObara/private_room/pull/<番号>
```

このコメントは、次回 `/card-start` がマージ状況を照合するときの手がかりにもなる。

### 6. 報告

PRのURL、カードの移動結果、検証コマンドの結果を短くまとめる。最後に、レビューが出そろったら `/card-review` を使う、と伝える。

**マージはしない。** `gh pr merge` はPOの操作であり、`.claude/settings.json` でも封じてある。
