# フロントエンド コーディング規約

対象: `src/frontend`(TypeScript + Next.js)

技術スタックの選定理由は [TECH_STACK.md](TECH_STACK.md)、UI/デザインの方針は [DESIGN.md](../../../DESIGN.md) を参照。本ファイルは「何を選んだか」ではなく「どう書くか」を扱う。

ベースは [Airbnb JavaScript/TypeScript Style Guide](https://github.com/airbnb/javascript) とNext.js公式ドキュメントが推奨する規約に準拠し、本プロジェクト固有の判断が必要な箇所のみ明記する。ここに書いていない事項はESLint(Airbnb系設定 + `eslint-config-next`)のルールに従う。

## 1. TypeScript

- **strictモードを有効にする**(`tsconfig.json`の`strict: true`)。型の緩さに頼った実装は資産・金融データを扱う本アプリでは事故につながりやすい
- **`any`を使わない**。型が不明な外部入力(CSVパース結果、Firestoreから取得した生データ)は`unknown`で受け、zodスキーマでパースしてから型を確定させる
- **オブジェクトの形は`interface`、それ以外(ユニオン型・関数型・ユーティリティ型)は`type`** を使う。両方使える場面ではプロジェクト内で一貫性を優先する
- **`enum`は使わずユニオン型のリテラルを使う**(例: `type RiskLevel = "low" | "medium" | "high"`)。`enum`はJavaScript出力に副作用があり、Tree Shakingとの相性も悪いため
- **非null断言(`!`)を避ける**。型を狭めたい場合はガード関数や早期returnで明示的に絞り込む
- **exportする関数・コンポーネントの戻り値型は明示する**。推論に任せると意図しない型の広がりに気づきにくい

## 2. React / Next.js

- **関数コンポーネントのみを使う**。クラスコンポーネントは使わない
- **Server Componentsをデフォルトとし、`"use client"`は本当に必要な場合(state・effect・イベントハンドラ・ブラウザ専用API)のみ付与する**。TECH_STACK.md 1章のとおり、CSV取込のような重い処理はできる限りサーバー側(Server Components/Server Actions)に寄せる
- **Propsの型はコンポーネント名 + `Props`** で定義する(例: `DashboardCardProps`)。子コンポーネントに閉じたPropsは同一ファイル内、複数箇所で使う型は`types/`に置く
- **共通コンポーネント・hooksはnamed export、Next.jsが要求するpage/layout/route handlerのみdefault export** とする。named exportの方がエディタでのリネーム・参照追跡が安全なため
- **Hooksのルールを厳守する**(条件分岐の中で呼ばない、依存配列を省略しない)。ESLintの`react-hooks/rules-of-hooks`・`react-hooks/exhaustive-deps`を警告放置しない
- **JSX内の条件レンダリングで`&&`を使う場合、左辺を明示的にbooleanへ変換する**。`count && <Badge />`のような書き方は`count`が`0`のときに`0`がそのまま描画されるバグを生むため、`count > 0 && <Badge />`のように比較演算子を使う
- **イベントハンドラは`handle`接頭辞**で命名する(例: `handleSubmit`, `handleCategoryChange`)。Props経由で渡すコールバックは`on`接頭辞(例: `onSave`)にする

### SPA的な挙動を維持するためのルール(TECH_STACK.md 0章参照)

- **内部遷移は必ず`next/link`の`<Link>`を使う**。`<a href="...">`や`router.push`だけに頼った素朴なフルリロードは行わない。外部サイトへのリンクのみ`<a>`でよい
- **ミューテーション(保存・削除・CSV取込実行等)はServer Actionsを第一候補にする**。自作のRoute Handler + `fetch`は、Server Actionsで表現できない場合(外部Webhook受信等)にのみ使う
- **Server Actionの呼び出し側では`useActionState`でpending/エラー状態を扱う**。手動で`isLoading`のようなstateを都度定義しない
- **サーバー専用処理を前提にしたブラウザ専用の外部ライブラリ(QRコード表示・チャート描画等)は`next/dynamic`で`ssr: false`指定して読み込む**。Server Componentからの直接importでビルドエラーになるのを防ぐ
- **共有・ブックマーク可能であるべき表示状態(ダッシュボードの分類軸・期間フィルタ等)は`useSearchParams`でURLに持たせる**。コンポーネントのローカルstateだけに閉じ込めると、リンク共有やブラウザの戻る/進むで表示が再現できなくなる。URLに載せる必要のない一時的な状態のみZustandを使う(TECH_STACK.md 3章)

## 3. 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| コンポーネントファイル | PascalCase | `DashboardCard.tsx` |
| コンポーネント以外のファイル(hooks・utils等) | kebab-case | `use-fire-projection.ts` |
| 変数・関数 | camelCase | `calculateAchievementRate` |
| 型・インターフェース・コンポーネント名 | PascalCase | `FireGoalFormProps` |
| 定数(モジュールスコープの不変値) | UPPER_SNAKE_CASE | `DEFAULT_WITHDRAWAL_RATE` |
| Zustandストア | `use` + 名詞 + `Store` | `useDashboardFilterStore` |

## 4. import順序

1. 外部パッケージ(react, next, firebase等)
2. 内部の絶対パス import(`@/components/...`, `@/lib/...`)
3. 相対パスimport(`./`, `../`)
4. 型のみのimport(`import type { ... }`)は各グループ内で通常のimportの後に置く

グループ間は空行で区切る。並び順はESLintの`import/order`で強制し、手動で揃えない。

## 5. スタイリング

- Tailwindのクラス名は`prettier-plugin-tailwindcss`で並び順を自動整形する(手動で並び順を気にしない)
- 条件付きクラス名は文字列結合やテンプレートリテラルではなく`clsx`(または`cn`ヘルパー)を使う
- 独自のインラインCSS(`style`属性)は使わない。Tailwindのユーティリティで表現できない場合のみ、コンポーネント単位のCSSモジュールを検討する

## 6. フォーム・バリデーション

- DESIGN.md 6章で定義したとおり、インラインバリデーションが要求される画面はreact-hook-form + zodで実装する
- zodスキーマはコンポーネントの外(同一ファイルの上部、または`schemas/`)に定義し、`z.infer`で型を導出する。Props/State用に同じ形の型を手で再定義しない

## 7. Lint / Format運用

- ESLint・Prettierの警告は放置せずコミット前に解消する(`eslint-config-next` + Airbnb系ルールの併用時に競合するルールがあれば、Next.js側の推奨設定を優先する)
- コミット前フック(husky + lint-staged等)の導入は8章のオープン課題とする。個人開発規模のため必須にはしないが、導入すればlintの押し付け忘れを防げる

## 8. 今後の検討事項(オープン課題)

- コミット前フック(husky + lint-staged)導入の要否
- Airbnb設定とNext.js標準設定(`eslint-config-next`)の間でルールが競合した場合の優先順位の細部(現状はNext.js側を優先する方針のみ決定)
