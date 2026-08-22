/**
 * 実行中のFirebaseプロジェクトIDを解決する。
 *
 * 実行環境によって設定される変数が違うため順に見る。`FIREBASE_CONFIG`はFirebaseが
 * デプロイ時に設定するJSONで、環境変数側が空でもここからプロジェクトIDを拾える。
 *
 * どれも読めなければ空文字を返す。**取り違える方向を「本番ではない側」に倒してある** —
 * ログイン通知は本番の通知に`[dev]`が付く形で現れ(`login-notification/message.ts`)、
 * Sentryは`environment`が`unknown`になる。逆(開発環境のものが本番の見た目で出る)より、
 * 気づいたときの実害が小さい。
 *
 * ログイン通知とSentryの両方が同じ判定を要るため、ここに置いて共有する([X3])。
 * どちらか片方だけが別の変数を見る状態になると、同じ実行なのに環境の表示が食い違う。
 */
export const resolveProjectId = (): string => {
  const fromEnv =
    process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT;

  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv;
  }

  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG ?? "{}") as { projectId?: string };
    return config.projectId ?? "";
  } catch (error) {
    console.error("FIREBASE_CONFIGを解釈できませんでした", error);
    return "";
  }
};
