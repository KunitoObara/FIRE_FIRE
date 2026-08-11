import { describe, expect, it } from "vitest";

import { ASSET_TYPE_SCAN_LIMIT } from "@/constants/asset-categories";
import { ASSET_SNAPSHOT_SCAN_LIMIT } from "@/constants/csv-import";
import { FIRESTORE_QUERY_LIMIT_MAX } from "@/constants/firebase";
import { TRANSACTION_SCAN_LIMIT } from "@/constants/transactions";

/**
 * 走査件数の上限がFirestoreの`limit()`の最大値を超えていないことを固定する。
 *
 * 超えた場合に起きるのは「上限まで読めない」ではなく「クエリごと`invalid-argument`で
 * 拒否されて1件も読めない」で、画面には汎用の取得失敗しか出ない(B1-3)。
 * リポジトリのテストはFirestoreをモックしており、この制約はサーバー側にしか無いため、
 * 実装側では踏めない。定数の側で縛る。
 *
 * 現状はどちらも`FIRESTORE_QUERY_LIMIT_MAX`そのものだが、読み取りコストの都合で
 * 個別に小さい値へ変えることは想定内なので、一致ではなく上限として検査する。
 */
describe("Firestoreの走査件数の上限", () => {
  it.each([
    ["ASSET_SNAPSHOT_SCAN_LIMIT", ASSET_SNAPSHOT_SCAN_LIMIT],
    ["ASSET_TYPE_SCAN_LIMIT", ASSET_TYPE_SCAN_LIMIT],
  ])("%s はFirestoreが許す上限を超えない", (_name, scanLimit) => {
    expect(scanLimit).toBeLessThanOrEqual(FIRESTORE_QUERY_LIMIT_MAX);
    expect(scanLimit).toBeGreaterThan(0);
  });

  /**
   * 取引だけは`limit()`へ渡す値が`+ 1`される(打ち切りを判定するために1件余分に読む。
   * docs/transaction-import-requirements.md 8章)。**上限を超えてはならないのはそちらの値**
   * なので、`TRANSACTION_SCAN_LIMIT`そのものではなく`+ 1`した値で検査する。
   */
  it("TRANSACTION_SCAN_LIMIT は1件余分に読んでもFirestoreが許す上限を超えない", () => {
    expect(TRANSACTION_SCAN_LIMIT + 1).toBeLessThanOrEqual(FIRESTORE_QUERY_LIMIT_MAX);
    expect(TRANSACTION_SCAN_LIMIT).toBeGreaterThan(0);
  });
});
