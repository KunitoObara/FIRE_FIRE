---
name: screen-spec-drift-check
description: Cross-checks implemented frontend screens/pages against the screen requirements docs (docs/screen-list-and-transitions.md and docs/screen-requirements-*.md) — screen IDs A0-A12 and B1-B11 (B12-B17 are specified but unimplemented, and are not reported as drift), their listed display/input fields, and their transition conditions. Use this skill after implementing or modifying a page/route under src/frontend, or when the user asks whether a screen "matches the spec" or is "done" — proactively run it once real page components exist, since drift is easy to miss without an explicit diff against the docs.
---

# 画面要件⇔実装の整合性チェック

## なぜこのスキルが必要か

docs/screen-list-and-transitions.md と各 docs/screen-requirements-*.md は、画面ID(A0〜A12, B1〜B17。うち実装済みは A0〜A12 と B1〜B11)ごとに表示項目・入力項目・主な操作・遷移条件を細かく定義している。画面実装が積み上がるにつれて、要件定義書の更新漏れや実装側の解釈違いによる乖離が起きやすい。このスキルは実装後に定期的に差分を検出するためのものであり、実装前の設計フェーズでは単に要件定義書を読めばよい。

## ルートと画面IDの対応

**この表がこのリポジトリでの正本**。ディレクトリ名は機能名で、画面IDそのものではない。[`card-split`](../card-split/SKILL.md) の B-1(触る画面IDを数える手順)もここを引く。

ルートは `src/frontend/src/app/`、コンポーネントは `src/frontend/src/components/` からの相対で書いてある。

| 画面ID | ルート | コンポーネント |
|---|---|---|
| A0 サービストップページ | `(public)`(`/`) | `components/public/` |
| A9 利用規約 | `(public)/terms` | 同上 |
| A10 プライバシーポリシー | `(public)/privacy` | 同上 |
| A11 お問い合わせ | `(public)/contact` | 同上 |
| A12 ヘルプ | `(public)/help` | 同上 |
| A1 サインアップ | `(auth)/signup` | `components/auth/` |
| A2 メール確認待ち | `(auth)/verify-email` | 同上 |
| A3 2FA登録 | `(auth)/mfa-setup` | 同上 |
| A4 ログイン | `(auth)/login` | 同上 |
| A5 2FA検証 | `(auth)/mfa-verify` | 同上 |
| A6 パスワードをお忘れの方 | `(auth)/forgot-password` | 同上 |
| A7 パスワード再設定 | `(auth)/reset-password` | 同上 |
| A8 アカウント連携 | `(auth)/link-account` | 同上 |
| (画面IDなし) | `(auth)/auth/action` | Firebaseのメールリンクの受け口。`mode` でA7へ振り分ける |
| B1 ダッシュボード | `(dashboard)/dashboard` | `components/dashboard/` |
| B2 CSV取込 | `(dashboard)/csv-import` | `components/csv-import/` |
| B3 収支明細一覧 | `(dashboard)/transactions` | `components/transactions/` |
| B4 資産分類マスタ | `(dashboard)/asset-categories` | `components/asset-categories/` |
| B5 不動産一覧 | `(dashboard)/real-estate` | `components/real-estate/` |
| B6 不動産詳細 | `(dashboard)/real-estate/[id]` | 同上 |
| B7 不動産登録・編集 | `(dashboard)/real-estate/new`、`(dashboard)/real-estate/[id]/edit` | 同上 |
| B8 FIRE目標設定 | `(dashboard)/fire-goal` | `components/fire-goal/` |
| B9 想定利回り・リスク設定 | `(dashboard)/assumptions` | `components/assumptions/` |
| B10 アカウント設定 | `(dashboard)/account` | `components/account/` |
| B11 負債入力 | `(dashboard)/debts` | `components/debts/` |

`real-estate` のように**1つのディレクトリが複数の画面IDに対応する**ことがあるので、ディレクトリ数を画面IDの数として数えない。画面を増やしたらこの表も足す。

### B12〜B17 は表に無い(未実装)

**Phase 5〜7の画面(B12〜B17)は、ルートもコンポーネントもまだ存在しない。** 要件だけが先に決まっている状態で、B12〜B14は docs/screen-requirements-lists.md に、B15〜B17は docs/screen-list-and-transitions.md 2.8に概要だけがある。

**公開画面(A0・A9・A10・A11・A12)は5画面とも実装済みで、上の表に入っている**([A0](https://trello.com/c/BT4yT3Zk)、A11は [X6](https://trello.com/c/fYjMjcBS)、A12は [X2](https://trello.com/c/tgP5d1Ue))。要件との乖離は報告する。`(setup-check)` のプレースホルダーはA0の実装とともに削除され、`/` はA0が応答する。

- **「実装が無い」ことを差分として報告しない。** このスキルが見るのは実装済み画面と要件の乖離であり、未着手を毎回並べても判断の材料にならない
- 実装が入った時点で上の表に足し、そこから対象に入る
- 逆に、**これらのルートが実装されているのに表に無い場合は報告する。** 表を足し忘れた状態であり、以後このスキルがその画面を素通りするため

### `global-error.tsx` は対象外

`src/frontend/src/app/global-error.tsx` は利用者に見える画面だが、**画面IDを持たず、ルートも持たない**(docs/screen-list-and-transitions.md 2.6)。ルートレイアウトごと巻き込んだ描画エラーの受け皿で、公開画面・認証系・ログイン後のどこでも出るため、A0〜A12・B1〜B17のどれとも並列にならない。

**「画面一覧に無い画面が実装されている」として報告しない。** 上の「ルートが実装されているのに表に無い場合は報告する」に当てはまるように見えるが、あちらは画面IDを持つ画面の登録漏れを拾う規定である。

見た目が[DESIGN.md](../../../DESIGN.md)の体裁に揃っていない点も**乖離として報告しない。** 共通コンポーネントを経由すると、その経路自体が壊れている場合に画面ごと出せなくなるため、素の要素だけで組むことを2.6が要件として定めている。

### 要件に **【未実装 — カード】** と添えてある項目は報告しない

**実装済みの画面に、未着手のカードで入る仕様が先に書かれていることがある。** 要件だけが先に決まった状態で、実装が無いのは想定どおりである。

- **現在該当する項目は無い。** 直近の例は「承認されていないメールアドレス」のエラー表示(A1・A4)で、[X5](https://trello.com/c/5k33KGEY) の実装とともに注記を外した
- **カードがマージされたら注記を消す。** 消し忘れると、今度は実装済みの仕様がこのスキルの対象から外れたままになる
- 注記が無いのに実装が無い場合は、これまでどおり差分として報告する

## チェック手順

1. 対象の画面IDを上の表から特定する。
2. 該当する要件定義書のセクションを読む。
   - 認証系(A1〜A8) → docs/auth-login-requirements.md 4章、docs/screen-requirements-auth.md
   - ダッシュボード・データ管理系(B1〜B4、B11) → docs/screen-requirements-dashboard.md
   - 不動産管理系(B5〜B7) → docs/screen-requirements-real-estate.md
   - FIRE目標・シミュレーション系(B8〜B9) → docs/screen-requirements-fire-goal.md
   - アカウント系(B10) → docs/screen-requirements-account.md
   - リスト管理系(B12〜B14。**Phase 5・未実装**) → docs/screen-requirements-lists.md
   - 公開画面(A0・A9・A10・A11・A12。**フェーズ外・実装済み**) → docs/screen-requirements-public.md
   - 画面遷移条件の全体像 → docs/screen-list-and-transitions.md 3章(Mermaid図)
3. 表示項目・入力項目が実装コンポーネントに揃っているか照合する。抜けている項目、要件にない項目が追加されている場合は両方を報告する(要件更新漏れの可能性もあるため、「実装が間違っている」と決めつけない)。
4. 遷移条件(ボタン押下でどの画面に遷移するか)をMermaid図と照合する。特にエラー系の遷移(パース失敗時に画面に留まる、等)は見落とされがちなので注意する。
5. 差分が見つかった場合、それが実装漏れなのか、要件定義書側の更新が必要な仕様変更なのかをユーザーに確認する。無断でどちらかを正としてコードや要件定義書を書き換えない。

## 出力

画面IDごとに「一致」「差分あり(詳細)」を一覧で報告する。
