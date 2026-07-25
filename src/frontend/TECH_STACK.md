# フロントエンド技術スタック

対象: `src/frontend`(Vite + ReactによるSPA)

UI層のライブラリ選定・カラー/レイアウト方針は [DESIGN.md](../../DESIGN.md) を参照。本ファイルはそれ以外(言語・データ取得・テスト・デプロイ)を含めた技術スタック全体を定義する。DESIGN.mdと内容を重複させない。

## 0. アプリ形態

このアプリはSPA(Single Page Application)として構築する。個人利用・ログイン後利用が前提でSEO要件がなく、SSR/SSGの必要性がないため、サーバーサイドレンダリングを行うフレームワーク(Next.js等)ではなく、クライアントサイドのみで完結する構成を採る。画面遷移・データ取得はすべてブラウザ内で行い、サーバー側の処理はCloud Functions(`src/backend`、CSVパース・ログイン通知等)に限定する。

## 1. 言語・ビルド・ルーティング

- **TypeScript**: shadcn/ui・zod・Firebase SDKいずれも型定義が充実しており、フロント/バックエンド間で型を共有しやすいため採用
- **Vite**: SPAのビルドツール。開発サーバー起動・HMRが高速で、SSR前提のフレームワークが持つ制約(Server Components専用API等)を持ち込まない
- **React Router(react-router-dom)**: クライアントサイドルーティング。画面一覧(docs/screen-list-and-transitions.md)の画面ID(A1〜A7, B1〜B10)にルートを対応させる
- **npm**: パッケージ管理。Node.jsに標準同梱で追加インストール不要
- **Volta**: Node.js(および npm)のバージョン切り替え・固定に使用する。`package.json`の`volta`フィールドにバージョンを記載し、`src/frontend`ディレクトリに入った際に自動でそのバージョンへ切り替わるようにする

## 2. UI層

Tailwind CSS / shadcn/ui およびその周辺ライブラリ(フォーム・チャート・データテーブル等)の選定理由は [DESIGN.md](../../DESIGN.md) 2章・6章・7章を参照。

## 3. データ取得・状態管理

- **firebase**(クライアントSDK): Auth/Firestore/Storageへのアクセス
- **TanStack Query**: Firestoreの購読(`onSnapshot`)・取得処理をラップし、キャッシュ・再検証・ローディング状態を統一的に扱う。画面ごとに`useEffect`+`onSnapshot`を個別実装すると、ダッシュボード(B1)のように複数ウィジェットが同じデータを参照する画面で不整合が起きやすいため
- **Zustand**: サーバー状態(Firestoreデータ)以外の、複数コンポーネント・複数ルートにまたがるクライアント状態を扱う。例: ログインの一次認証〜2FA検証(A4→A5)間で引き継ぐ一時状態、ダッシュボード(B1)の分類軸・期間セレクタのように複数ウィジェットで共有するフィルタ状態、サイドバーの開閉状態など。単一コンポーネント内で完結する状態はReact標準のstate/contextで足り、Zustandに寄せない

状態の置き場所は「サーバー由来のデータ = TanStack Query」「複数コンポーネントにまたがるクライアント状態 = Zustand」「単一コンポーネント内のUI状態 = useState/Context」の3層で判断する。

## 4. フォント

- **@fontsource/noto-sans-jp**等のセルフホスト型webフォントパッケージで配信(DESIGN.md 4章と同じ方針)。SPAのためNext.jsの`next/font`のようなビルド時最適化機構がなく、フォントファイルをnpm経由で同梱しCSSで読み込む方式にする

## 5. テスト(ユニットのみ)

- **Vitest**: ユニットテストランナー。特にFIRE達成度・到達予測の計算ロジック([fire-calc-verify](../../.claude/skills/fire-calc-verify/SKILL.md)スキルで検証する対象)を優先的にカバーする
- **React Testing Library**: コンポーネントの最小限の振る舞いテスト
- E2Eテストは現時点では導入しない(8章オープン課題)

## 6. Lint / Format

- ESLint(`typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`。Viteの公式Reactテンプレートが標準で使う構成)
- Prettier

## 7. デプロイ

- **Firebase Hosting**: ビルド成果物(静的ファイル一式)をそのままホスティングする。SPAのため、存在しないパスへのリクエストは全て`index.html`へリライトする設定(`firebase.json`の`rewrites`)を行い、クライアントサイドルーティング(React Router)に処理を渡す
- 環境変数(Firebase設定値等)は`.env.local`で管理し、リポジトリにはコミットしない(既存の`.gitignore`で除外済み)

## 8. ディレクトリ構成の方針

- `src/frontend`配下は独立した`package.json`を持つVite + Reactプロジェクトとする。モノレポツール(npm workspaces等)は現時点では導入しない。フロント/バックエンドの依存関係が今のところ薄く、個別管理の方がシンプルなため
- 型やzodスキーマをフロント/バックエンドで共有したくなった場合は、その時点でworkspaces化を検討する(8章オープン課題)

## 9. 今後の検討事項(オープン課題)

- E2Eテスト(Playwright等)導入の要否とタイミング
- フロント/バックエンド間の型・バリデーションスキーマ共有(npm workspaces化)の要否
