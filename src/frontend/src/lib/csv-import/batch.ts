/**
 * CSV取込の書き込みを`writeBatch`の上限ごとに区切るためのヘルパー。
 *
 * 資産残高推移(`asset-balance-repository.ts`)と入出金明細(`transaction-repository.ts`)が
 * 同じ形で分割するため、片方に閉じず共有する。
 */

/** 配列を`size`件ずつに区切る。端数はそのまま最後の塊になる */
export const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_unused, index) =>
    items.slice(index * size, (index + 1) * size),
  );
