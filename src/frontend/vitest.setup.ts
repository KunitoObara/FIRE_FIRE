import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach } from "vitest";

// jsdomはResizeObserverを実装していないが、Radix UI(shadcn/uiの基盤)の一部の
// コンポーネントが要求するためスタブを入れる。サイズ計測結果はテストで検証しないため、
// 何も通知しない空実装で足りる。
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserverStub implements ResizeObserver {
    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}
  };
}

// jsdomはPointer Events APIとscrollIntoViewを実装していない。Radix UIのSelect等は
// ポインタ操作の判定にこれらを呼ぶため、呼ばれても落ちないだけのスタブを入れる。
// 実際のキャプチャ・スクロール挙動はテストの対象外。
const elementStubs: Record<string, () => unknown> = {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
};

Object.entries(elementStubs).forEach(([name, stub]) => {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { value: stub, writable: true });
  }
});

afterEach(() => {
  cleanup();
});

/**
 * `input-otp`(A3・A5の6桁コード入力)がマウント時に仕掛ける 0/10/50ms のタイマーを
 * 消化してからテストファイルを閉じるための待ち時間。
 *
 * このタイマーはライブラリ側でクリアされないため、`cleanup()`でアンマウントしても残る。
 * 発火が遅れてjsdomの破棄後になると、React内部が`window`を触って
 * `ReferenceError: window is not defined` になり、全テストが通っていても実行自体が
 * 失敗する(実際にCIのLinuxランナーで発生した)。
 *
 * ライブラリ側を直せないので、環境が生きているうちに発火させて素通りさせる。
 * アンマウント済みコンポーネントへの更新は何も起こさない。
 */
const PENDING_TIMER_DRAIN_MS = 60;

afterAll(
  () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, PENDING_TIMER_DRAIN_MS);
    }),
);
