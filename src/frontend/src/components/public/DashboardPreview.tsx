import type { JSX } from "react";

/**
 * A0のヒーローに置くB1ダッシュボードの画面イメージ
 * (docs/screen-requirements-public.md A0「画面イメージの扱い」)。
 *
 * **金額はすべて作り物の丸めた値である。** 公開リポジトリかつ本番配信のため、実データの
 * スクリーンショットは置けない(ルートの `CLAUDE.md`)。画像ではなくHTML/SVGで描いてあるのは、
 * B1が変わったときに画像だけが古くなるのを避けるためで、要件はどちらの実装も認めている。
 *
 * **B1に実在する要素だけで組む。** 縮尺に入らない要素(収支サマリ・負債サマリ・ツールチップ・
 * 年月選択)は落としてよいが、B1に無い形(数値カードを横に3枚並べる等)を新しく描かない —
 * 登録した人が最初に見る画面と食い違い、LPが約束したものと違うところに着地させることになる。
 *
 * **数字は1組で辻褄を合わせてある。**
 *
 * - 投資信託 30,000,000 + 現金・預金 12,000,000 + 株式 8,000,000 = 50,000,000円
 * - 負債 -20,000,000円 → 差引後 30,000,000円
 * - 円グラフの構成比の分母は絶対値の合計 70,000,000円(43 / 17 / 11 / 29%)
 * - **ゲージの対象分類は分類軸セレクタと同じ純金融資産に揃えてある**ので、現在資産額は
 *   差引後と同じ 30,000,000円、達成率は 30,000,000 / 80,000,000 = 37.5% → 38%
 *   (アーク長 106 / 283)
 *
 * 本物のB1モックはセレクタとゲージの対象分類が**違う**状態を示しているが、ここでは揃えてある。
 * LPの訪問者に「2つの軸は別の設定」という区別を読ませる前提を置けず、単に数字が食い違って
 * 見えるため。ただし**対象分類名の併記は落とさない**(揃えてあること自体が読み取れなくなる)。
 *
 * 色は資産分類スロット(`--chart-*`)と負債のハッチングをB1と同じ割り当てで使う。LP用に色を
 * 作らない(DESIGN.md 3章)。
 */
export const DashboardPreview = (): JSX.Element => (
  <div className="mx-auto mt-10 max-w-[52rem] overflow-hidden rounded-xl border bg-card text-left shadow-[0_20px_40px_-24px_rgb(0_0_0/0.35)]">
    {/* ブラウザの枠に見立てた飾り。中身が「画面のイメージ」だと分かるようにするためだけのもの */}
    <div className="flex items-center gap-1.5 border-b bg-muted px-3.5 py-2.5">
      <span aria-hidden className="size-2 rounded-full bg-border" />
      <span aria-hidden className="size-2 rounded-full bg-border" />
      <span aria-hidden className="size-2 rounded-full bg-border" />
      <span className="ml-2 text-xs text-muted-foreground">B1 ダッシュボード(サンプル)</span>
    </div>

    <div className="flex bg-muted">
      {/* サイドバー。狭い幅では畳む(プレビューとして読ませたいのは本文側のグラフのため) */}
      <aside className="hidden w-36 shrink-0 flex-col gap-0.5 border-r bg-card p-2 pt-3 sm:flex">
        <p className="px-2 pt-1 pb-2.5 text-xs font-bold">FIRE-FIRE</p>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[0.6875rem] font-semibold text-primary">
          ダッシュボード
        </span>
        {["CSV取込", "収支明細一覧", "資産分類マスタ", "不動産一覧", "負債入力"].map((label) => (
          <span key={label} className="rounded-md px-2 py-1 text-[0.6875rem] text-muted-foreground">
            {label}
          </span>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
        {/* 分類軸セレクタと表示期間の切替(B1のツールバー) */}
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md border border-input bg-background px-2 py-0.5 text-[0.6875rem]">
            純金融資産 ▾
          </span>
          <div className="flex gap-0.5">
            <span className="border-b-2 border-primary px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary">
              1年
            </span>
            {["3年", "全期間"].map((label) => (
              <span
                key={label}
                className="border-b-2 border-transparent px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* 資産推移。資産種別を積み上げたエリアと、0の線より下に積む負債の帯 */}
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-[0.6875rem] font-semibold">資産推移(純金融資産)</p>
          {/*
            高さを固定せず viewBox の比率のまま横幅いっぱいに描く。高さを決め打ちすると
            縦横比が合わずグラフが中央に寄って左右に余白が出る。
          */}
          <svg
            viewBox="0 0 640 210"
            className="h-auto w-full"
            role="img"
            aria-label="資産種別を積み上げた資産推移グラフのサンプル。0の線より下に負債の帯がある"
          >
            <line x1="0" y1="11" x2="640" y2="11" stroke="var(--border)" strokeWidth="1" />
            <line x1="0" y1="56" x2="640" y2="56" stroke="var(--border)" strokeWidth="1" />
            <line x1="0" y1="100" x2="640" y2="100" stroke="var(--border)" strokeWidth="1" />
            {/* 0の線。負債の帯がこの下に積まれるので他の目盛りより強く引く */}
            <line
              x1="0"
              y1="145"
              x2="640"
              y2="145"
              stroke="var(--muted-foreground)"
              strokeWidth="1"
            />
            <defs>
              {/*
                負債のハッチング。B1の円グラフ・推移グラフと同じ模様にする。

                このIDは下の円グラフからも `url(#...)` で参照する(同一ドキュメント内なら
                SVGをまたいで解決される)。**固定の文字列なので、このコンポーネントを同じ
                ページに2つ以上置くならIDを一意化すること。** 今はA0のヒーローに1つだけで、
                一意化には`useId`が要り、静的なServer Componentを`"use client"`へ
                落とすことになるため固定のままにしてある。
              */}
              <pattern
                id="top-preview-debt-hatch"
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill="var(--destructive)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="var(--card)"
                  strokeWidth="2"
                  strokeOpacity="0.55"
                />
              </pattern>
            </defs>
            <polygon
              fill="var(--chart-1)"
              fillOpacity="0.85"
              points="0,86 60,84.2 120,82.4 180,79.7 240,78 300,75.3 360,72.6 420,69.9 480,68.1 540,66.3 600,65.4 640,64.5 640,145 0,145"
            />
            <polygon
              fill="var(--chart-2)"
              fillOpacity="0.85"
              points="0,61.9 60,59.2 120,56.5 180,53.8 240,51.1 300,47.6 360,44 420,40.4 480,37.7 540,35 600,34.1 640,32.4 640,64.5 600,65.4 540,66.3 480,68.1 420,69.9 360,72.6 300,75.3 240,78 180,79.7 120,82.4 60,84.2 0,86"
            />
            <polygon
              fill="var(--chart-6)"
              fillOpacity="0.85"
              points="0,48.4 60,44.9 120,41.3 180,37.7 240,34.1 300,29.7 360,25.2 420,20.7 480,17.2 540,13.6 600,11.8 640,10 640,32.4 600,34.1 540,35 480,37.7 420,40.4 360,44 300,47.6 240,51.1 180,53.8 120,56.5 60,59.2 0,61.9"
            />
            <polygon
              fill="url(#top-preview-debt-hatch)"
              fillOpacity="0.85"
              points="0,145 640,145 640,197.6 600,197.8 540,197.9 480,198.2 420,198.5 360,198.9 300,199.1 240,199.7 180,199.9 120,200.5 60,200.7 0,201"
            />
            {/* 帯の上端はその帯自身の色で引く(B1と同じ) */}
            <polyline
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="1.5"
              points="0,86 60,84.2 120,82.4 180,79.7 240,78 300,75.3 360,72.6 420,69.9 480,68.1 540,66.3 600,65.4 640,64.5"
            />
            <polyline
              fill="none"
              stroke="var(--chart-2)"
              strokeWidth="1.5"
              points="0,61.9 60,59.2 120,56.5 180,53.8 240,51.1 300,47.6 360,44 420,40.4 480,37.7 540,35 600,34.1 640,32.4"
            />
            <polyline
              fill="none"
              stroke="var(--chart-6)"
              strokeWidth="1.5"
              points="0,48.4 60,44.9 120,41.3 180,37.7 240,34.1 300,29.7 360,25.2 420,20.7 480,17.2 540,13.6 600,11.8 640,10"
            />
            <polyline
              fill="none"
              stroke="var(--destructive)"
              strokeWidth="1.5"
              points="0,201 60,200.7 120,200.5 180,199.9 240,199.7 300,199.1 360,198.9 420,198.5 480,198.2 540,197.9 600,197.8 640,197.6"
            />
          </svg>

          <div className="mt-0.5 flex justify-between text-[0.625rem] text-muted-foreground tabular-nums">
            <span>2025/08</span>
            <span>2025/12</span>
            <span>2026/03</span>
            <span>2026/07</span>
          </div>

          <ul className="mt-2 flex flex-wrap gap-2.5 text-[0.625rem] text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--chart-1)]" />
              投資信託
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--chart-2)]" />
              現金・預金
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--chart-6)]" />
              株式
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-[repeating-linear-gradient(45deg,var(--destructive)_0_2px,var(--card)_2px_3px)]"
              />
              負債
            </li>
          </ul>
        </div>

        {/* 分類別内訳とFIRE達成度。B1では2カラムに並ぶ */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <p className="mb-2 text-[0.6875rem] font-semibold">分類別内訳(純金融資産)</p>
            <div className="flex items-center gap-3">
              <svg
                viewBox="0 0 120 120"
                className="size-18 shrink-0"
                role="img"
                aria-label="分類別内訳の円グラフのサンプル"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeWidth="20"
                  strokeDasharray="121 283"
                  transform="rotate(-90 60 60)"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="var(--chart-2)"
                  strokeWidth="20"
                  strokeDasharray="48 283"
                  strokeDashoffset="-121"
                  transform="rotate(-90 60 60)"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="var(--chart-6)"
                  strokeWidth="20"
                  strokeDasharray="31 283"
                  strokeDashoffset="-169"
                  transform="rotate(-90 60 60)"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="url(#top-preview-debt-hatch)"
                  strokeWidth="20"
                  strokeDasharray="82 283"
                  strokeDashoffset="-200"
                  transform="rotate(-90 60 60)"
                />
              </svg>

              <ul className="flex min-w-0 flex-1 flex-col gap-1 text-[0.625rem] tabular-nums">
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--chart-1)]" />
                  投資信託
                  <span className="ml-auto text-muted-foreground">43%</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--chart-2)]" />
                  現金・預金
                  <span className="ml-auto text-muted-foreground">17%</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--chart-6)]" />
                  株式
                  <span className="ml-auto text-muted-foreground">11%</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-[repeating-linear-gradient(45deg,var(--destructive)_0_2px,var(--card)_2px_3px)]"
                  />
                  負債
                  <span className="ml-auto text-muted-foreground">29%</span>
                </li>
              </ul>
            </div>

            <p className="mt-2 border-t pt-1.5 text-[0.625rem] text-muted-foreground tabular-nums">
              差引後 <strong>30,000,000円</strong>
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="mb-2 text-[0.6875rem] font-semibold">FIRE達成度</p>
            <div className="flex items-center gap-3">
              <svg
                viewBox="0 0 120 120"
                className="size-18 shrink-0"
                role="img"
                aria-label="FIRE達成度ゲージのサンプル。38%"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="14"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray="106 283"
                  transform="rotate(-90 60 60)"
                />
                <text
                  x="60"
                  y="67"
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="700"
                  fill="var(--foreground)"
                >
                  38%
                </text>
              </svg>

              {/*
                現在資産額には**対象分類名を併記する**
                (docs/screen-requirements-dashboard.md「FIRE達成度の現在資産額(対象分類)」)。
                併記が無いと、ゲージの数字がどの軸のものか判別できない。
              */}
              <ul className="flex flex-col gap-1 text-[0.625rem] text-muted-foreground tabular-nums">
                <li>
                  目標資産額 <strong>80,000,000円</strong>
                </li>
                <li>
                  現在資産額 <strong>30,000,000円</strong>
                  <span className="text-[0.5625rem] opacity-80">(純金融資産)</span>
                </li>
                <li>
                  到達予測日 <strong>2033年4月頃</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
