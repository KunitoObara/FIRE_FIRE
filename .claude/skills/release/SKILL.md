---
name: release
description: Ships what has accumulated on develop to production by opening the develop → main release pull request, then — after the PO merges it — checking that the deploy workflow actually succeeded. Use this skill when the user says "リリースして", "本番に出して", "リリースPRを作って", "デプロイの結果を見て", or when invoked as /release.
---

# リリース(`develop` → `main`)

[docs/development-workflow.md](../../../docs/development-workflow.md) が正本。**先に10章(リリース)と9章(前提と制約)を読む**。単位・タイトル規約・この工程が他と違う点はそこにある。文書全体を読む必要はない。

**この工程だけカードを起点にしない。** 対象は「`main` に入っていない `develop` の差分」全部であって、特定のカードではない。Trelloの操作も無い(カードは各PRのマージ時点で `/card-start` が完了へ動かす)。

## 2段構え

| 呼ばれた状況 | やること |
|---|---|
| 未リリースの差分がある | **A. リリースPRを作る** |
| 直近のリリースPRがマージ済みで、デプロイ結果が未確認 | **B. デプロイ結果を確認する** |

最初に `gh pr list --base main --state all --limit 3 --json number,title,state,mergedAt,url` で直近のリリースPRを見て、どちらなのかを判断する。開いたままのリリースPRがあるなら、それはマージ待ちなのでAをやり直さない。

**両方に当てはまるときはBを先にやる。** 直近のリリースがマージ済みで、そのあとさらに `develop` へ差分が入っている場合である。前のリリースが本番で成功したかどうかを確かめないまま次を積むと、本番が壊れている状態に新しい差分を重ねることになり、どちらが原因かが分からなくなる。

---

## A. リリースPRを作る

### A-1. STGに出ているか確かめる

```bash
gh run list --workflow deploy.yml --branch develop --limit 3 \
  --json conclusion,headSha,createdAt,url
```

**CIは `develop` への push では走らない**(PRにしか走らない)。`develop` が健全であることの手がかりは、この `deploy.yml` の成功しかない。

- 最新が `success` → STGにはその内容が出ている
- 最新が `failure` → **STGに出ていない**。本番へ出す前に直す。ここを飛ばすと、STGで一度も動いていないものを本番に入れることになる
- 最新が `in_progress`(`conclusion` が空) → まだ出ている途中。終わるまで待つ
- 実行が1件も無い → 想定外。`deploy.yml` が `develop` で一度も走っていないことになるので、リリースを進めずワークフローの状態を確認する

**`headSha` が `origin/develop` の先端と一致しているかを見る。** 一致していなければ、その成功は**いまリリースしようとしている内容のものではない**。直近のマージ分がまだSTGに出ていない状態で本番へ出すことになる。

```bash
git rev-parse origin/develop
```

### A-2. 未リリースの差分を出す

```bash
git fetch origin
git log --oneline origin/main..origin/develop
git diff origin/main...origin/develop --stat | tail -1
```

1件も無ければ**リリースするものが無い**。そう報告して終わる。

含まれるカードを特定する。コミットタイトルの先頭が画面ID(`X13 ...`、`B11 ...`)なので、そこから拾う。マージコミットは数えない。

### A-3. STGで確認した範囲を整理する

**ここがこの工程の中心。** claude-review はリリースPRでは走らない(正本 9章)ので、差分に対する自動の目はもう無い。人が見るための材料を、PR本文に残すのがこの工程の仕事になる。

含まれるカードごとに、次のどれなのかを書き分ける。**分からないものを「確認済み」に混ぜない。**

- STG(`fire-fire-dev`)で実際に動かして確認した
- ローカル(`npm run dev`。B0-1でSTGに直結している)で確認した
- 自動テストだけ。画面では触っていない
- ドキュメント・設定のみで、動作に関わらない

### A-4. リリースPRを作る

```bash
gh pr create --base main --head develop \
  --title "リリース YYYY-MM-DD" \
  --body-file <file>
```

- **`--base main` を省かない。** デフォルトブランチが `develop` なので、省くと `develop` 宛てのPRになる
- 同じ日の2本目以降は `リリース YYYY-MM-DD-2` のように連番を足す
- 本文は**必ず `--body-file`**。インラインの `--body` は、本文が `merge` などの語に触れた時点で遮断フックに拒否される

本文の書式:

```markdown
## 含まれるカード

- [X13](カードURL) 自動レビューの修正とセルフレビューの導入 — PR #109
- [X0-8](カードURL) Skillsの精査 — PR #111

## STGで確認した範囲

- X13: ドキュメントとワークフローのみ。動作確認は不要
- X0-8: 同上

## 確認していないこと

(STGで触っていないもの、影響が読み切れないもの。無ければ「なし」と書く)

## 注意

このPRは claude-review の対象外(docs/development-workflow.md 9章)。マージすると `fire-fire-prod` へデプロイされ、自動ロールバックは無い。
```

### A-5. 報告してマージを待つ

PRのURL、含まれるカード、CIの状態を報告する。**マージはPO。** そのうえで、マージしたら `/release` をもう一度呼ぶ(Bに入る)と伝える。

---

## B. デプロイ結果を確認する

マージの直後は走り始めたばかりのことが多い。

```bash
gh run list --workflow deploy.yml --branch main --limit 1 --json databaseId,status,conclusion,url
gh run watch <run-id> --exit-status
```

### 成功したとき

デプロイされたものを報告する。**「ワークフローが緑」と「本番が正しく動いている」は別。** リリースに次のものが含まれていたときは、本番側で人が確かめる項目を案内する。

| 含まれていたもの | 案内する確認 |
|---|---|
| ログイン通知メール(`src/backend/src/login-notification`) | 本番のログイン通知の件名に `[dev]` が付いていないこと([ci-cd-setup.md](../../../docs/ci-cd-setup.md) 13章) |
| 認証まわり(A1〜A8、`src/backend/src/mfa-recovery`) | 本番のアカウントでログインと2FAが通ること。STGとは別のIdentity Platform設定なので、STGで通ったことは本番の裏付けにならない |
| `firestore.rules` / `storage.rules` | 本番で画面がデータを読み書きできること。ルールの誤りは画面が空になる形で出る |

### 失敗したとき

**中途半端な状態が本番に残りうる。** `deploy.yml` は Functions / Firestore / Storage のデプロイのあとに App Hosting のロールアウトを作るので、途中で落ちるとバックエンドだけ新しくフロントエンドが古い、という組み合わせになる。

1. `gh run view <run-id> --log-failed` で落ちた場所を特定する
2. 一過性のものなら再実行を提案する(Firebase CLI の認証は確率的に失敗することがある。[ci-cd-setup.md](../../../docs/ci-cd-setup.md) 8章)
3. 一過性でないなら、**戻すのではなく直して出し直す**のが既定。`main` への force push も revert の直接pushも行わない。`develop` で直してから、もう一度リリースPRを出す

**自分でロールバックしない。** 何を戻すべきかの判断はPOのもので、この工程は状況を正確に報告するところまでを受け持つ。

---

## やらないこと

- **マージしない。** リリースPRも feature のPRと同じくPOの操作(正本 8章)
- **`main` に直接 push しない。** revert も同じ
- **STGが赤いまま本番へ出さない**(A-1)。「CIが走っていない」ことを「緑」と読み替えない
- **確認していないものを「確認済み」と書かない**(A-3)。claude-review が走らない以上、この本文が唯一の申し送りになる
