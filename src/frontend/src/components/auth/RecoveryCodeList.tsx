import type { JSX } from "react";

/**
 * 発行したリカバリーコードの一覧(A3の登録完了時。B10の再発行でも使う)。
 *
 * 平文のコードは発行直後にしか手に入らないため、書き写しやすさを優先して
 * 等幅・数字幅固定で2列に並べる(HTMLモック src/frontend/docs/html_mock/a3-mfa-setup.html)。
 */
export const RecoveryCodeList = ({ codes }: RecoveryCodeListProps): JSX.Element => (
  <ul className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-muted p-4 text-center font-mono text-sm tabular-nums">
    {codes.map((code) => (
      <li key={code}>{code}</li>
    ))}
  </ul>
);
