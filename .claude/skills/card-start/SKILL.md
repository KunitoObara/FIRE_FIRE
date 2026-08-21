---
name: card-start
description: Starts work on a card in the 進行中 (in progress) list of the FIRE-FIRE Trello board — syncs already-merged 確認中 (in review) cards to 完了 (done), picks an eligible card, reads the requirements docs and HTML mocks it references, asks every open question in one batch, and cuts the feature branch off develop. Use this skill when the user says "カードに着手", "次のカードを始めて", or "開発を始めて", or when invoked as /card-start.
---

# カード着手

[docs/development-workflow.md](../../../docs/development-workflow.md) が正本。**先に2〜5章を読む**(ボードとID・着手時に読むもの・質問のまとめ方・ブランチ規約と分割の要否)。リストID・ラベルID・着手条件・ブランチ名の規約はそこにある。文書全体を読む必要はない。

## 手順

### 1. 確認中カードのマージ同期

着手の前に、前回までのカードを片付ける。

1. 確認中リストのカードを取得する(`mcp__trello__get_cards_by_list_id`)
2. **カードのコメントを必ず読む**(`mcp__trello__get_card_comments`)。`/card-ship` はPRを出すたびにURLをコメントに残すので、**1枚のカードに複数のPRがぶら下がっていることがある**(PRを分割した場合。正本の文書 5章「PRの分割」)
3. **分割計画の有無を先に見る。** コメントに `分割計画: 全N本` の行があれば分割中のカード。複数あれば**いちばん新しいもの**を採る(計画は途中で変わりうる)
4. カードに紐づくPRを**すべて**特定する
   - コメントに残ったPRのURLを全部集める。これが基準
   - **PRのURLが1件も見つからない場合だけ**、カード名 `[B7] ...` → ブランチ `feature/fire-fire-b7` → `gh pr list --head feature/fire-fire-b7 --state all --json number,state,createdAt,mergedAt,url` で引く(フォールバック)
   - **判定するのはコメントの件数ではなくPR URLの抽出結果。** 「コメントが1件も無い場合だけ」にすると、`分割計画:` のコメントだけが付いていて `PR:` のコメントが漏れたカードでフォールバックが働かない。分割カードには計画のコメントが必ず付くので、その組み合わせは実際に起こる
5. **フォールバックで見つけたPRは、カードより後に作られたものだけ採る**(コメント由来のPRには要らない)
   - カードの作成日時は**TrelloのカードID(内部の `id`)から導ける**。IDはMongoDBのObjectIdで、先頭8桁(16進)がepoch秒
     ```bash
     python3 -c "
     import datetime, re, sys
     cid = sys.argv[1]
     if not re.fullmatch(r'[0-9a-f]{24}', cid):
         sys.exit('TrelloのカードID(24桁の16進)を渡すこと。[B7] のような表示上のIDではない')
     # datetime.UTC は3.11以降のエイリアス。timezone.utc なら3.2から動く
     print(datetime.datetime.fromtimestamp(int(cid[:8], 16), datetime.timezone.utc))
     " 6a7751a96c0eebb2a2d97faa
     ```
   - **渡すのは `mcp__trello__get_cards_by_list_id` / `get_card` が返す24桁の `id`。** カード名の `[B7]` や `[X0-8]` ではない。この文書の他の箇所(§2 の引数、§6 のブランチ名)で「カードID」と呼んでいるのは後者なので、ここだけ指すものが違う
   - **桁数の検査を外さない。** `B7` や `A8` や `B11` は**16進として妥当な文字列**なので、検査が無いと `int()` は例外を出さず1970年台の日時を返す。そうなるとすべてのPRが「カード作成より後」と判定され、**このガードがエラーも出さずに無効化される**(`X0-8` のように `-` を含むIDだけは `ValueError` で気づける)
   - **見るのは `createdAt`。`mergedAt` ではない。** カードが存在する前に作られたPRは、そのカードのものではありえない。`createdAt` がカード作成より**前**のPRは**捨てる**。捨てた結果0件になったらフォールバックは失敗
   - `mergedAt` で判定すると、**未マージ(open / closed)の古いPRが素通りする**。値が無いので「カード作成より前」に当てはまらず残り、手順6の「見つかったPRがすべて `MERGED`」を永久に満たせなくなる。カードは完了へ動かないまま毎回一覧に出続ける
6. **完了**リストへ移動してよいのは次を**すべて**満たすカードだけ(`mcp__trello__move_card`)
   - **PRが1件以上見つかっている**
   - 見つかったPRが**すべて** `MERGED`
   - 分割計画がある場合は、**PRの数が `全N本` の N に達している**
   - 移動したら、**そのカードのブランチ(`-partN`のスライスも含む)に対応するworktreeが残っていないか確認する**(`git worktree list`)。見つかれば片付ける
     ```bash
     git log <ブランチ名> --not origin/<ブランチ名> --oneline
     ```
     **何か出力されたら削除しない。** `git branch -D` は強制削除で、mergedかどうかを見ずに消す(squash mergeのため通常の `-d` は使えない)。出力があるということはpushされていないローカル限定のコミットが残っているということで、そのまま消すと**その内容を確認なしに失う**。出力が無ければ(=リモート追跡ブランチと同じ内容)、続けて片付ける。
     ```bash
     git worktree remove <worktreeのパス> && git branch -D <ブランチ名>
     ```
     **`&&` でつなぎ、`worktree remove` が失敗したら `branch -D` を実行しない。** worktreeがまだ実際に使われている(未コミットの変更が残っている)可能性があるため。`git worktree remove` は未コミットの変更が残っていると失敗する仕様で、**`--force` は付けない** — 失敗したらそのまま報告し、消してよいかをユーザーに確認する

     **`ExitWorktree` は使わない。** このツールは同一セッション内で `EnterWorktree` が作ったworktreeにしか効かず、別セッション(あるいは前回までの作業)が残したworktreeには効かない(no-op)。放置すると `.claude/worktrees/` に古いworktreeが `locked` のまま残り続ける([X23](https://trello.com/c/oYaYmzSN))
7. 満たさないカードは移動せず、レビュー状況とあわせて一覧で報告する

**「1件以上」を省かない。** 「すべて `MERGED`」は**PRが0件のときにも成立する**(空の集合に対する「すべて」は真)。PRのURLをコメントに残し忘れた、書式が違う、コメントごと消された、といったカードが、1本もマージされていないのに完了へ動く。

**フォールバックの作成日時のガードを省かない。** カードIDは再利用される。`[X0-8]` は「HTMLモックのパレットを揃える」カードで一度使われ、そのブランチ `feature/fire-fire-x0-8` とPR #79 が残ったまま、後日まったく別の「Skillsの精査」で同じIDが振られた。カード名からブランチ名を導くフォールバックは、この2枚を区別できない。**PRを1本も出していない新しいカードが、別カードのマージ済みPRを理由に完了へ動く。**

実際の値で確かめられる: PR #79 の `createdAt` は `2026-08-08T12:03:36Z`、新しい `[X0-8]`(ID `6a7751a96c0eebb2a2d97faa`)の作成は `2026-08-08T15:56:25Z`。PRのほうが**前**なので捨てられる。

**分割計画の本数に達していないカードを完了へ動かさない。** 分割したカードは1本目のPRを出した時点で確認中へ移り、2本目以降はまだPRになっていない。PRの状態だけを見ると「1本あって、それが済んでいる」ようにしか見えず、残りのスライスが手つかずのまま完了へ動く。

**計画の本数とPRの数が合わないまま止まっているカードは、放置せず報告する。** スライスの1本が取り込まれずに終わった場合など、どちらの条件にも当てはまらずカードが宙に浮く。判断はユーザーに委ね、勝手に動かさない。

移動した/しなかったカードを短く報告してから次に進む。1件も無ければ黙って次へ。

### 2. 着手対象カードの選定

進行中リストのカードを取得し、**「詳細設計・実装」または「テスト実装」のラベルが付いているもの**だけを対象にする(OR条件、ラベルIDは正本の文書を参照)。

- 対象が0件 → 「着手できるカードがない」と報告して終わる。ラベル条件を満たさないカードが進行中にある場合は、対象外として名前だけ挙げる
- 対象が1件 → そのカードで進む
- 対象が複数 → どれに着手するかユーザーに聞く(`AskUserQuestion`)

引数でカードIDや画面ID(`/card-start B8` など)が渡されている場合は、それに一致するカードを対象にする。

### 3. 要件の読み込み

着手カードについて次をすべて読む。読まずに実装を始めない。

1. `mcp__trello__get_card` — 説明文の全文(一覧APIの説明は省略されている)
2. `mcp__trello__get_checklist_items` — 受入条件のチェックリスト
3. `mcp__trello__get_card_comments` — 過去の判断や補足が入っていることがある
4. カード本文が参照している `docs/` 配下の要件定義書の該当セクション
5. カード本文に書かれた `src/frontend/docs/html_mock/*.html` のモック
6. `CLAUDE.md`、`DESIGN.md`、`src/frontend/docs/CODING_STANDARDS.md`
7. 既存の類似画面の実装(同じ系統の画面が実装済みなら、その構成に揃える)

### 4. 不明点をまとめて質問する

ここが唯一の質問タイミング。**1回にまとめて聞く**。実装を始めてから小出しに聞かない。

質問する / しないの線引きは正本の文書「4. 質問のまとめ方」に従う。要件定義書と既存コードから判断材料が揃うなら、質問せずそのまま次に進んでよい。無理に質問をひねり出さない。

質問は `AskUserQuestion` を使い、選択肢には**推奨案を先頭**に置いて理由を添える。

### 5. PRを分割するかを決める

**ブランチを切る前に決める。** 分割するとブランチ名が変わる(`feature/fire-fire-<id>-part1`)ので、先にブランチを切ってしまうと使わないブランチが残る。

カード本文の「このカードの範囲」が複数の層(土台 / 新規画面 / 既存画面への波及 / 表記・ドキュメント)にまたがる場合、`/card-split` のモードAで切る単位を決める。判断の目安は正本の文書 5章「PRの分割」。

実装後に分けるほうが常に高くつく。ここで数分使うほうが安い。

分けない判断になった場合は、その理由をPR本文の「レビューで見てほしい点」に書く。

### 6. 作業ブランチの作成

質問が解決し、分割の要否が決まってから作る。**メインの作業ツリーで**まず develop を最新にする(worktreeを使う場合もここは変わらない — base refがここでの状態に依存する)。

```bash
git status --short
git fetch origin
git checkout develop && git pull
```

作業ツリーに未コミットの変更があれば、先にユーザーに確認する。勝手に stash や破棄をしない。

**他に進行中のカードがあるか確認する。** 進行中リストに(これから着手するカード以外に)他のカードがある、または `git worktree list` にメイン以外のworktreeが存在するなら「あり」。

- **無ければ**、これまで通りメインの作業ツリーで直接ブランチを切る
  ```bash
  git checkout -b feature/fire-fire-<カードIDを小文字にしたもの>
  ```
- **あれば**、`EnterWorktree` でworktreeを切る(オプトイン。単独進行中では使わない — 正本の文書 5章、[X23](https://trello.com/c/oYaYmzSN))
  ```
  EnterWorktree({ name: "feature/fire-fire-<カードIDを小文字にしたもの>" })
  git branch -m feature/fire-fire-<カードIDを小文字にしたもの>
  ```
  `.claude/settings.json` の `worktree.baseRef: "head"` により、直前にpullしたメインツリーのローカル `develop` から分岐する。セッションの作業ディレクトリは自動でworktree側に切り替わるので、以降の実装・`/card-ship`・`/card-review` はそのまま続けてよい。

  **`git branch -m` は省略できない。** `EnterWorktree` はブランチ名を渡した `name` そのままにはせず、`worktree-` を前置し `/` を `+` に置換する(実測: `name: "feature/fire-fire-x23"` → ブランチ `worktree-feature+fire-fire-x23`)。渡した `name` どおりのディレクトリ・ブランチ名になるわけではないため、作成直後にリネームして規約(下記)へ揃える。worktreeの**ディレクトリ名**(`.claude/worktrees/` 配下)は `name` の `/` が `+` に置換されたものになり、これはリネームしない(ブランチ名と違い、他の手順から文字列一致で参照されない)

**分割する場合はここでブランチを切らない。** `/card-split` のA-4が1本目のスライス用に `feature/fire-fire-<カードID>-part1` を切る(worktreeを使う場合も同じ判断基準・同じ `name` の付け方で決める)。

### 7. 実装に入る

実装が終わったら `/card-ship` を使う、と最後に伝える。

## 実装中の姿勢

- 危険コマンド以外は確認を挟まず実行してよい(`.claude/settings.json` で `gh pr merge` / force push / `firebase deploy` / `rm -rf` は封じてある)
- カードのスコープを勝手に広げない。ついでに直したくなったものは、PR本文の「レビューで見てほしい点」に書くか、別カードとして提案する
- 要件定義書と実装が食い違うときは、どちらが正かをユーザーに確認する。無断でどちらかに寄せない
