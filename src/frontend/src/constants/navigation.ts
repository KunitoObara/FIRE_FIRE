/** ログイン後(B1〜B10)の共通サイドバーの構成 */

import {
  Building2,
  FileUp,
  LayoutDashboard,
  ReceiptText,
  Tags,
  Target,
  TrendingUp,
  UserRoundCog,
} from "lucide-react";

import {
  ACCOUNT_SETTINGS_PATH,
  ASSET_CATEGORIES_PATH,
  ASSUMPTION_SETTINGS_PATH,
  CSV_IMPORT_PATH,
  DASHBOARD_PATH,
  FIRE_GOAL_PATH,
  REAL_ESTATE_PATH,
  TRANSACTIONS_PATH,
} from "@/constants/routes";

/** サイドバー・ヘッダーに出すアプリ名 */
export const APP_NAME = "FIRE-FIRE";

/**
 * サイドバーに常時並べる主要画面(docs/screen-list-and-transitions.md 1章)。
 *
 * ログイン後の画面は相互に自由遷移できるダッシュボードアプリ型のため、ここに並べた画面へは
 * どこからでも1クリックで到達できる。一覧から辿る画面(B6 不動産詳細・B7 不動産登録/編集)は
 * 親のB5から遷移するため、サイドバーには出さない。
 *
 * グループの区切りは「日々見る画面」「目標・前提の設定」「アカウント」の3つ。
 */
export const PRIMARY_NAV_GROUPS: PrimaryNavGroup[] = [
  {
    id: "data",
    items: [
      { screenId: "B1", label: "ダッシュボード", path: DASHBOARD_PATH, icon: LayoutDashboard },
      { screenId: "B2", label: "CSV取込", path: CSV_IMPORT_PATH, icon: FileUp },
      { screenId: "B3", label: "収支明細一覧", path: TRANSACTIONS_PATH, icon: ReceiptText },
      { screenId: "B4", label: "資産分類マスタ", path: ASSET_CATEGORIES_PATH, icon: Tags },
      { screenId: "B5", label: "不動産一覧", path: REAL_ESTATE_PATH, icon: Building2 },
    ],
  },
  {
    id: "planning",
    items: [
      { screenId: "B8", label: "FIRE目標設定", path: FIRE_GOAL_PATH, icon: Target },
      {
        screenId: "B9",
        label: "想定利回り・リスク設定",
        path: ASSUMPTION_SETTINGS_PATH,
        icon: TrendingUp,
      },
    ],
  },
  {
    id: "account",
    items: [
      { screenId: "B10", label: "アカウント設定", path: ACCOUNT_SETTINGS_PATH, icon: UserRoundCog },
    ],
  },
];

/** 全グループを平坦化した主要画面の一覧。パスから画面を引く用途で使う */
export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = PRIMARY_NAV_GROUPS.flatMap(
  (group) => group.items,
);

/**
 * パスに対応する主要画面を返す。ヘッダーの見出しに使う。
 *
 * B6・B7のようにサイドバーに出さない画面もあるため、見つからない場合は`undefined`を返し、
 * 呼び出し側で既定の見出しに落とす。
 */
export const findPrimaryNavItem = (pathname: string): PrimaryNavItem | undefined =>
  PRIMARY_NAV_ITEMS.find((item) => item.path === pathname);
