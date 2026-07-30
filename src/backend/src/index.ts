import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";

/**
 * Cloud Functionsのリージョン。
 * Storageのロケーション(docs/ci-cd-setup.md)と揃え、dev/prodで共通にする。
 */
const FUNCTIONS_REGION = "asia-northeast1";

initializeApp();
setGlobalOptions({ region: FUNCTIONS_REGION });

export {
  generateMfaRecoveryCodes,
  getMfaRecoveryCodeStatus,
  useMfaRecoveryCode,
} from "./mfa-recovery/functions";
