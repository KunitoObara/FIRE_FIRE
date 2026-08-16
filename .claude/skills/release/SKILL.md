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
| 未リリースの差分があり、開いたままのリリースPRは無い | **A. リリースPRを作る** |
| リリースPRが開いたままで、そのあと `develop` に差分が入った | **A-6. 本文を追いつかせる**(新しいPRは作らない)。ただし head が `release/*` ならPRの中身は動かないので何もしない(A-4′) |
| リリースPRが開いたままで、差分も増えていない | **何も作らない。** A-5の報告を繰り返す(PRのURL・含まれるカード・CIの状態)だけでよい |
| 直近のリリースPRがマージ済み | **B. デプロイ結果を確認する** |

最初に `gh pr list --base main --state all --limit 3 --json number,title,state,mergedAt,url` で直近のリリースPRを見て、どれなのかを判断する。**開いたままのリリースPRがあるなら、どの行に落ちても新しいリリースPRは作らない。**

**Bを済ませたかどうかは記録しない。** `/card-review` の `review-round` マーカーに当たるものは置いていない。Bは `gh run list` / `gh run view` で読むだけで副作用が無く、2度走らせても害が無いため。判定材料の `gh pr list` はPRの状態しか返さないので、「確認済みか」を判定しようとしない。

**Bと他の行の両方に当てはまるときは、必ずBを先にやる。** 一つ前のリリースがマージ済みで、そのあと `develop` に差分が入った(A)ケースだけでなく、**次のリリースPRが既に開いている**(A-6 / 3行目)ケースも含む。前のリリースが本番で成功したかどうかを確かめないまま次を積むと、本番が壊れている状態に新しい差分を重ねることになり、どちらが原因かが分からなくなる。

---

## A. リリースPRを作る

### A-1. STGに出ているか確かめる

```bash
git fetch origin
git rev-parse origin/develop
gh run list --workflow deploy.yml --branch develop --limit 3 \
  --json conclusion,headSha,createdAt,url
```

**`git fetch origin` を先に流す。** ローカルのリモート追跡ブランチが古いままだと、`origin/develop` は過去のSHAを指す。GitHub側から取った実行一覧と突き合わせる比較なので、片方だけが古いと判定にならない。

**CIは `develop` への push では走らない**(PRにしか走らない)。`develop` が健全であることの手がかりは、この `deploy.yml` の成功しかない。

- 最新が `success` → STGにはその内容が出ている
- 最新が `failure` → **STGに出ていない**。本番へ出す前に直す。ここを飛ばすと、STGで一度も動いていないものを本番に入れることになる
- 最新が `in_progress`(`conclusion` が空) → まだ出ている途中。終わるまで待つ
- 実行が1件も無い → 想定外。`deploy.yml` が `develop` で一度も走っていないことになるので、リリースを進めずワークフローの状態を確認する

**最新の実行の `headSha` が `origin/develop` の先端と一致しているかを見る。** 一致していなければ、その成功は**いまリリースしようとしている内容のものではない**。直近のマージ分がまだSTGに出ていない状態で本番へ出すことになる。

**一致を探しに行かない。** 一覧を3件出しているのは経緯を見るためで、2件目・3件目のどれかが `origin/develop` と一致していても「STGに出ている」ことにはならない。見るのは最新の1件だけ。

### A-2. 未リリースの差分を出す

```bash
git log --oneline origin/main..origin/develop
git diff origin/main...origin/develop --stat | tail -1
```

A-1で `git fetch origin` を済ませてあるので、ここでは取り直さない。

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

### A-4′. リリースブランチを head にする場合

**既定はA-4の直PR(`--head develop`)。** POが「リリースブランチで出す」と言ったときだけこちらを採る(正本 10章「リリースブランチを使う場合(例外)」)。**自分の判断で切り替えない。** 差分が大きくて直PRでは困りそうなときは、切り替えずに理由を添えて提案する。

```bash
git switch -c release/YYYY-MM-DD origin/develop
git push -u origin release/YYYY-MM-DD
gh pr create --base main --head release/YYYY-MM-DD \
  --title "リリース YYYY-MM-DD" --body-file <file>
```

- **A-1で `deploy.yml` の成功と一致を確かめた `origin/develop` から切る。** そのSHAがSTGに出ている内容そのもので、ここで切った時点の中身が本番へ行く
- ブランチ名は `release/YYYY-MM-DD`。`feature/fire-fire-<カードID>` は使わない
- **このブランチにコミットを積まない。** 直すものが出たら `develop` で直し、STGに出てからブランチを切り直す。`deploy.yml` は `release/*` に反応しないので、積んだものはSTGを通らずに本番へ入る
- 「基底が古い」と出たときだけ、**このブランチに `main` を取り込む**。`develop` には取り込まない(正本 10章)
- **A-6の追いつかせは要らない。** head が `develop` ではないので、`develop` に別のPRが入ってもこのPRの中身は動かない。逆に、切ったあとに `develop` へ入ったものは**このリリースには入らない**ので、本文の「含まれるカード」はA-2の一覧のままでよい

### A-5. 報告してマージを待つ

PRのURL、含まれるカード、CIの状態を報告する。**マージはPO。** そのうえで、マージしたら `/release` をもう一度呼ぶ(Bに入る)と伝える。

**マージまでの間に `develop` へ別のPRがマージされたら、本文を追いつかせる**(A-6)ことも伝える。放っておくと本文と中身がずれる。

### A-6. 開いたままのリリースPRに差分が積まれたとき

**新しいリリースPRを作らない。本文を直す。**

**head が `release/*` のときはこの節に用が無い**(A-4′)。差分が動くのは head が `develop` そのもののときだけ。

リリースPRの head は `develop` **ブランチそのもの**なので、PRが開いている間に `develop` へマージが入ると、**そのPRの差分とCIは黙って最新の `develop` に追随する**。一方で本文はPRを作った時点のままで、あとから入ったカードのことは何も書かれていない。「STGで確認した範囲」が実態より狭いまま、確認済みに見える状態になる。この本文は claude-review が走らない工程で唯一の申し送りなので、ずれたままにしない。

```bash
git fetch origin
git log --oneline origin/main..origin/develop
```

A-2 と同じコマンドでよい。出てきたコミットのうち、**PR本文の「含まれるカード」に載っていないものがあれば**、A-3 のとおり確認範囲を整理したうえで本文を更新する。

```bash
gh pr edit <番号> --body-file <file>
```

- 本文は**必ず `--body-file`**(A-4 と同じ理由)
- 追記ではなく本文全体を作り直す。`gh pr edit --body-file` は本文を置き換える
- 更新したことがPRの履歴に残らないので、**何を足したかを `gh pr comment <番号> --body-file <file>` で1行残す**

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
- **開いたままのリリースPRを放置して2本目を作らない**(A-6)。head が `develop` なので、1本目が中身だけ増えていく
- **リリースブランチにコミットを積まない**(A-4′)。STGを通っていないものが本番へ入る。直すのは `develop` で、リリースブランチは切り直す
