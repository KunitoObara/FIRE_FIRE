# フロントエンド技術スタック

対象: `src/frontend`(Next.jsアプリケーション)

UI層のライブラリ選定・カラー/レイアウト方針は [DESIGN.md](../../../DESIGN.md) を参照。本ファイルはそれ以外(言語・データ取得・テスト・デプロイ)を含めた技術スタック全体を定義する。DESIGN.mdと内容を重複させない。

## 0. SPAとしての構築方針

本アプリはNext.js(App Router)を使いつつ、[Next.js公式のSPA構築ガイド](https://nextjsjp.org/docs/app/guides/single-page-applications)に沿って挙動としてのSPA(画面遷移時にフルページリロードが発生せず、URLは変わるが体感的には単一ページアプリのように振る舞う)を実現する。`output: 'export'`による静的サイト化(サーバー機能を持たない構成)は採用しない — Server Components・Server Actions・Firebase App Hostingでのサーバー機能はそのまま活用する。

具体的には以下を徹底する。

- 画面内・画面間のリンクは常に`next/link`(`<Link>`)を使う。`<a>`タグや`window.location`での遷移はSPA的な高速遷移を壊すため使わない
- データ取得はできる限りServer Components/レイアウトに寄せ、クライアント側でのfetchウォーターフォールを避ける。クライアント側でしか成立しない取得(Firestoreのリアルタイム購読等)のみTanStack Queryを使う(3章)
- ミューテーション(保存・削除等)はRoute Handlersの自作より先にServer Actionsを検討する

## 1. 言語・ビルド・ルーティング

- **TypeScript**: shadcn/ui・zod・Firebase SDKいずれも型定義が充実しており、フロント/バックエンド間で型を共有しやすいため採用
- **Next.js(App Router)**: Server Components + Server Actionsを基本とし、重い処理をサーバー側に寄せられる。画面一覧(docs/screen-list-and-transitions.md)の画面ID(A1〜A8, B1〜B10)は`app`ディレクトリのルーティング規約に対応させる
  - **ただしB2のCSV取込は、パース・Firestoreへの書き込みともブラウザ側で行っている**(実装時に判明したズレ)。認証状態をブラウザのFirebase SDKが持っていてサーバー側セッションが無く、Server Actionからは書き込み先の`uid`を特定できないため。パースをブラウザ側に置いているのも、プレビューのために一度読む必要があり、サーバーへ送ってから確認させると同じファイルを2度送ることになるため。理由と今後の選択肢は [CODING_STANDARDS.md](CODING_STANDARDS.md) 2章・9章に記載
- **npm**: パッケージ管理。Node.jsに標準同梱で追加インストール不要
- **Volta**: Node.js(および npm)のバージョン切り替え・固定に使用する。`package.json`の`volta`フィールドにバージョンを記載し、`src/frontend`ディレクトリに入った際に自動でそのバージョンへ切り替わるようにする

## 2. UI層

Tailwind CSS / shadcn/ui およびその周辺ライブラリ(フォーム・チャート・データテーブル等)の選定理由は [DESIGN.md](../../../DESIGN.md) 2章・6章・7章を参照。

実装時に判明した、DESIGN.md 6章の記述と現行ライブラリのずれ:

- **shadcn/uiの`form`コンポーネントは廃止されており、`field`(`Field` / `FieldLabel` / `FieldError` 等)に置き換わっている**。`npx shadcn add form`は空の項目を返すだけで何も生成しない。react-hook-form + zodという組み合わせ自体は変わらないため、`field`のマークアップにreact-hook-formの`register` / `Controller`と`FieldError`の`errors`propsを組み合わせて使う(実装例: `src/components/auth/SignupForm.tsx`)
- **`@hookform/resolvers`は5.4.0に固定する**。5.5.x はoptional peerの依存関係(`@typeschema/valibot`が要求するvalibotのバージョン)が自身のpeer指定と矛盾しており、`npm install`が`ERESOLVE`で失敗する。上流が解決したら固定を外してよい

## 3. データ取得・状態管理

- **firebase**(クライアントSDK): Auth/Firestore/Storageへのアクセス
- **TanStack Query**: Firestoreの購読(`onSnapshot`)・取得処理をラップし、キャッシュ・再検証・ローディング状態を統一的に扱う。画面ごとに`useEffect`+`onSnapshot`を個別実装すると、ダッシュボード(B1)のように複数ウィジェットが同じデータを参照する画面で不整合が起きやすいため。0章のSPA構築ガイドでもReact Query(TanStack Query)はNext.jsのサーバー機能と併用できるハイブリッド構成として明示的に想定されており、方針と矛盾しない
- **Zustand**: サーバー状態(Firestoreデータ)・URLで表現すべき状態のどちらでもない、複数コンポーネント・複数ルートにまたがるクライアント状態を扱う。例: ログインの一次認証〜2FA検証(A4→A5)間で引き継ぐ一時状態、サイドバーの開閉状態など。単一コンポーネント内で完結する状態はReact標準のstate/contextで足り、Zustandに寄せない
- **URL検索パラメータ(`useSearchParams`)**: ダッシュボード(B1)の分類軸・期間セレクタのように、共有・ブックマーク可能であるべきフィルタ状態はZustandではなくURLに持たせる。0章のSPA構築ガイドが推奨する`usePathname`/`useSearchParams`と`next/link`の組み合わせにより、ブラウザの戻る/進むやリンク共有でも同じ表示状態を再現できる

状態の置き場所は「サーバー由来のデータ = TanStack Query」「共有・再現性が必要な表示状態 = URL検索パラメータ」「それ以外の複数コンポーネントにまたがるクライアント状態 = Zustand」「単一コンポーネント内のUI状態 = useState/Context」の4層で判断する。

## 4. フォント

- next/font経由でNoto Sans JP等を最適化配信(DESIGN.md 4章と同じ方針)

## 5. テスト(ユニットのみ)

- **Vitest**: ユニットテストランナー。特にFIRE達成度・到達予測の計算ロジック([fire-calc-verify](../../../.claude/skills/fire-calc-verify/SKILL.md)スキルで検証する対象)を優先的にカバーする
- **React Testing Library**: コンポーネントの最小限の振る舞いテスト
- E2Eテストは現時点では導入しない(8章オープン課題)

## 6. Lint / Format

- ESLint(Next.js標準の`eslint-config-next`をベース)
- Prettier

## 7. デプロイ

- **Firebase App Hosting**: Next.jsのSSRをFirebaseエコシステム内で動かす公式の仕組み。単純な静的ホスティング(Firebase Hosting単体)ではダッシュボードのようなログイン後の動的画面をSSRできないため採用
- 環境変数(Firebase設定値等)は`.env.local`で管理し、リポジトリにはコミットしない(既存の`.gitignore`で除外済み)

## 8. ディレクトリ構成の方針

- `src/frontend`配下は独立した`package.json`を持つNext.jsプロジェクトとする。モノレポツール(npm workspaces等)は現時点では導入しない。フロント/バックエンドの依存関係が今のところ薄く、個別管理の方がシンプルなため
- 型やzodスキーマをフロント/バックエンドで共有したくなった場合は、その時点でworkspaces化を検討する(8章オープン課題)

## 9. 今後の検討事項(オープン課題)

- E2Eテスト(Playwright等)導入の要否とタイミング
- フロント/バックエンド間の型・バリデーションスキーマ共有(npm workspaces化)の要否
