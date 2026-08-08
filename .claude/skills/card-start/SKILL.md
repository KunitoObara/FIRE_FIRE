---
name: card-start
description: Starts work on a card in the 進行中 (in progress) list of the FIRE-FIRE Trello board — syncs already-merged 確認中 (in review) cards to 完了 (done), picks an eligible card, reads the requirements docs and HTML mocks it references, asks every open question in one batch, and cuts the feature branch off develop. Use this skill when the user says "カードに着手", "次のカードを始めて", or "開発を始めて", or when invoked as /card-start.
---

# カード着手

[docs/development-workflow.md](../../../docs/development-workflow.md) が正本。**まずこの文書を読む**。リストID・ラベルID・着手条件・ブランチ規約はすべてそこにある。

## 手順

### 1. 確認中カードのマージ同期

着手の前に、前回までのカードを片付ける。

1. 確認中リストのカードを取得する(`mcp__trello__get_cards_by_list_id`)
2. **カードのコメントを必ず読む**(`mcp__trello__get_card_comments`)。`/card-ship` はPRを出すたびにURLをコメントに残すので、**1枚のカードに複数のPRがぶら下がっていることがある**(PRを分割した場合。正本の文書 5章「PRの分割」)
3. カードに紐づくPRを**すべて**特定する
   - コメントに残ったPRのURLを全部集める。これが基準
   - コメントが1件も無い場合だけ、カード名 `[B7] ...` → ブランチ `feature/fire-fire-b7` → `gh pr list --head feature/fire-fire-b7 --state all --json number,state,mergedAt,url` で引く
4. **すべてのPRが `MERGED` のカードだけ**を**完了**リストへ移動する(`mcp__trello__move_card`)
5. 1つでも `OPEN` が残っているカードは移動せず、レビュー状況とあわせて一覧で報告する

**1本目がマージされただけで完了へ動かさない。** 分割したカードは残りのPRがまだレビュー中でありうる。カード名から引いたブランチだけを見ると、分割時のスライスは `-part<N>` が付いていて一致せず、コメント経由で見つけた1本目だけを根拠に動かしてしまう。

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

質問が解決し、分割の要否が決まってから作る。

```bash
git status --short
git fetch origin
git checkout develop && git pull
git checkout -b feature/fire-fire-<カードIDを小文字にしたもの>
```

**分割する場合はここでブランチを切らない。** `/card-split` のA-4が1本目のスライス用に `feature/fire-fire-<カードID>-part1` を切る。

作業ツリーに未コミットの変更があれば、先にユーザーに確認する。勝手に stash や破棄をしない。

### 7. 実装に入る

実装が終わったら `/card-ship` を使う、と最後に伝える。

## 実装中の姿勢

- 危険コマンド以外は確認を挟まず実行してよい(`.claude/settings.json` で `gh pr merge` / force push / `firebase deploy` / `rm -rf` は封じてある)
- カードのスコープを勝手に広げない。ついでに直したくなったものは、PR本文の「レビューで見てほしい点」に書くか、別カードとして提案する
- 要件定義書と実装が食い違うときは、どちらが正かをユーザーに確認する。無断でどちらかに寄せない
