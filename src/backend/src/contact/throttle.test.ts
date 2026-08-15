import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as FirestoreModule from "firebase-admin/firestore";

import {
  buildThrottleKey,
  CONTACT_MIN_INTERVAL_MS,
  releaseContactSlot,
  reserveContactSlot,
} from "./throttle";

/**
 * 連投を拒みつつ、**正規の問い合わせを止めない**ことを確かめる
 * (docs/screen-requirements-public.md A11)。
 */

const transactionGet = vi.fn();
const transactionSet = vi.fn();
const deleteDoc = vi.fn();
const doc = vi.fn((id: string) => ({ delete: deleteDoc, path: `doc/${id}` }));
const collection = vi.fn((name: string) => ({ doc, path: name }));
const runTransaction = vi.fn();

vi.mock("firebase-admin/firestore", async () => {
  // Timestampの比較に実物を使うため、そこだけ本物を借りる
  const actual = await vi.importActual<typeof FirestoreModule>("firebase-admin/firestore");

  return {
    Timestamp: actual.Timestamp,
    getFirestore: () => ({
      collection: (name: string) => collection(name),
      runTransaction: (updateFunction: unknown) => runTransaction(updateFunction),
    }),
  };
});

/** 実物と同じく、渡された関数にトランザクションを差し込んで実行する */
const runTransactionForReal = async (
  updateFunction: (transaction: { get: typeof transactionGet; set: typeof transactionSet }) => unknown,
): Promise<unknown> => updateFunction({ get: transactionGet, set: transactionSet });

/** 保存済みの`lastSentAt`を返すスナップショット */
const snapshotWith = (lastSentAt: unknown): { get: (field: string) => unknown } => ({
  get: () => lastSentAt,
});

const now = new Date("2026-08-15T12:00:00Z");

describe("buildThrottleKey", () => {
  /** 問い合わせに使うだけの値をFirestoreに残さない(A10「取得しない情報」の方針) */
  it("IPアドレスをそのまま使わない", () => {
    const key = buildThrottleKey("203.0.113.10");

    expect(key).not.toContain("203.0.113.10");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同じIPからは同じキーになる", () => {
    expect(buildThrottleKey("203.0.113.10")).toBe(buildThrottleKey("203.0.113.10"));
  });

  it("違うIPからは違うキーになる", () => {
    expect(buildThrottleKey("203.0.113.10")).not.toBe(buildThrottleKey("203.0.113.11"));
  });

  /** ローカルのエミュレータ等ではIPが取れない。間隔制限が全体で1つになるだけで動きは変わらない */
  it("IPが取れなくてもキーを作れる", () => {
    expect(buildThrottleKey(undefined)).toBe(buildThrottleKey(""));
  });
});

describe("reserveContactSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runTransaction.mockImplementation(runTransactionForReal);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("記録が無ければ確保して送信時刻を書く", async () => {
    transactionGet.mockResolvedValue(snapshotWith(undefined));

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
    expect(collection).toHaveBeenCalledWith("contactThrottle");
    expect(doc).toHaveBeenCalledWith("key-1");
    expect(transactionSet.mock.calls[0]?.[1]).toEqual({ lastSentAt: Timestamp.fromDate(now) });
  });

  it("間隔が空いていなければ確保せず、書き込みもしない", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith(Timestamp.fromMillis(now.getTime() - CONTACT_MIN_INTERVAL_MS + 1)),
    );

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "throttled" });
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it("間隔が空いていれば確保できる", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith(Timestamp.fromMillis(now.getTime() - CONTACT_MIN_INTERVAL_MS)),
    );

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
  });

  /**
   * 読んでから書くまでを分けると、同時に届いたリクエストがそろって「間隔が空いている」と
   * 判定して全部通る。連投を拒むのが目的なので、並行して投げられたときにこそ効く必要がある。
   */
  it("判定と記録を1つのトランザクションで行う", async () => {
    transactionGet.mockResolvedValue(snapshotWith(undefined));

    await reserveContactSlot("key-1", now);

    expect(runTransaction).toHaveBeenCalledOnce();
  });

  /** 想定外の形が入っていても「記録が無い」として扱う。読めない値で送信経路を閉じない */
  it("保存された値の形が違えば確保できる", async () => {
    transactionGet.mockResolvedValue(snapshotWith("2026-08-15"));

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
  });

  /**
   * 止めたいのは連投であって正規の問い合わせではない。Firestoreの一時的な不調で
   * 問い合わせ経路そのものが閉じるほうが、この機能の失敗としては重い。
   */
  it("トランザクションに失敗したら送れる側に倒す", async () => {
    runTransaction.mockRejectedValue(new Error("firestore down"));

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
  });
});

describe("releaseContactSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** 送れなかった利用者を1分待たせないため、確保した枠は戻す */
  it("記録を消す", async () => {
    deleteDoc.mockResolvedValue(undefined);

    await releaseContactSlot("key-1");

    expect(collection).toHaveBeenCalledWith("contactThrottle");
    expect(doc).toHaveBeenCalledWith("key-1");
    expect(deleteDoc).toHaveBeenCalledOnce();
  });
});
