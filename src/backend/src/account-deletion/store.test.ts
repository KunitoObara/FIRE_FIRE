import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteRecoveryCodeDocument,
  deleteSignUpAllowlistEntry,
  deleteUserData,
} from "./store";

/**
 * 削除の宛先が正しいことを確かめる(docs/auth-login-requirements.md 3.11)。
 *
 * **消し残しは画面に出ない。** 宛先を間違えても呼び出しは成功するため、ここで
 * コレクション名とドキュメントIDを固定しておく。
 */

const recursiveDelete = vi.fn();
const deleteDoc = vi.fn();
const doc = vi.fn((id: string) => ({ delete: deleteDoc, path: `doc/${id}` }));
const collection = vi.fn((name: string) => ({ doc, path: name }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => collection(name),
    recursiveDelete: (ref: unknown) => recursiveDelete(ref),
  }),
}));

describe("deleteUserData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * サブコレクションを列挙して消す形にしないのは、増えたときに直し忘れるとその分だけ
   * 消し残るため。親ドキュメントごと再帰的に消す。
   */
  it("users/{uid}を配下ごと再帰的に消す", async () => {
    await deleteUserData("uid-1");

    expect(collection).toHaveBeenCalledWith("users");
    expect(doc).toHaveBeenCalledWith("uid-1");
    expect(recursiveDelete).toHaveBeenCalledOnce();
  });
});

describe("deleteRecoveryCodeDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mfaRecoveryCodes/{uid}を消す", async () => {
    await deleteRecoveryCodeDocument("uid-1");

    expect(collection).toHaveBeenCalledWith("mfaRecoveryCodes");
    expect(doc).toHaveBeenCalledWith("uid-1");
    expect(deleteDoc).toHaveBeenCalledOnce();
  });
});

describe("deleteSignUpAllowlistEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** 承認時と同じ正規化を通さないと、登録できたアドレスなのに消せない組み合わせが出る */
  it("正規化したメールアドレスをIDにして消す", async () => {
    await deleteSignUpAllowlistEntry("  Taro@Example.com ");

    expect(collection).toHaveBeenCalledWith("signupAllowlist");
    expect(doc).toHaveBeenCalledWith("taro@example.com");
    expect(deleteDoc).toHaveBeenCalledOnce();
  });

  /** 空になるアドレスは対象が定まらない。許可リスト全体を巻き込まないよう何もしない */
  it("空白だけのメールアドレスでは何も消さない", async () => {
    await deleteSignUpAllowlistEntry("   ");

    expect(collection).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
