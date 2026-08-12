import {
  DASHBOARD_FAILURE_MESSAGES,
  DASHBOARD_UNEXPECTED_ERROR_MESSAGE,
} from "@/constants/dashboard";

/**
 * B1で表示できないときの扱いを決める。取得の失敗(理由つき)と、集計まで含めた例外の両方を
 * ここに集める。表示できているあいだは`null`。
 *
 * 文言と再試行の可否を**同じ場所で**決める。別々に判断すると、失敗理由を足したときに
 * 片方だけ直して、文言は「ログインし直してください」なのに再試行ボタンが出る、といった
 * 食い違いが起きる。
 *
 * **例外を先に見る。** rejectしたときTanStack Queryは`data`を更新しないので、`ok: false`で
 * 失敗したあとに再試行が例外で落ちると、`failureReason`には1つ前の理由が残ったままになる。
 * 理由を先に見ると、その古い文言を出し続けてしまう。
 *
 * **画面全体(`DashboardScreen`)と収支サマリのカードが共有する。** 収支サマリは対象の年月ごとに
 * 独立して取得するため(docs/screen-requirements-dashboard.md B1「年月の選択」)、
 * そのカードだけが失敗しうる。同じ失敗に対して画面とカードで違う文言・違う再試行の可否を
 * 出さないよう、判断はこの1か所に置く。
 */
export const resolveFailureView = (
  failureReason: FirestoreAccessFailureReason | null,
  unexpectedError: unknown,
): DashboardFailureView | null => {
  if (unexpectedError) {
    return { message: DASHBOARD_UNEXPECTED_ERROR_MESSAGE, retryable: true };
  }

  if (failureReason === null) {
    return null;
  }

  return {
    message: DASHBOARD_FAILURE_MESSAGES[failureReason],
    /*
      ログイン切れ・設定不備は再取得しても同じ結果にしかならず、文言で案内している
      「ログインし直す」より先にボタンを押させてしまう。押せる導線は残さない。
      `permission-denied`は文言で再ログインを促してはいるが、IDトークンが更新されれば
      その場で通ることがあるので残す(`unknown`と同じ扱い)。
    */
    retryable: failureReason !== "signed-out" && failureReason !== "configuration-error",
  };
};
