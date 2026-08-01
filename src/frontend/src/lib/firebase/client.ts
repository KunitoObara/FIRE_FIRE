import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { z } from "zod";

import { FIREBASE_FUNCTIONS_REGION } from "@/constants/firebase";

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

  cachedApp = initializeApp(parsed.data);
  return cachedApp;
};

/**
 * Firebase Authenticationのインスタンスを取得する。
 *
 * `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` が設定されていればAuthエミュレータへ繋ぐ。
 * ローカル開発でサインアップを試すたびに本番のIdentity Platformへ実アカウントが作られ、
 * 入力したアドレスへ実際に確認メールが飛ぶのを防ぐため、`.env.example`では既定で有効にしている。
 *
 * 言語設定とエミュレータ接続はインスタンス生成時に一度だけ行えばよいので、
 * 生成済みのAuthをキャッシュして再利用する(`connectAuthEmulator`は繰り返し呼べない)。
 */
export const getFirebaseAuth = (): Auth => {
  if (cachedAuth) {
    return cachedAuth;
  }

  const auth = getAuth(getFirebaseApp());
  // 確認メール等のFirebase送信メールを日本語で送る(DESIGN.md 4章)
  auth.languageCode = "ja";

  const emulatorUrl = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulatorUrl) {
    connectAuthEmulator(auth, emulatorUrl);
  }

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
 * `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_URL` が設定されていればFirestoreエミュレータへ繋ぐ
 * (Auth・Functionsと同じく`.env.example`では既定で有効)。
 */
export const getFirebaseFirestore = (): Firestore => {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  const firestore = getFirestore(getFirebaseApp());

  const emulatorUrl = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_URL;
  if (emulatorUrl) {
    const { hostname, port } = new URL(emulatorUrl);
    connectFirestoreEmulator(firestore, hostname, Number(port));
  }

  cachedFirestore = firestore;
  return firestore;
};

/**
 * Cloud Functions(callable)のインスタンスを取得する。
 *
 * リージョンはバックエンドの`setGlobalOptions`と揃える必要がある。既定(us-central1)のままだと
 * 存在しない関数を呼びに行き、原因の分かりにくい`functions/internal`になる。
 *
 * `NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_URL` が設定されていればFunctionsエミュレータへ繋ぐ
 * (Authと同じく`.env.example`では既定で有効)。2FAリカバリーコードの発行・検証はcallable経由のため、
 * ローカルで試すには`firebase emulators:start`でfunctionsも起動しておく必要がある。
 */
export const getFirebaseFunctions = (): Functions => {
  if (cachedFunctions) {
    return cachedFunctions;
  }

  const functions = getFunctions(getFirebaseApp(), FIREBASE_FUNCTIONS_REGION);

  const emulatorUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_URL;
  if (emulatorUrl) {
    const { hostname, port } = new URL(emulatorUrl);
    connectFunctionsEmulator(functions, hostname, Number(port));
  }

  cachedFunctions = functions;
  return functions;
};
