import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { JSX } from "react";

const CsvImportPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B2"
    screenName="CSV取込画面"
    purpose="マネーフォワードCSV(資産残高推移/入出金明細)をアップロードし取込む"
  />
);

export default CsvImportPage;
