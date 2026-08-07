# 開発フロー

Trelloカードを起点に、着手 → 実装 → PR → レビュー対応 → 完了までを進めるための手順書。
3つのスキル([.claude/skills/](../.claude/skills/))がこの文書を正本として動く。IDや判断基準を変えるときはこの文書を直す。

## 1. 全体の流れ

| 段階 | 実行するもの | やること |
|---|---|---|
| 着手 | `/card-start` | 確認中カードのマージ同期 → 着手カード選定 → 要件読込 → **まとめて質問** → 作業ブランチ作成 |
| 実装 | (通常の対話) | 実装 → ローカル検証コマンド一式 |
| PR | `/card-ship` | コミット → push → PR作成 → カードを**確認中**へ移動 |
| レビュー対応 | `/card-review` | CI・レビューの完了待ち → 指摘の分類 → 修正して push(=1往復) |
| マージ | **人間(PO)のみ** | Claudeはマージしない |
| 完了 | 次回の `/card-start` | マージ済みのカードを**完了**へ移動 |

Claudeが自発的にTrelloの変化を検知することはできない(Webhookを受ける口がない)。
着手はユーザーが `/card-start` を叩くことで始まり、マージ検知は次回の `/card-start` 冒頭でまとめて行う。

完了の表現は**完了リストへの移動のみ**とする。Trelloの「完了としてマーク」は期限日とセットのフラグ(`dueComplete`)で、期限日を持たないカードではUIに現れない。カードに期限日を自動で入れるのは運用上の副作用が大きいため、リスト位置を唯一の完了状態とする。

## 2. Trelloボード

ボード **FIRE-FIRE** <https://trello.com/b/DSwgTFdT/fire-fire> (非公開)

アクセスには `mcp__trello__*` ツールを使う。非公開ボードのため `WebFetch` では読めない(カードURLはエラーHTML、`.json` は401)。ブラウザツールを使う必要はない。

`boardId`: `6a64620b375885bc9f63d280`

### リストID

| リスト | ID |
|---|---|
| バックログ | `6a64621943ec682f041fd1f0` |
| ToDo | `6a64622558d72cad2aef4dbb` |
| 進行中 | `6a64622cf6890fe88fc5cd7f` |
| 確認中 | `6a64627888412a21985fe5bb` |
| 完了 | `6a64627c56d272a0f18249d2` |
| ペンディング | `6a6462807935eb65aff03c6f` |

### ラベルID

ラベルは工程を表す。着手判定に使うのは上2つ。

| ラベル | ID |
|---|---|
| 詳細設計・実装 | `6a64620b375885bc9f63d29f` |
| テスト実装 | `6a64620b375885bc9f63d29e` |
| 要件定義・要求定義 | `6a6462b5bc4d05e9d3d29ddd` |
| 環境設定・インフラ | `6a6581aeb8c8041bcdbb8c81` |
| 非機能要件 | `6a64620b375885bc9f63d29b` |
| 基本設計 | `6a64620b375885bc9f63d2a0` |
| リリース | `6a64620b375885bc9f63d29d` |

### 着手対象の判定

**進行中リストにあり、かつ「詳細設計・実装」または「テスト実装」のラベルが付いている**カードだけを着手対象とする(OR条件)。

進行中にあってもこの条件を満たさないカード(要件定義だけ、インフラだけ、等)は着手せず、「対象外」として一覧に出すだけにする。勝手に実装を始めない。

### カードと画面IDの対応

カード名は `[B8] FIRE目標設定画面` の形式で、`docs/screen-list-and-transitions.md` の画面ID(A1〜A8、B1〜B10)に対応する。`[A5-2]` のような枝番はレビュー指摘から起票された後続カード。

## 3. 着手時に読むもの

カードの説明文には「画面目的 / 表示項目 / 入力項目 / 主な操作 / 遷移条件」と、HTMLモックのパス・参照ドキュメントのURLが入っている。着手時は次を必ず読む。

1. カード本文とチェックリスト、既存コメント
2. カード本文が参照している `docs/` 配下の要件定義書
3. カード本文に書かれた `src/frontend/docs/html_mock/` のHTMLモック
4. ルートの `CLAUDE.md`、`DESIGN.md`、`src/frontend/docs/CODING_STANDARDS.md`

## 4. 質問のまとめ方

実装に入る前に、不明点を**1回にまとめて**質問する。実装の途中で小出しに聞かない。

質問する / しないの線引き:

- **質問する** — 解釈が割れると成果物が変わるもの。要件定義書とHTMLモックが食い違っている、カードのスコープ境界が曖昧、既存画面の挙動を変える必要がある、要件定義書に書かれていない仕様判断が必要
- **質問しない** — 慣例で決まるもの。ファイル配置、コンポーネント分割、命名、既存パターンの踏襲

判断材料が要件定義書と既存コードから揃うなら、質問せずそのまま実装に入ってよい。

## 5. ブランチ・コミット・PRの規約

既存の運用を踏襲する。

- **作業場所**: メインの作業ツリー。`develop` から直接ブランチを切る(worktreeは使わない)
- **ブランチ名**: `feature/fire-fire-<カードIDを小文字にしたもの>` — 例 `feature/fire-fire-b7`、`feature/fire-fire-a5-2`
- **コミット/PRタイトル**: `B7 不動産登録・編集画面を実装` — 画面IDを先頭に、体言止めではなく「〜を実装」「〜に対応」
- **コミット本文**: なぜそうしたかを書く。「何を変えたか」はdiffで読めるので、判断の理由と却下した代案を残す
- **マージ方式**: squash merge(PO が実施)

### PR本文のフォーマット

```markdown
Trello: <カードのURL>

## 変更内容

(何を実装したか。参照した要件定義書へのリンクを添える)

## レビューで見てほしい点

(判断が分かれうる箇所、カード範囲外の変更、意図的に見送ったもの)

## 確認したこと

(実行したコマンドと結果)
```

「カード範囲外の変更」を含めた場合は、**必ず**「レビューで見てほしい点」に理由つきで明記する。

## 6. PR前のローカル検証

`src/frontend` / `src/backend` のうち変更した側で、CIと同じコマンドを通す(`CLAUDE.md` の「Commands」表)。

| | `src/frontend` | `src/backend` |
|---|---|---|
| Lint | `npm run lint` | `npm run lint` |
| Format check | `npm run format:check` | — |
| Type check | `npm run typecheck` | `npm run typecheck` |
| Test | `npm run test` | `npm run test` |
| Build | `npm run build` | `npm run build` |

`firestore.rules` を触った場合は `firebase emulators:exec --only firestore` で構文を確認する。

変更内容に応じて、既存のプロジェクトスキルも実行する。

| 変更した箇所 | 実行するスキル |
|---|---|
| `src/frontend` の画面/ルート | `screen-spec-drift-check` |
| `firestore.rules` / 新しいコレクション | `firestore-rules-review` |
| CSV取込・パース(B2) | `mf-csv-parser-check` |
| FIRE目標・達成率・到達予測(B8) | `fire-calc-verify` |
| 資産分類軸(B4、ダッシュボードの内訳) | `category-master-extensibility-check` |

## 7. レビュー対応のルール

### 何を「レビュー」とみなすか

1. **claude-review ボットのコメント** — [.github/workflows/claude-review.yml](../.github/workflows/claude-review.yml) が PR の `opened` / `synchronize` で投稿する
2. **CI(ci.yml)の失敗** — `wip-check` / `frontend` / `backend`
3. **PO(人間)のPRコメント**

### 往復の上限

**修正 push 1回 = 1往復。上限3往復。**

- CIの失敗は往復に数えない。グリーンになるまで何度でも直す
- POのコメントは往復に数えない。上限に達したあとでも必ず対応する
- 上限に数えるのは claude-review ボットの指摘への対応だけ

往復回数は、PRへ投稿するコメント内のマーカーで管理する。

```
<!-- review-round:2 -->
レビュー対応 2/3 回目。
```

`/card-review` は開始時に `gh pr view <PR番号> --comments` からこのマーカーの最大値を読み、現在の往復数を判定する。セッションをまたいでも状態が復元できるようにするため。

**マーカーを付けるのは claude-review の指摘に対応した回だけ。** CIの失敗を直しただけの回や、POの指摘に対応しただけの回には付けない(コメントは投稿するが番号を進めない)。上限に数えない対象でマーカーを進めてしまうと、実際には claude-review に3回対応していないのに上限到達と判定され、残りの指摘が誤ってバックログへ切り出される。

### 3往復に達したあとの扱い

残っている指摘を次の基準で振り分ける。

**上限を無視して修正しきるもの(重大)**

- CIが失敗している
- セキュリティ — `firestore.rules` / `storage.rules` の穴、認証・2FAのバイパス、他ユーザーの資産データが読める、秘密情報の漏洩
- データ破壊・損失 — Firestoreの意図しない上書き/削除、CSV取込の部分反映、金額計算の誤り
- 画面が機能しない — カードの主要操作が動かない、遷移しない、クラッシュする、要件を満たしていない

**新規カードとして起票するもの**

上記以外(リファクタ提案、命名、テストの追加、UIの微調整、将来の拡張性の指摘など)。

### 起票する新規カード

- **投入先**: バックログの末尾
- **ラベル**: 「詳細設計・実装」「テスト実装」(元カードに合わせる)
- **カード名**: `[<元の画面ID>-<枝番>] <対応内容>` — 例 `[A5-2] 2FA検証セッション期限切れ時に入力を無効化する`
- **本文テンプレート**:

```markdown
(指摘の内容と、なぜ直すべきかを自分の言葉で要約する)

対応: (具体的にどう直すか)

該当: (ファイルパス)

出典: PR #<番号> のレビューコメント <PRのURL>
```

起票したら、元のPRにコメントで「この指摘は別カード <カードURL> に切り出した」と残す。指摘が黙って消えたように見えないようにするため。

## 8. Claudeがやらないこと

- **マージしない**。`gh pr merge` も、`gh api` で `.../pulls/<番号>/merge` を叩くのも同じ。マージはPOの判断
- **force push しない**
- **`develop` / `main` へ直接pushしない**
- **要件定義書とコードの食い違いを無断でどちらかに寄せない**。どちらが正かをユーザーに確認する(`screen-spec-drift-check` と同じ方針)
- **`docs/.env` を読まない・出力しない**

### 設定による裏付け

上のうち機械的に判定できるものには [.claude/settings.json](../.claude/settings.json) で歯止めをかけてある。文書のルールだけに頼らないため。ただし**すべてを塞げているわけではない**(後述の「限界」)。

| 対象 | 手段 | 判定 |
|---|---|---|
| `firebase deploy` | `permissions.deny` | 拒否 |
| 再帰的な強制削除(`rm -rf` 系) | `permissions.deny` + `PreToolUse` フック | 拒否 |
| マージ(`gh pr merge`、`gh api` の `.../merge`、`gh api` の書き込み) | `permissions.deny` + `PreToolUse` フック | 拒否 |
| `docs/.env`(`.env.example` を除く) | `permissions.deny` + `PreToolUse` フック(Bash / Grep / Glob / Read) | 拒否 |
| force push | `PreToolUse` フック | 拒否 |
| `git reset --hard` / `git clean -f` 系 | `PreToolUse` フック | **確認**(作業中の変更を消すため、拒否ではなく都度確認) |

`permissions` のルールは**ツール単位・前方一致**なので、単体ではどれも穴が残る。フックを重ねているのはそのため。

- **マージ** — `Bash(gh pr merge:*)` は `gh -R <repo> pr merge` のようにグローバルオプションが挟まる形を拾えず、そもそも `gh api repos/<owner>/<repo>/pulls/<番号>/merge -X PUT` と REST API を直接叩けば `gh pr merge` を通らずにマージできてしまう。フックは「`gh` トークン + `merge` トークン」で拒否し、あわせて `gh api` の書き込みも拒否する。書き込みの判定は `-X` / `--method` だけでなく `-f` / `-F` / `--raw-field` / `--input` も見る — `gh api` はこれらを渡すとメソッド未指定でもPOSTになるため。`gh api` の allow はPRコメント取得だけに絞ってある
- **再帰的な強制削除** — `Bash(rm -rf:*)` は前方一致なので `rm -fr`、`rm --recursive --force`、`rm /tmp/x -rf` のようにフラグが末尾に来る形を拾えない。破壊力は作業ツリー丸ごとなのでフックでも見る。判定は「`rm` トークン + force 系フラグ + 再帰フラグ」で、`rm -f`(再帰でない)や `rm -r`(強制でない)は通す
- **`docs/.env`** — `Read(./docs/.env)` は `Read` ツールしか塞がない。`cat docs/.env` のような Bash 経由に加えて、**`Grep` は一致行を返すので内容が読める**。フックを Bash と Grep / Glob / Read の両方に掛けてあり、コマンド文字列やツール引数にパスが現れた時点で拒否する。パスに言及するだけのコマンドも巻き添えで拒否されるが、秘密情報なので安全側に倒している

  唯一の例外が **`docs/.env.example`**。`.gitignore` は `.env` / `.env.*` で無視したうえで `!.env.example` だけを除外対象から外しており、テンプレートはコミット対象として追加されうる。部分一致のままだとこれを触るコマンドまで巻き添えで拒否されるため、フックは判定の前に `docs/.env.example` を**パス境界で終わる形のときだけ**取り除いてから `docs/.env` を探す。`docs/.env.example.bak` や `cp docs/.env.example docs/.env` は境界で終わらない/本体を指すので従来どおり拒否される。

  除外するサフィックスは `.example` **だけ**にしてある。`.env.sample` や `.env.template` は `.gitignore` の例外に入っておらず、置かれれば秘密ファイル側の扱いになるため、通してしまうと守備範囲に穴が開く。

  `permissions.deny` からは `Read(./docs/.env.*)` を外し、`Read(./docs/.env)` だけを残してある。`permissions` のパターンには否定が書けず、`deny` は `allow` より優先されるため、これを残したままだと `Read` ツールからテンプレートが読めない。サフィックス付きの判定はフックに一本化し、`permissions` 側のフォールバックは `docs/.env` 本体のみを守る、と割り切った(この割り切りが妥当なのは、`.env.local` のような派生ファイルが**まだ存在しない**ためでもある。増やすときはフックが効いていることを回帰テストで確かめること)

`git reset --hard` / `git clean` も `permissions.ask` ではなくフックで見る。`permissions` のパターンは前方一致なので、`git -C . reset --hard` のようにグローバルオプションが挟まる形や `git clean -df` のようなフラグ順序違いを拾えず、force push で見つかったのと同じ抜け方をするため。フックは「`git` トークンがある」+「`reset` トークンと `--hard`」/「`clean` トークンと force 系フラグ」で判定し、`permissionDecision: ask` を返す。`git reset --soft` や `git clean -n` は通す。

force push だけ `deny` のパターン列挙ではなくフックにしてあるのは、**パターン列挙では網羅できないため**。`permissions` のパターンは前方一致なので `Bash(git push --force:*)` は `git push origin main --force` のようにフラグが末尾に来る形を拾えず、`git push origin +HEAD:develop` のような `+` 付きリフスペックによる強制更新は `--force` の文字列を一切含まない。

フックはコマンド文字列全体を3つの条件のANDで判定する。**`git push` という連続した文字列は探さない** — `git -C . push -f origin main` や `git -c core.pager=cat push --force` のようにグローバルオプションが間に挟まる形を取りこぼすため。

1. `git` がトークンとして現れる
2. `push` がトークンとして現れる
3. force を意味する綴りが現れる
   - `--force` / `--force-with-lease`(`--force=x` のような `=` 続きも含む)
   - `f` を含む短オプション。連結された形も対象(`-f`、`-fu`、`-uf`、`-qf`)
   - `+` で始まるトークン(`+main`、`+HEAD:develop`、`+feature/xxx:develop`)

**過剰に拒否される場合**: 判定はコマンド文字列全体を見るので、禁止対象の語を**引数として含むだけ**のコマンドも拒否される。安全側に倒した挙動。**本文はファイル経由で渡せば回避できる**。

| 拒否される書き方 | 回避策 |
|---|---|
| `git commit -m "...force push..."` | `git commit -F <file>` |
| `gh pr comment <番号> --body "...merge..."` | `gh pr comment <番号> --body-file <file>` |
| `gh pr create --body "...--force..."` | `gh pr create --body-file <file>` |

とくに `gh` + `merge` の判定はサブコマンドの位置を見ていないため、**レビュー対応の説明文で `merge` の語に触れるだけ**で引っかかる。`/card-review` はラウンドコメントを必ず `--body-file` で投稿すること。`docs/.env` の判定も同様に、パスに言及するだけで拒否される(`docs/.env.example` への言及は除く)。

### CI では無効にしている

フックは `GITHUB_ACTIONS` が設定されていれば何もせず終了する。**リポジトリにコミットした `.claude/settings.json` は、リポジトリをチェックアウトする他の Claude Code 実行にも読み込まれる**ため。

実際に claude-review ジョブがこれで落ちた(PR #44)。同ジョブのSDKオプションは `settingSources: ["user", "project", "local"]` で project を含むので、このフックがレビュー実行にも適用される。レビュー本文で `docs/.env` や `git push --force` に**言及した**だけで、それを引数に持つ `gh pr comment` が拒否され、`permission_denials_count: 13` で失敗した。

CIで無効にして安全なのは、歯止めの対象がそこに存在しないから。

- `docs/.env` は `.gitignore` の `.env` / `.env.*` で除外されており、チェックアウトに含まれない
- claude-review の権限は `contents: read` で、そもそもpushできない

**設定に新しい歯止めを足すときは、レビュージョブを巻き込まないかを必ず考えること。** リポジトリの設定ファイルはローカル専用ではない。

### 限界 — 「網羅している」前提で運用しない

これらの歯止めは**本人がうっかり実行するのを防ぐためのもの**で、回避しようとする相手を止める仕組みではない。以下は既知の抜け道であり、塞いでいない。

- **クォート分割・変数展開**。判定はコマンド文字列への正規表現一致なので、`git push origin main --for''ce` や `$(echo --force)` のように、静的な文字列としては `force` の並びが現れないが実行時に展開される書き方は検知できない。同じ限界は `docs/.env` の判定にもある
- **綴りの揺れ**。`permissions` に残っている前方一致ルール(`firebase deploy` など)は、フラグ順序違いや末尾に来る形を拾えない。フックに寄せたものは除く。`permissions.deny` 側に残してある前方一致ルールは、フックが壊れたときのフォールバックとして意図的に併記している
- **git のエイリアス**。`.gitconfig` に `push` のエイリアス(例 `git p`)があると、`push` トークンが文字列に現れずフックをすり抜ける

穴が見つかったら塞ぐが、**この仕組みを理由に破壊的な操作を注意せず実行してよいことにはならない**。最終的な歯止めは [8章](#8-claudeがやらないこと)のルールそのもの。

### 回帰テスト

判定内容を変えたときは必ず流す。

```bash
bash .claude/hooks/run-dangerous-command-tests.sh
```

ケースは [.claude/hooks/dangerous-command-cases.txt](../.claude/hooks/dangerous-command-cases.txt) にあり、拒否側だけでなく**誤って拒否してはいけない側**(`git push -u origin feature/fire-fire-x0` のようにブランチ名へ `-f` を含むもの、`git push -n`、`npm run build -- --force`、`cat docs/development-workflow.md` など)も含めてある。テストスクリプトは `.claude/settings.json` からフック本体を取り出して実行するので、判定ロジックの二重管理は起きない。

## 9. 前提と制約

- ブランチ保護は有効にできない(このプランの非公開リポジトリのため)。CIが赤でもマージボタンは押せてしまうので、CI3ジョブは**慣例として必須**とみなす
- claude-review は `main` 上のワークフローファイルと一致するときだけ実際に動く。編集しても `main` に載るまで効かないので、レビューコメントを待つ側は「ボットが動いていない」ケースを空振りせずに判定すること(`gh run list --workflow claude-review.yml --branch <ブランチ>` で実行有無を確認する)
- claude-review は必須チェックではない。コメントを投稿するだけでマージをブロックしない
