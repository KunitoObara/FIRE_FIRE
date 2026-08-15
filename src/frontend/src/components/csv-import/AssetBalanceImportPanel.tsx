"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { CsvDropzone } from "@/components/csv-import/CsvDropzone";
import { CsvPreviewTable } from "@/components/csv-import/CsvPreviewTable";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildImportSuccessMessage,
  buildPartialImportNotice,
  CSV_IMPORT_FAILURE_MESSAGES,
  CSV_PARSE_FAILURE_MESSAGES,
  CSV_PREVIEW_ROW_LIMIT,
  MAX_CSV_FILE_BYTES,
} from "@/constants/csv-import";
import { parseAssetBalanceCsv } from "@/lib/csv/asset-balance-csv";
import { decodeCsvBytes } from "@/lib/csv/decode";
import { buildImportPlan, importAssetBalances } from "@/lib/csv-import/asset-balance-repository";

import type { JSX } from "react";

/** 画面の状態。プレビューを挟んでから取り込むため、選択直後に確定させない */
type PanelStatus = "idle" | "reading" | "previewing" | "importing";

/** プレビューに出す行。CSVは新しい日付が先頭なので、見慣れた並びに戻して最新から見せる */
const toPreviewRows = (rows: AssetBalanceRow[]): AssetBalanceRow[] =>
  rows.slice(-CSV_PREVIEW_ROW_LIMIT).reverse();

/**
 * 資産残高推移CSVの取込(B2の主要動線)。
 *
 * 「ファイル選択 → パース → プレビューで実行前確認 → 取込を実行/キャンセル」の流れを持つ。
 * パースに失敗した場合はエラーだけを出し、取込不可のまま画面に留まる
 * (docs/screen-requirements-dashboard.md B2の遷移条件)。
 *
 * パースはブラウザ側で行う。プレビューのために一度読む必要があり、サーバーへ送ってから
 * 確認させると同じファイルを2度送ることになるため。
 */
export const AssetBalanceImportPanel = ({
  onImported,
}: AssetBalanceImportPanelProps): JSX.Element => {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<AssetBalanceParsed | null>(null);
  const [plan, setPlan] = useState<AssetBalanceImportPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * 何回目の選択かを表す番号。読み込みの途中で別のファイルを選び直したり
   * キャンセルしたりしたときに、先に始まった処理の結果を捨てるために使う。
   *
   * これが無いと、遅れて解決した古いファイルのプレビューが新しい選択を上書きし、
   * 画面に出ているファイル名と取り込まれる中身が食い違う。
   */
  const selectionIdRef = useRef(0);

  /** この処理より後に選択・キャンセルが入っていたら、結果はもう要らない */
  const isStale = (selectionId: number): boolean => selectionIdRef.current !== selectionId;

  /** ファイル未選択の状態に戻す(「キャンセル」と取込完了後の後始末) */
  const reset = (): void => {
    // 読み込み中のファイルがあれば、その結果も捨てる
    selectionIdRef.current += 1;
    setStatus("idle");
    setFileName(null);
    setParsed(null);
    setPlan(null);
    setErrorMessage(null);
  };

  const failParse = (message: string): void => {
    setStatus("idle");
    setParsed(null);
    setPlan(null);
    setErrorMessage(message);
  };

  const handleFileSelect = async (file: File): Promise<void> => {
    selectionIdRef.current += 1;
    const selectionId = selectionIdRef.current;

    setFileName(file.name);
    setParsed(null);
    setPlan(null);
    setErrorMessage(null);
    setStatus("reading");

    if (file.size > MAX_CSV_FILE_BYTES) {
      failParse(CSV_PARSE_FAILURE_MESSAGES["too-large"]);
      return;
    }

    let text: string;

    try {
      text = decodeCsvBytes(await file.arrayBuffer());
    } catch (error) {
      console.error("CSVファイルを読み取れませんでした", error);

      if (!isStale(selectionId)) {
        failParse(CSV_PARSE_FAILURE_MESSAGES.unreadable);
      }
      return;
    }

    if (isStale(selectionId)) {
      return;
    }

    const result = parseAssetBalanceCsv(text);

    if (!result.ok) {
      const detail = result.detail === undefined ? "" : `(${result.detail})`;
      failParse(`${CSV_PARSE_FAILURE_MESSAGES[result.reason]}${detail}`);
      return;
    }

    setParsed(result.parsed);
    setStatus("previewing");

    // 上書きになる件数は既存データを引いて初めて分かる。ここで失敗してもプレビュー自体は
    // 成立するため、取込をやめさせずに件数の表示だけを諦める
    const planResult = await buildImportPlan(result.parsed);

    if (isStale(selectionId)) {
      return;
    }

    setPlan(planResult.ok ? planResult.plan : null);
  };

  const handleImport = async (): Promise<void> => {
    if (parsed === null || fileName === null) {
      return;
    }

    setStatus("importing");
    setErrorMessage(null);

    const result = await importAssetBalances(parsed, fileName);

    if (!result.ok) {
      setStatus("previewing");

      // 途中まで確定してしまった場合は、それを伏せずに次の行動まで伝える
      const partial =
        result.writtenCount > 0 && result.reason !== "history-write-failed"
          ? ` ${buildPartialImportNotice(result.writtenCount)}`
          : "";
      setErrorMessage(`${CSV_IMPORT_FAILURE_MESSAGES[result.reason]}${partial}`);

      if (result.writtenCount > 0) {
        // 実際にデータは変わっているので、取込履歴の表示を取り直させる
        onImported();
      }
      return;
    }

    // 要件どおり画面には留まり、続けて別のファイルを取り込めるようにする
    toast.success(buildImportSuccessMessage(result.writtenCount));
    reset();
    onImported();
  };

  const busy = status === "reading" || status === "importing";

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <CsvDropzone
          fileName={fileName}
          disabled={busy}
          onFileSelect={(file) => {
            void handleFileSelect(file);
          }}
        />

        {status === "reading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            ファイルを読み込んでいます…
          </p>
        ) : null}

        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

        {parsed ? (
          <div className="flex flex-col gap-4">
            {/*
              モック b2-csv-import.html のプレビュー欄は `alert-info`。取込前に内容を
              確かめてもらう案内なので、`role="status"` と `data-testid` はそのまま残す。
            */}
            <Alert variant="info" role="status" data-testid="csv-import-summary">
              <p>
                取込対象: <strong className="tabular-nums">{parsed.rows.length}件</strong>(期間:{" "}
                <span className="tabular-nums">
                  {parsed.periodFrom}〜{parsed.periodTo}
                </span>
                )
                {plan ? (
                  <>
                    {" / "}
                    新規 <span className="tabular-nums">{plan.newCount}件</span>・上書き{" "}
                    <span className="tabular-nums">{plan.updatedCount}件</span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-muted-foreground">
                資産種別: {parsed.assetTypes.length === 0 ? "なし" : parsed.assetTypes.join("、")}
              </p>
              <p className="mt-1 text-muted-foreground">
                内容を確認のうえ取込を実行してください。同じ日付のデータは上書きされます。
              </p>
            </Alert>

            <CsvPreviewTable assetTypes={parsed.assetTypes} rows={toPreviewRows(parsed.rows)} />
            <p className="text-xs text-muted-foreground">
              新しい日付から最大{CSV_PREVIEW_ROW_LIMIT}件を表示しています。
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  void handleImport();
                }}
              >
                {status === "importing" ? "取込中…" : "取込を実行する"}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={reset}>
                キャンセル
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
