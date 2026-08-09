# 禁止コマンドの歯止め

[development-workflow.md](./development-workflow.md) 8章「Claudeがやらないこと」を、設定でどう裏付けているかの詳細。**ルールそのものは8章が正本**で、この文書は実装(`.claude/settings.json` の `permissions` と `PreToolUse` フック)とその限界だけを扱う。

読む必要があるのは歯止めを**変えるとき**で、日々の開発フローを回すのに読む必要はない。8章から分けてあるのはそのため。

## 設定による裏付け

8章の禁止事項のうち機械的に判定できるものには [.claude/settings.json](../.claude/settings.json) で歯止めをかけてある。文書のルールだけに頼らないため。ただし**すべてを塞げているわけではない**(後述の「限界」)。

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

  **境界に `/` は含めない。** 含めると `cat docs/.env.example/../.env` のようにテンプレートをディレクトリに見立てて本体へ降りる形で、`docs/.env.example/` ごと除去されて判定対象から本体のパスが消え、素通りする(`docs/.env.example` が実際にディレクトリなら、この文字列は本体を指す)。境界として扱うのは空白・クォート・`&`・`;` のように**パスがそこで終わる**文字だけで、`/` は「まだ続く」文字として扱う。副作用として `ls docs/.env.example/` も拒否されるが、安全側に倒している。

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

## claude-review ジョブでだけ無効にしている

フックは `GITHUB_ACTIONS` と `CLAUDE_GUARD_DISABLE` の**両方**が設定されているときだけ何もせず終了する。`CLAUDE_GUARD_DISABLE` を渡しているのは [.github/workflows/claude-review.yml](../.github/workflows/claude-review.yml) の `review` ジョブだけ。

無効化する口が要るのは、**リポジトリにコミットした `.claude/settings.json` が、リポジトリをチェックアウトする他の Claude Code 実行にも読み込まれる**ため。実際に claude-review ジョブがこれで落ちた(PR #44)。同ジョブのSDKオプションは `settingSources: ["user", "project", "local"]` で project を含むので、このフックがレビュー実行にも適用される。レビュー本文で `docs/.env` や `git push --force` に**言及した**だけで、それを引数に持つ `gh pr comment` が拒否され、`permission_denials_count: 13` で失敗した。

このジョブで無効にして安全なのは、歯止めの対象がそこに存在しないから。

- `docs/.env` は `.gitignore` の `.env` / `.env.*` で除外されており、チェックアウトに含まれない
- claude-review の権限は `contents: read` で、そもそもpushできない

**`GITHUB_ACTIONS` だけを見る形にはしない。** その条件はジョブの権限を見ておらず、`develop` / `main` へのpushや自動修正コミットを行う書き込み権限つきのワークフローが将来 `settingSources` に project を含む形で走ると、そのジョブでも歯止めがまるごと消える。ワークフロー側で明示的に変数を渡す形にしてあるのは、**ワークフローを増やすたびに「この歯止めを外してよいか」を意識せざるを得なくするため**。歯止めを必要とする権限を持つワークフローには、この変数を渡してはならない。

**`CLAUDE_GUARD_DISABLE` だけを見る形にもしない。** シェルの初期化ファイルなどに残っていると、手元の実行でも歯止めが消えてしまう。AND にすればどちらの穴も塞げる。

**設定に新しい歯止めを足すときは、レビュージョブを巻き込まないかを必ず考えること。** リポジトリの設定ファイルはローカル専用ではない。

## 限界 — 「網羅している」前提で運用しない

これらの歯止めは**本人がうっかり実行するのを防ぐためのもの**で、回避しようとする相手を止める仕組みではない。以下は既知の抜け道であり、塞いでいない。

- **クォート分割・変数展開**。判定はコマンド文字列への正規表現一致なので、`git push origin main --for''ce` や `$(echo --force)` のように、静的な文字列としては `force` の並びが現れないが実行時に展開される書き方は検知できない。同じ限界は `docs/.env` の判定にもある
- **綴りの揺れ**。`permissions` に残っている前方一致ルール(`firebase deploy` など)は、フラグ順序違いや末尾に来る形を拾えない。フックに寄せたものは除く。`permissions.deny` 側に残してある前方一致ルールは、フックが壊れたときのフォールバックとして意図的に併記している
- **git のエイリアス**。`.gitconfig` に `push` のエイリアス(例 `git p`)があると、`push` トークンが文字列に現れずフックをすり抜ける

穴が見つかったら塞ぐが、**この仕組みを理由に破壊的な操作を注意せず実行してよいことにはならない**。最終的な歯止めは [development-workflow.md 8章](./development-workflow.md#8-claudeがやらないこと)のルールそのもの。

## 回帰テスト

判定内容を変えたときは必ず流す。

```bash
bash .claude/hooks/run-dangerous-command-tests.sh
```

**同じスクリプトを [ci.yml](../.github/workflows/ci.yml) の `hooks` ジョブが実行する。** 安全装置のテストを「変えたら流す」という運用ルールだけに預けると、流し忘れたまま遮断が壊れてマージされうるため。手元で流すのをやめてよいという意味ではない — CIで気づくのはPRを出したあとになる。

ジョブは依存のインストールをしない(`bash` / `jq` / `python3` / `grep` / `sed` だけで動く)。環境変数の細工も不要。スクリプトは判定ロジックを見るケースで `GITHUB_ACTIONS` と `CLAUDE_GUARD_DISABLE` を落としてからフックを呼ぶので、**結果は実行環境に依らない**(手元・`hooks` ジョブ・両変数が立った環境のいずれでも同じ115ケースが一致する)。無効化の条件そのものは `check_guard_env` が env を明示的に組み立てて検証しているので、**条件を変えるときはそのケースの期待値を更新する**。

判定ロジックのケースを環境から切り離してあるのは、テストが緑であることを「判定が正しい」と読めるようにするため。呼び出し元の環境しだいでフックが素通りする状態だと、期待DENYのケースが全滅して落ちる(黙って通りはしない)にせよ、原因の分かりにくい落ち方になる。

ケースは [.claude/hooks/dangerous-command-cases.txt](../.claude/hooks/dangerous-command-cases.txt) にあり、拒否側だけでなく**誤って拒否してはいけない側**(`git push -u origin feature/fire-fire-x0` のようにブランチ名へ `-f` を含むもの、`git push -n`、`npm run build -- --force`、`cat docs/development-workflow.md` など)も含めてある。テストスクリプトは `.claude/settings.json` からフック本体を取り出して実行するので、判定ロジックの二重管理は起きない。

無効化の条件も同じスクリプトが見ている。`GITHUB_ACTIONS` と `CLAUDE_GUARD_DISABLE` が揃ったときだけ素通りし、**片方だけ・空文字・どちらも無しでは歯止めが効いたまま**であることを、Bash 側と Grep / Glob / Read 側の両方のフックについて確かめる。
