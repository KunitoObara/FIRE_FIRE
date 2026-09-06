import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as FirestoreModule from "firebase-admin/firestore";

import {
  buildThrottleKey,
  CONTACT_MAX_PER_WINDOW,
  CONTACT_MIN_INTERVAL_MS,
  CONTACT_WINDOW_MS,
  releaseContactSlot,
  reserveContactSlot,
} from "./throttle";

/**
 * 連投と反復を拒みつつ、**正規の問い合わせを止めない**ことを確かめる
 * (docs/screen-requirements-public.md A11)。
 */

const transactionGet = vi.fn();
const transactionSet = vi.fn();
const transactionDelete = vi.fn();
const doc = vi.fn((id: string) => ({ path: `doc/${id}` }));
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
  updateFunction: (transaction: {
    get: typeof transactionGet;
    set: typeof transactionSet;
    delete: typeof transactionDelete;
  }) => unknown,
): Promise<unknown> =>
  updateFunction({ get: transactionGet, set: transactionSet, delete: transactionDelete });

/** 保存済みのフィールドを返すスナップショット。書いていないフィールドは`undefined`になる */
const snapshotWith = (fields: Record<string, unknown>): { get: (field: string) => unknown } => ({
  get: (field: string) => fields[field],
});

/** 記録が1件も無い(= 初めての送信元) */
const emptySnapshot = snapshotWith({});

const now = new Date("2026-08-15T12:00:00Z");

/** 窓が開いている状態の記録。`sentCount`だけを変えて使う */
const openWindow = (sentCount: number): Record<string, unknown> => ({
  windowStartedAt: Timestamp.fromMillis(now.getTime() - CONTACT_WINDOW_MS + 1),
  sentCount,
});

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

  it("記録が無ければ確保して、送信時刻と窓を書く", async () => {
    transactionGet.mockResolvedValue(emptySnapshot);

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
    expect(collection).toHaveBeenCalledWith("contactThrottle");
    expect(doc).toHaveBeenCalledWith("key-1");
    expect(transactionSet.mock.calls[0]?.[1]).toEqual({
      lastSentAt: Timestamp.fromDate(now),
      windowStartedAt: Timestamp.fromDate(now),
      sentCount: 1,
    });
  });

  it("間隔が空いていなければ確保せず、書き込みもしない", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith({ lastSentAt: Timestamp.fromMillis(now.getTime() - CONTACT_MIN_INTERVAL_MS + 1) }),
    );

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({
      status: "throttled",
      reason: "interval",
    });
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it("間隔が空いていれば確保できる", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith({ lastSentAt: Timestamp.fromMillis(now.getTime() - CONTACT_MIN_INTERVAL_MS) }),
    );

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
  });

  /**
   * 間隔制限だけでは、1分以上空けて叩き続ける送信を止められない([X29])。実際に観測された
   * 2件は6時間以上あいており、間隔制限には抵触していなかった。
   */
  it("窓の中で上限に達していたら確保しない", async () => {
    transactionGet.mockResolvedValue(snapshotWith(openWindow(CONTACT_MAX_PER_WINDOW)));

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({
      status: "throttled",
      reason: "window",
    });
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it("上限に達していなければ確保し、件数を1つ増やす", async () => {
    const stored = openWindow(CONTACT_MAX_PER_WINDOW - 1);
    transactionGet.mockResolvedValue(snapshotWith(stored));

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
    expect(transactionSet.mock.calls[0]?.[1]).toEqual({
      lastSentAt: Timestamp.fromDate(now),
      // 窓の起点は動かさない。動かすと上限に達するたびに窓が延び、いつまでも開かなくなる
      windowStartedAt: stored.windowStartedAt,
      sentCount: CONTACT_MAX_PER_WINDOW,
    });
  });

  /** 窓が閉じたら数え直す。閉じた窓の件数を持ち越すと、上限が一度で永続化してしまう */
  it("窓が閉じていれば、件数が上限に達していても新しい窓を開く", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith({
        windowStartedAt: Timestamp.fromMillis(now.getTime() - CONTACT_WINDOW_MS),
        sentCount: CONTACT_MAX_PER_WINDOW,
      }),
    );

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
    expect(transactionSet.mock.calls[0]?.[1]).toEqual({
      lastSentAt: Timestamp.fromDate(now),
      windowStartedAt: Timestamp.fromDate(now),
      sentCount: 1,
    });
  });

  /**
   * 読んでから書くまでを分けると、同時に届いたリクエストがそろって「間隔が空いている」と
   * 判定して全部通る。連投を拒むのが目的なので、並行して投げられたときにこそ効く必要がある。
   */
  it("判定と記録を1つのトランザクションで行う", async () => {
    transactionGet.mockResolvedValue(emptySnapshot);

    await reserveContactSlot("key-1", now);

    expect(runTransaction).toHaveBeenCalledOnce();
  });

  /**
   * `NaN`は`NaN >= 上限`が偽になるため、弾かないと**上限の判定が素通りしたうえで`NaN + 1`を
   * 書き戻す**。以後この送信元には二度と効かなくなるので、0として数え直す。
   */
  it("件数が数値として読めなければ0から数え直す", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith({ ...openWindow(Number.NaN), sentCount: Number.NaN }),
    );

    await expect(reserveContactSlot("key-1", now)).resolves.toEqual({ status: "reserved" });
    expect(transactionSet.mock.calls[0]?.[1]).toMatchObject({ sentCount: 1 });
  });

  /** 想定外の形が入っていても「記録が無い」として扱う。読めない値で送信経路を閉じない */
  it("保存された値の形が違えば確保できる", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith({ lastSentAt: "2026-08-15", windowStartedAt: "2026-08-15", sentCount: "9" }),
    );

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
    runTransaction.mockImplementation(runTransactionForReal);
  });

  /**
   * 記録ごと消すと窓もカウントも初期化され、送信に失敗させ続ければ上限を巻き戻せる([X29])。
   * 戻すのはこの送信の1件分だけにする。
   */
  it("件数を1つ戻し、窓の起点は残す", async () => {
    const stored = openWindow(3);
    transactionGet.mockResolvedValue(snapshotWith({ ...stored, lastSentAt: Timestamp.fromDate(now) }));

    await releaseContactSlot("key-1");

    expect(collection).toHaveBeenCalledWith("contactThrottle");
    expect(doc).toHaveBeenCalledWith("key-1");
    expect(transactionDelete).not.toHaveBeenCalled();
    // `set`はマージしないので、`lastSentAt`を書かないことがそのまま削除になる
    expect(transactionSet.mock.calls[0]?.[1]).toEqual({
      windowStartedAt: stored.windowStartedAt,
      sentCount: 2,
    });
  });

  /** 送れなかった利用者を1分待たせないため、確保した枠は戻す */
  it("戻すと0件になるなら記録ごと消す", async () => {
    transactionGet.mockResolvedValue(
      snapshotWith({ ...openWindow(1), lastSentAt: Timestamp.fromDate(now) }),
    );

    await releaseContactSlot("key-1");

    expect(transactionDelete).toHaveBeenCalledOnce();
    expect(transactionSet).not.toHaveBeenCalled();
  });

  /** 戻すときも同じ。`NaN - 1`を書き戻すと、その送信元の記録が二度と読めなくなる */
  it("件数が数値として読めなければ記録ごと消す", async () => {
    transactionGet.mockResolvedValue(snapshotWith({ ...openWindow(Number.NaN) }));

    await releaseContactSlot("key-1");

    expect(transactionDelete).toHaveBeenCalledOnce();
    expect(transactionSet).not.toHaveBeenCalled();
  });

  /** 確保そのものが書けていない場合(Firestoreの不調で送れる側へ倒したとき)も通る経路 */
  it("記録が無ければ消すだけで終わる", async () => {
    transactionGet.mockResolvedValue(emptySnapshot);

    await releaseContactSlot("key-1");

    expect(transactionDelete).toHaveBeenCalledOnce();
    expect(transactionSet).not.toHaveBeenCalled();
  });
});
