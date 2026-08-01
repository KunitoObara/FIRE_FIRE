import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { z } from "zod";

import { FIREBASE_FUNCTIONS_REGION, PRODUCTION_FIREBASE_PROJECT_ID } from "@/constants/firebase";

import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { Functions } from "firebase/functions";

/**
 * Firebaseの設定値が不足しているときに投げるエラー。
 * 通信エラー等と区別して画面に対処法を出すため、専用の型にする。
 */
export class FirebaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigurationError";
  }
}

/**
 * FirebaseクライアントSDKの初期化(src/frontend/docs/TECH_STACK.md 2章)。
 *
 * 設定値は`.env.local`で管理する(`.env.example`を参照)。Next.jsは
 * `process.env.NEXT_PUBLIC_*`をリテラルのプロパティアクセスに限ってビルド時に埋め込むため、
 * 動的なキー参照(`process.env[key]`)にはできない。
 */
const firebaseEnvSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
});

let cachedApp: FirebaseApp | undefined;
let cachedAuth: Auth | undefined;
let cachedFirestore: Firestore | undefined;
let cachedFunctions: Functions | undefined;

/**
 * Firebaseアプリを取得する。開発時のFast Refreshで多重初期化されないよう、
 * 既に初期化済みのアプリがあればそれを再利用する。
 */
export const getFirebaseApp = (): FirebaseApp => {
  if (cachedApp) {
    return cachedApp;
  }

  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  const parsed = firebaseEnvSchema.safeParse({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  if (!parsed.success) {
    const missingKeys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new FirebaseConfigurationError(
      `Firebaseの設定値が不足しています(${missingKeys})。.env.example をコピーして .env.local を作成し、Firebaseコンソールの値を設定してください。`,
    );
  }

  // B0-1でエミュレータを廃止したため、接続先は`.env.local`の値だけで決まる。本番プロジェクトを
  // 指したまま`npm run dev`すると、サインアップで本番に実アカウントが作られ、B2の取込が本番の
  // Firestoreに書き込まれる。取り返しがつかないので、警告ではなく初期化ごと止める。
  //
  // 本番ビルド(NODE_ENV=production)では当然この照合をしない。Next.jsが`process.env.NODE_ENV`を
  // ビルド時にリテラルへ置き換えるため、この分岐自体が本番の成果物からは消える。
  if (
    process.env.NODE_ENV !== "production" &&
    parsed.data.projectId === PRODUCTION_FIREBASE_PROJECT_ID
  ) {
    // 画面には汎用の設定エラー(`FIREBASE_CONFIGURATION_MESSAGE`)しか出ないため、
    // 実際の原因はコンソールにも出しておく
    console.error(
      `Firebaseの接続先が本番プロジェクト(${PRODUCTION_FIREBASE_PROJECT_ID})になっています。` +
        `.env.local に fire-fire-dev(STG)の値を設定してください(src/frontend/README.md「セットアップ」)。`,
    );
    throw new FirebaseConfigurationError(
      `.env.local が本番プロジェクト(${PRODUCTION_FIREBASE_PROJECT_ID})を指しています。ローカル開発では fire-fire-dev(STG)の値を設定してください。`,
    );
  }

  cachedApp = initializeApp(parsed.data);
  return cachedApp;
};

/**
 * Firebase Authenticationのインスタンスを取得する。
 *
 * ローカル開発を含め常に`.env.local`で指定したFirebaseプロジェクト(既定は`fire-fire-dev`)に
 * 直接繋ぐ(B0-1: Firebase Emulatorはローカルでは使わない方針)。
 *
 * 言語設定はインスタンス生成時に一度だけ行えばよいので、生成済みのAuthをキャッシュして再利用する。
 */
export const getFirebaseAuth = (): Auth => {
  if (cachedAuth) {
    return cachedAuth;
  }

  const auth = getAuth(getFirebaseApp());
  // 確認メール等のFirebase送信メールを日本語で送る(DESIGN.md 4章)
  auth.languageCode = "ja";

  cachedAuth = auth;
  return auth;
};

/**
 * Cloud Firestoreのインスタンスを取得する。
 *
 * B2 CSV取込の書き込みはクライアントSDKから直接行い、他人のデータに触れないことは
 * `firestore.rules`のユーザー単位の判定で担保する
 * (docs/fire-asset-management-requirements.md 5章のセキュリティ方針)。
 * 認証はブラウザ側のFirebase SDKが持つため、サーバー側からは`uid`を特定できない。
 *
 * ローカル開発を含め常に`.env.local`で指定したFirebaseプロジェクトのFirestoreに直接繋ぐ
 * (B0-1: Firebase Emulatorはローカルでは使わない方針)。
 */
export const getFirebaseFirestore = (): Firestore => {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  cachedFirestore = getFirestore(getFirebaseApp());
  return cachedFirestore;
};

/**
 * Cloud Functions(callable)のインスタンスを取得する。
 *
 * リージョンはバックエンドの`setGlobalOptions`と揃える必要がある。既定(us-central1)のままだと
 * 存在しない関数を呼びに行き、原因の分かりにくい`functions/internal`になる。
 *
 * ローカル開発を含め常に`.env.local`で指定したFirebaseプロジェクトにデプロイ済みのFunctionsを
 * 直接呼ぶ(B0-1: Firebase Emulatorはローカルでは使わない方針)。
 */
export const getFirebaseFunctions = (): Functions => {
  if (cachedFunctions) {
    return cachedFunctions;
  }

  cachedFunctions = getFunctions(getFirebaseApp(), FIREBASE_FUNCTIONS_REGION);
  return cachedFunctions;
};
