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

afterEach(() => {
  cleanup();
});
