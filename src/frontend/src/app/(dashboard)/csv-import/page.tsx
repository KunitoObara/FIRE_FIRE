import { CsvImportScreen } from "@/components/csv-import/CsvImportScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "CSV取込 | FIRE-FIRE",
};

/**
 * B2 CSV取込画面(docs/screen-requirements-dashboard.md B2)。
 *
 * 対応するのはマネーフォワードの「資産推移」CSV(資産残高推移)まで。入出金明細は
 * 要件定義書7章のPhase 2の範囲で、タブに案内だけを出す。
 */
const CsvImportPage = (): JSX.Element => <CsvImportScreen />;

export default CsvImportPage;
