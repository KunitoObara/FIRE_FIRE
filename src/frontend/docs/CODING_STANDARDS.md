# フロントエンド コーディング規約

対象: `src/frontend`(TypeScript + Next.js)

技術スタックの選定理由は [TECH_STACK.md](TECH_STACK.md)、UI/デザインの方針は [DESIGN.md](../../../DESIGN.md) を参照。本ファイルは「何を選んだか」ではなく「どう書くか」を扱う。

ベースは [Airbnb JavaScript/TypeScript Style Guide](https://github.com/airbnb/javascript) とNext.js公式ドキュメントが推奨する規約に準拠し、本プロジェクト固有の判断が必要な箇所のみ明記する。ここに書いていない事項はESLint(Airbnb系設定 + `eslint-config-next`)のルールに従う。

## 1. TypeScript

- **strictモードを有効にする**(`tsconfig.json`の`strict: true`)。型の緩さに頼った実装は資産・金融データを扱う本アプリでは事故につながりやすい
- **`any`を使わない**。型が不明な外部入力(CSVパース結果、Firestoreから取得した生データ)は`unknown`で受け、zodスキーマでパースしてから型を確定させる
- **型宣言は`interface`を使わず`type`で書く**。オブジェクトの形も`type`で宣言する。宣言のマージを意図せず許してしまう`interface`を避け、宣言方法を1つに絞って一貫させるため。ESLintの`@typescript-eslint/consistent-type-definitions`で強制する
- **`enum`は使わずユニオン型のリテラルを使う**(例: `type RiskLevel = "low" | "medium" | "high"`)。`enum`はJavaScript出力に副作用があり、Tree Shakingとの相性も悪いため
- **非null断言(`!`)を避ける**。型を狭めたい場合はガード関数や早期returnで明示的に絞り込む
- **exportする関数・コンポーネントの戻り値型は明示する**。推論に任せると意図しない型の広がりに気づきにくい

### 型定義の置き場所(`src/types`)

- **型定義は実装ファイルに書かず、`src/types`配下の`.d.ts`にドメインごとに分けて置く**(例: `src/types/auth.d.ts`、`src/types/password.d.ts`)。コンポーネントのPropsも同様に、対応するドメインのファイルに置く
- **`declare global`でグローバルに公開し、利用側では`import`しない**(アンビエント宣言)。`tsconfig.json`の`include`が`**/*.ts`を拾うため、ファイルを置くだけで全体から参照できる
- **`.d.ts`の先頭には`export {}`か、必要な`import type`を必ず置く**。importを持たない`.d.ts`はグローバルスクリプトとして扱われ、`declare global`が構文エラーになるため、モジュール化してから`declare global`で包む

  ```ts
  // src/types/password.d.ts — 外部の型を参照しない場合
  export {};

  declare global {
    type PasswordRuleId = "length" | "letter-case" | "digit" | "symbol";
  }
  ```

  ```ts
  // src/types/auth.d.ts — 外部の型を参照する場合(importがあるので export {} は不要)
  import type { z } from "zod";

  import type { signupSchema } from "@/schemas/signup";

  declare global {
    type SignupFormValues = z.infer<typeof signupSchema>;
  }
  ```

- **グローバル名前空間を共有するため、型名はドメイン接頭辞を付けて衝突を避ける**(例: `SignUpResult`・`PasswordRule`のように何の型か分かる名前にし、`Result`や`Props`のような汎用名は使わない)
- **zodスキーマから導出できる型は`z.infer`で導出する**(6章と同じ方針)。`src/types`に移す際も同じ形を手で書き直さない

## 2. React / Next.js

- **関数コンポーネントのみを使う**。クラスコンポーネントは使わない
- **Server Componentsをデフォルトとし、`"use client"`は本当に必要な場合(state・effect・イベントハンドラ・ブラウザ専用API)のみ付与する**。TECH_STACK.md 1章のとおり、重い処理はできる限りサーバー側(Server Components/Server Actions)に寄せる。ただしB2のCSV取込はブラウザ側で完結させている(理由は下のミューテーションの項)
- **Propsの型はコンポーネント名 + `Props`** で定義する(例: `DashboardCardProps`)。定義先は1章のとおり`src/types`配下のドメイン別ファイルで、コンポーネントのファイル内には書かない
- **共通コンポーネント・hooksはnamed export、Next.jsが要求するpage/layout/route handlerのみdefault export** とする。named exportの方がエディタでのリネーム・参照追跡が安全なため
- **Hooksのルールを厳守する**(条件分岐の中で呼ばない、依存配列を省略しない)。ESLintの`react-hooks/rules-of-hooks`・`react-hooks/exhaustive-deps`を警告放置しない
- **JSX内の条件レンダリングで`&&`を使う場合、左辺を明示的にbooleanへ変換する**。`count && <Badge />`のような書き方は`count`が`0`のときに`0`がそのまま描画されるバグを生むため、`count > 0 && <Badge />`のように比較演算子を使う
- **三項演算子で条件レンダリングするときは、描画する側を先に置く**(`条件 ? (中身) : null`)。`条件 === null ? null : (中身)`と書くと「何を描画するのか」が後ろに回り、条件と中身の対応が読み取りにくい
- **その判定は値の型で使い分ける**。**文字列・オブジェクトはtruthyで判定する**が、**数値は`!== null` / `!== undefined`と明示的に比較する**。`0`は正当な値でありながらfalsyなので、truthyで書くと0のときに表示ごと消える。上の`&&`の項と同じ落とし穴で、三項演算子でも同様に踏む
- **文字列の空判定を`=== ""` / `!== ""`と書かない**。空文字だけがfalsyな文字列なので、truthyでの判定と結果が変わらないうえ、条件が短いほど読み違えにくい。`if (filters.category)`、`{row.categoryMinor ? … : null}`、`query ? \`?${query}\` : PATH` のように書く
  - 例外は**空文字を「値が入っていない」以外の意味で扱うとき**。たとえばフォームの未入力と「意図的に空にした」を区別する場合は、その区別が読めるように明示的な比較を残してよい

  ```tsx
  // 文字列 — truthyでよい
  {saveError ? <p role="alert">{saveError}</p> : null}

  // 数値 — 0を描画したいので明示的に比較する
  {calculatedTarget !== null ? <strong>{formatJpy(calculatedTarget)}</strong> : null}
  ```
- **イベントハンドラは`handle`接頭辞**で命名する(例: `handleSubmit`, `handleCategoryChange`)。Props経由で渡すコールバックは`on`接頭辞(例: `onSave`)にする

### 関数はすべてアロー関数で書く

- **`function`宣言・関数式は使わず、`const` + アロー関数で書く**。宣言方法を1つに絞り、巻き上げ(hoisting)に依存した記述順序を生まないため。ESLintの`func-style`・`prefer-arrow-callback`で強制する
- **default exportが必要なpage/layoutも例外にしない**。`const` に代入してからファイル末尾で`export default`する

  ```tsx
  const SignupPage = (): JSX.Element => <SignupForm />;

  export default SignupPage;
  ```

- **shadcn/uiのCLIが生成する`src/components/ui/**`は対象外**。CLIが`function`宣言で出力し、再生成のたびに書き換わるベンダーコードのため、ESLint側でも`func-style`を無効化している
  - **これはlintの適用範囲についての話で、「手を入れてはいけない」という意味ではない。** 実際に `button.tsx` / `input.tsx` / `card.tsx` / `input-otp.tsx` / `alert.tsx` は寸法と配色をHTMLモックに合わせて取り直してあり、`sonner.tsx` は `next-themes` への依存を外してある。いずれも**理由をファイル内のコメントに残す**運用で、詳細は [DESIGN.md](../../../DESIGN.md) 2章「`npx shadcn add` で入れたコンポーネントは、そのままでは使わない」にある
  - **「再生成のたびに書き換わる」は裏を返せば、再生成すると手を入れた分が消えるということでもある。** 既存のコンポーネントを `npx shadcn add` で入れ直さない

### SPA的な挙動を維持するためのルール(TECH_STACK.md 0章参照)

- **内部遷移は必ず`next/link`の`<Link>`を使う**。`<a href="...">`や`router.push`だけに頼った素朴なフルリロードは行わない。外部サイトへのリンクのみ`<a>`でよい
- **ミューテーション(保存・削除・CSV取込実行等)はServer Actionsを第一候補にする**。自作のRoute Handler + `fetch`は、Server Actionsで表現できない場合(外部Webhook受信等)にのみ使う
  - **ただしFirestoreへの書き込みは現状クライアントSDKから直接行う**。認証状態をブラウザ側のFirebase SDKが持っており、サーバー側セッション(Cookie)を置いていないため、Server Actionからは書き込み先の`uid`を特定できない。保護は`firestore.rules`のユーザー単位の判定で行う(要件定義書5章の方針そのもの)。実例: `src/lib/csv-import/asset-balance-repository.ts`(B2 CSV取込)
  - この制約を外すには、IDトークンをセッションCookieに載せてServer Action側でAdmin SDKに検証させる必要がある。導入するかは9章のオープン課題とする
- **Server Actionの呼び出し側では`useActionState`でpending/エラー状態を扱う**。手動で`isLoading`のようなstateを都度定義しない
- **サーバー専用処理を前提にしたブラウザ専用の外部ライブラリ(QRコード表示・チャート描画等)は`next/dynamic`で`ssr: false`指定して読み込む**。Server Componentからの直接importでビルドエラーになるのを防ぐ
- **共有・ブックマーク可能であるべき表示状態(ダッシュボードの分類軸・期間フィルタ等)は`useSearchParams`でURLに持たせる**。コンポーネントのローカルstateだけに閉じ込めると、リンク共有やブラウザの戻る/進むで表示が再現できなくなる。URLに載せる必要のない一時的な状態のみZustandを使う(TECH_STACK.md 3章)

## 3. 定数の置き場所(`src/constants`)

- **モジュールスコープの定数は実装ファイルに書かず、`src/constants`配下にドメインごとに分けて置く**(例: `src/constants/password.ts`、`src/constants/auth.ts`、`src/constants/routes.ts`)
- **画面のパスもここに集約する**(`src/constants/routes.ts`)。遷移先の文字列をコンポーネント内に直接書かない。画面IDとの対応をコメントで残す
- **要件由来の閾値・ポリシー・固定文言は必ず定数化する**(例: `PASSWORD_MIN_LENGTH`、`DEFAULT_WITHDRAWAL_RATE`)。要件が変わったときの変更箇所を1つにするため
- **判定ロジックを持つ定数もここに置いてよい**。パスワードポリシーのように「閾値 + 判定関数 + 表示文言」が一体で意味を持つものは、バリデーションと画面表示が同じ定義を参照できるよう1つの定数にまとめる(実例: `src/constants/password.ts`の`PASSWORD_RULES`)
- **定数の型は`src/types`側に置く**。`src/constants`は値だけを持つ

## 4. 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| コンポーネントファイル | PascalCase | `DashboardCard.tsx` |
| コンポーネント以外のファイル(hooks・utils等) | kebab-case | `use-fire-projection.ts` |
| 型定義ファイル | kebab-case + `.d.ts`(ドメイン名) | `src/types/auth.d.ts` |
| 定数ファイル | kebab-case(ドメイン名) | `src/constants/password.ts` |
| 変数・関数 | camelCase | `calculateAchievementRate` |
| 型・コンポーネント名 | PascalCase | `FireGoalFormProps` |
| 定数(モジュールスコープの不変値) | UPPER_SNAKE_CASE | `DEFAULT_WITHDRAWAL_RATE` |
| Zustandストア | `use` + 名詞 + `Store` | `useDashboardFilterStore` |

## 5. import順序

1. 外部パッケージ(react, next, firebase等)
2. 内部の絶対パス import(`@/components/...`, `@/lib/...`)
3. 相対パスimport(`./`, `../`)
4. 型のみのimport(`import type { ... }`)は各グループ内で通常のimportの後に置く

グループ間は空行で区切る。並び順はESLintの`import/order`で強制し、手動で揃えない。

`src/types`の型は1章のとおりアンビエント宣言のため`import`しない。ここでの`import type`は、外部ライブラリの型(`import type { Metadata } from "next"`等)を参照する場合のものである。

## 6. スタイリング

- Tailwindのクラス名は`prettier-plugin-tailwindcss`で並び順を自動整形する(手動で並び順を気にしない)
- 条件付きクラス名は文字列結合やテンプレートリテラルではなく`clsx`(または`cn`ヘルパー)を使う
- 独自のインラインCSS(`style`属性)は使わない。Tailwindのユーティリティで表現できない場合のみ、コンポーネント単位のCSSモジュールを検討する
- **CSSモジュールで`@property`を宣言するときは、名前にコンポーネント名を含める**(例: `CategoryBreakdownChart.module.css`の`--category-breakdown-sweep`)。`@property`はCSSモジュールの中に書いてもスコープを持たず**グローバルに登録される**ため、別のコンポーネントが同じ名前で再宣言すると、後から読み込まれた方の`syntax` / `initial-value`で上書きされる。lint・型検査・テストのいずれでも検出できず、宣言が1つしか無いうちは実害も出ないので、2つ目を足すときに気付けるよう名前で避ける。クラス名と`@keyframes`はCSSモジュールがスコープを付けるので、この配慮が要るのはカスタムプロパティだけ

## 7. フォーム・バリデーション

- DESIGN.md 6章で定義したとおり、インラインバリデーションが要求される画面はreact-hook-form + zodで実装する
- zodスキーマはコンポーネントの外(`src/schemas/`)に定義する。スキーマから導出する型は`src/types`側で`z.infer`を使って宣言し、Props/State用に同じ形の型を手で再定義しない

## 8. Lint / Format運用

- ESLint・Prettierの警告は放置せずコミット前に解消する(`eslint-config-next` + Airbnb系ルールの併用時に競合するルールがあれば、Next.js側の推奨設定を優先する)
- コミット前フック(husky + lint-staged等)の導入は9章のオープン課題とする。個人開発規模のため必須にはしないが、導入すればlintの押し付け忘れを防げる

## 9. 今後の検討事項(オープン課題)

- コミット前フック(husky + lint-staged)導入の要否
- セッションCookieを導入してFirestoreへの書き込みをServer Actionsに寄せるかどうか(2章)。導入すればミューテーションの方針を1つに揃えられるが、IDトークンの受け渡し・失効・Admin SDKでの検証を自前で持つことになる
- Airbnb設定とNext.js標準設定(`eslint-config-next`)の間でルールが競合した場合の優先順位の細部(現状はNext.js側を優先する方針のみ決定)
- アンビエント宣言(1章)の運用範囲。型の定義元がコード上で追えず、名前空間もプロジェクト全体で共有されるため、ドメインが増えたときに型名の衝突・肥大化が起きないか様子を見る。問題が出た場合は`src/types`を通常のモジュール(`export type` + `import type`)に切り替えることを検討する
