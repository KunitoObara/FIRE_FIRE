import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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
