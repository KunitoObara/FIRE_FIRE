import { USE_SAMPLE_DASHBOARD_DATA } from "@/constants/dashboard";
import { createSampleDashboardData } from "@/lib/dashboard/sample-data";

/**
 * データが1件も無い状態。
 * CSVを一度も取り込んでおらず、分類軸もFIRE目標も未設定のアカウントがこれにあたる。
 */
const EMPTY_DASHBOARD_DATA: DashboardData = {
  lastImportedAt: null,
  axes: [],
  categories: [],
  byAxis: {},
  fireProgress: null,
  cashflow: null,
};

/**
 * B1が表示するデータを取得する。
 *
 * 現時点ではFirestoreに実データが無いため、`USE_SAMPLE_DASHBOARD_DATA`に従って
 * サンプルデータか空のデータを返すだけの関数である(`src/constants/dashboard.ts`)。
 * B2 CSV取込・B4 資産分類マスタ・B8 FIRE目標が揃った時点で、ここをFirestoreからの
 * 取得に差し替える。画面側はこの関数の戻り値の形にしか依存していない。
 */
export const getDashboardData = (now: Date): DashboardData =>
  USE_SAMPLE_DASHBOARD_DATA ? createSampleDashboardData(now) : EMPTY_DASHBOARD_DATA;
