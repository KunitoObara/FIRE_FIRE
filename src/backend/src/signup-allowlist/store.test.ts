import { beforeEach, describe, expect, it, vi } from "vitest";

import { isSignUpAllowed } from "./store";

/**
 * 許可リストの読み取り(docs/auth-login-requirements.md 3.10)。
 *
 * 見たいのは3つ。**正規化してから引くこと**、**読み取りが1件で済むこと**(7秒のバジェット)、
 * **失敗を握り潰さないこと**(呼び出し側がfail-closedに倒すため)である。
 */

const doc = vi.fn();
const collection = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: (...args: unknown[]) => collection(...args) }),
}));

/** `collection().doc().get()` が返すスナップショットを差し替える */
const mockSnapshot = (snapshot: { exists: boolean } | Error): void => {
  const get = vi.fn();

  if (snapshot instanceof Error) {
    get.mockRejectedValue(snapshot);
  } else {
    get.mockResolvedValue(snapshot);
  }

  doc.mockReturnValue({ get });
  collection.mockReturnValue({ doc: (...args: unknown[]) => doc(...args) });
};

describe("isSignUpAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ドキュメントが存在すれば承認済みとして扱う", async () => {
    mockSnapshot({ exists: true });

    await expect(isSignUpAllowed("taro@example.com")).resolves.toBe(true);
    expect(collection).toHaveBeenCalledWith("signupAllowlist");
  });

  it("ドキュメントが無ければ承認されていないとして扱う", async () => {
    mockSnapshot({ exists: false });

    await expect(isSignUpAllowed("taro@example.com")).resolves.toBe(false);
  });

  it("正規化したアドレスをドキュメントIDとして引く", async () => {
    mockSnapshot({ exists: true });

    await isSignUpAllowed("  Taro@Example.com ");

    // 承認する側の手入力の揺れで弾かれないようにするため
    expect(doc).toHaveBeenCalledWith("taro@example.com");
  });

  it("読み取りはドキュメント1件で済ませる(7秒のバジェット)", async () => {
    mockSnapshot({ exists: true });

    await isSignUpAllowed("taro@example.com");

    // 走査やクエリに変わっていないことを、呼び出し回数で見張る
    expect(collection).toHaveBeenCalledTimes(1);
    expect(doc).toHaveBeenCalledTimes(1);
  });

  it("正規化して空になるアドレスはFirestoreを引かずに拒否する", async () => {
    mockSnapshot({ exists: true });

    await expect(isSignUpAllowed("   ")).resolves.toBe(false);
    // 空のドキュメントIDでの取得はエラーになるため、その前に落とす
    expect(doc).not.toHaveBeenCalled();
  });

  it("読み取りの失敗を握り潰さない", async () => {
    mockSnapshot(new Error("firestore unavailable"));

    // `false` に丸めると「承認されていない」と「確かめられなかった」の区別が消える
    await expect(isSignUpAllowed("taro@example.com")).rejects.toThrow("firestore unavailable");
  });
});
