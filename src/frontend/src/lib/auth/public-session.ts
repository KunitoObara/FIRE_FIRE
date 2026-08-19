import { onIdTokenChanged } from "firebase/auth";

import { isAppAccessGuardBypassed } from "@/constants/dev";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

/**
 * 公開画面(A0・A9・A10・A11・A12)の導線を切り替えるための認証状態を購読する。
 *
 * ログイン後画面のガード(`src/lib/auth/app-access.ts`)とは判定が違う。あちらは
 * 「B1を表示してよいか」を見るためメール確認・2FA登録まで確かめるが、こちらが決めるのは
 * **ヘッダーとCTAに出す導線だけ**なので、セッションの有無だけを見る
 * (docs/screen-requirements-public.md 2章)。
 *
 * メール未確認・2FA未登録のセッションでも`signed-in`にする。その状態で「ダッシュボードへ」を
 * 押すとB1のガードがA2・A3へ送り返し、止まっていた手順の続きに戻れる。逆に「サインアップ」を
 * 出すと、既にアカウントを持っている人にもう1つ作らせることになる。
 *
 * 購読は`onAuthStateChanged`ではなく`onIdTokenChanged`を使う(app-access.tsと同じ)。
 * どちらも購読の直後に現在のユーザーで一度発火するため、セッション復元後の初期判定もこれで足りる。
 *
 * Firebaseの設定値が足りない場合は`signed-out`を通知する。この5画面はFirestoreを一切読まず
 * 未ログインのまま完結するため、設定エラーで画面ごと止める理由が無い(同2章)。訪問者には
 * 未ログインの導線が出て、ログインを試みた時点でA4が設定エラーを出す。
 *
 * 戻り値は購読の解除関数。
 */
export const subscribeToPublicSessionState = (
  onChange: (state: PublicSessionState) => void,
): (() => void) => {
  // 開発時の認証ガード迂回中はログイン後画面が開ける。導線だけ「ログイン」のままだと
  // 実際に押せる先と食い違うため、迂回中はログイン中として扱う(`src/constants/dev.ts`)
  if (isAppAccessGuardBypassed()) {
    onChange("signed-in");
    return () => {};
  }

  try {
    return onIdTokenChanged(getFirebaseAuth(), (user) => {
      onChange(user === null ? "signed-out" : "signed-in");
    });
  } catch (error) {
    if (!(error instanceof FirebaseConfigurationError)) {
      throw error;
    }

    onChange("signed-out");
    return () => {};
  }
};
