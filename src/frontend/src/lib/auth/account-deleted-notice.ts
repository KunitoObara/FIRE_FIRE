/**
 * A0に「アカウントを削除しました」を1回だけ出すための一過性フラグ
 * (docs/screen-requirements-public.md A0、docs/auth-login-requirements.md 3.11)。
 *
 * `logout-notice.ts`と同じ形にしてある。URLのクエリパラメータで制御しないのは同じ理由で、
 * `/?accountDeleted=1`を直接開くだけで表示でき、リロードでも消えないため
 * 「削除した直後の1回だけ・リロードで消える」の両方が成立しなくなる。
 *
 * 削除後の遷移先をA4ではなくA0にしたのはPO判断による。削除した人はもう利用者ではないため、
 * ログインを促す画面より公開トップのほうが自然なため。
 *
 * 読み出し(`wasAccountDeleted`)と消費(`clearAccountDeletedNotice`)を分けているのも
 * `logout-notice.ts`と同じ理由による。React Strict Modeは`useState`の初期化関数を2回呼ぶため、
 * 読み出しと消費が同じ関数だと1回目で消費され2回目は必ずfalseを返す。
 */

let accountDeleted = false;

/** 削除に成功したときに立てる(`src/lib/auth/account-deletion.ts`) */
export const markAccountDeleted = (): void => {
  accountDeleted = true;
};

/** 副作用なく現在の値を読み出す。Strict Modeで複数回呼ばれても安全 */
export const wasAccountDeleted = (): boolean => accountDeleted;

/** 表示した後に消費する。以降の読み出しではfalseを返すため、再訪問時には出ない */
export const clearAccountDeletedNotice = (): void => {
  accountDeleted = false;
};
