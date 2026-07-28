"use client";

import dynamic from "next/dynamic";

import type { JSX } from "react";

/**
 * QRコードの描画はブラウザ専用のため、SSRを外して読み込む
 * (src/frontend/docs/CODING_STANDARDS.md 2章「SPA的な挙動を維持するためのルール」)。
 */
const QRCode = dynamic(() => import("react-qr-code"), {
  ssr: false,
  loading: () => <span className="block size-40 animate-pulse rounded bg-muted" />,
});

/**
 * A3の2FA登録用QRコード。
 *
 * 認証アプリのカメラが読み取る対象なので、配色はダークモードでも反転させず、
 * 白地に黒のまま余白(クワイエットゾーン)を確保して表示する。
 */
export const TotpQrCode = ({ url }: TotpQrCodeProps): JSX.Element => (
  <div className="rounded-md border border-input bg-white p-3">
    <QRCode value={url} size={160} title="2段階認証の設定用QRコード" className="size-40" />
  </div>
);
