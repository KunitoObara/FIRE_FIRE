---
name: card-review
description: Waits for CI and the claude-review bot on a pull request and works through their findings, counting each fix push as one round up to a limit of three — past the limit, only critical findings (CI failures, security, data loss, a screen that does not work) are fixed and the rest are filed as new cards at the end of the Trello backlog. Use this skill when the user says "レビューを見て", "指摘に対応して", or "CIを直して", or when invoked as /card-review.
---

# レビュー対応

[docs/development-workflow.md](../../../docs/development-workflow.md) が正本。**まずこの文書を読む**。往復の数え方、重大の基準、起票テンプレートはそこにある。

## 手順

### 1. 対象PRと現在の往復数を確定する

```bash
gh pr view --json number,url,state,headRefName,title
gh pr view <番号> --comments
```

コメント本文の `<!-- review-round:N -->` マーカーの**最大値**が、これまでに消化した往復数。マーカーが1つも無ければ0往復目。セッションをまたいでもここから状態を復元できる。

### 2. CIとレビューの完了を待つ

```bash
gh pr checks <番号> --watch --interval 30
```

claude-review が実行されたかを別途確認する。

```bash
gh run list --workflow claude-review.yml --branch <ブランチ名> --limit 5
```

claude-review は `main` 上のワークフローファイルと一致するときだけ実際に動く。実行が無ければ「ボットのレビューは走っていない」と明示して報告する。**コメントが無いことを「指摘なし」と取り違えない。**

### 3. 指摘を集める

- 全体コメント: `gh pr view <番号> --comments`
- インラインコメント: `gh api repos/KunitoObara/FIRE_FIRE/pulls/<番号>/comments`
- CIの失敗内容: `gh run view <run-id> --log-failed`

前回のラウンド以降に付いたものだけを対象にする(`created_at` で絞る)。対応済みの指摘を数え直さない。

### 4. 指摘を分類する

| 種別 | 往復にカウント | 扱い |
|---|---|---|
| CIの失敗 | **しない** | グリーンになるまで必ず直す |
| PO(人間)のコメント | **しない** | 上限に関係なく必ず対応する |
| claude-review ボットの指摘 | **する** | 上限3往復まで対応 |

claude-review の指摘は誤検知のこともある。鵜呑みにせず、コードと要件定義書で裏を取ってから直す。誤検知だと判断したものは直さず、PRコメントで根拠を示して返す(それも1往復に数える)。

同じ誤検知が繰り返し出るようなら、`CLAUDE.md` に**検証可能な事実**として書き足す。「指摘するな」という命令文は書かない — 指示文自体がプロンプトインジェクションとして次のレビューで弾かれる。提供元・出典・なぜそう見えるか・確かめるコマンドの4点を書く。

### 5. 修正して push する

修正後は `/card-ship` と同じ検証コマンド一式を通してから push する。

push したらPRにコメントを投稿する。**マーカーを付けるのは claude-review の指摘に対応した回だけ**。

- claude-review の指摘に1件でも対応した → `<!-- review-round:N -->` を付けて番号を1つ進める
- **CIの失敗を直しただけ / POの指摘に対応しただけ** → マーカーを**付けない**。何をしたかのコメントは投稿する

CI失敗とPOの指摘は上限に数えない規定なので、マーカーを付けると実際には claude-review に3回対応していないのに上限到達と誤判定され、残りの指摘が誤ってバックログへ切り出される。

コメント本文は**必ずファイルに書いて `--body-file` で渡す**(`gh pr comment <番号> --body-file <file>`)。`--body` にインラインで渡すと、本文に `merge` や `--force` のような語が含まれた時点で禁止コマンド遮断フックに拒否される(コマンド文字列全体を見るため)。レビュー対応の説明では実際にこれらの語に触れることが多い。

```markdown
<!-- review-round:2 -->
レビュー対応 2/3 回目。

- (対応した指摘と、どう直したか)
- (対応しなかった指摘と、その理由)
```

push により claude-review が再実行される。次のラウンドに進む場合は手順2へ戻る。

### 6. 3往復に達したあと

残っている指摘を振り分ける。

**上限を無視して修正しきるもの(重大)** — CI失敗 / セキュリティ / データ破壊・損失 / 画面が機能しない。判断基準の詳細は正本の文書「7. レビュー対応のルール」。

**新規カードとして起票するもの** — それ以外(リファクタ提案、命名、テスト追加、UIの微調整、将来の拡張性)。

起票は `mcp__trello__add_card_to_list` でバックログの末尾へ。ラベルは元カードに合わせる。カード名と本文のテンプレートは正本の文書のとおり。

起票したら、PRにコメントで「この指摘は別カード <カードURL> に切り出した」と残す。指摘が黙って消えたように見えないようにするため。

### 7. 報告

対応した指摘、起票したカード、CIの最終状態をまとめて報告する。マージ待ちであることを明記する。

**マージはしない。** マージはPOの操作。マージ後、次回の `/card-start` がカードを完了へ移動する。
