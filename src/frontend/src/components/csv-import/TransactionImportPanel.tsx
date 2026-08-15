"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CsvDropzone } from "@/components/csv-import/CsvDropzone";
import { TransactionPreviewTable } from "@/components/csv-import/TransactionPreviewTable";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildImportSuccessMessage,
  CSV_PREVIEW_ROW_LIMIT,
  MAX_CSV_FILE_BYTES,
} from "@/constants/csv-import";
import {
  buildTransactionPartialImportNotice,
  TRANSACTION_CSV_PARSE_FAILURE_MESSAGES,
  TRANSACTION_IMPORT_FAILURE_MESSAGES,
} from "@/constants/transactions-import";
import { decodeCsvBytes } from "@/lib/csv/decode";
import { parseTransactionCsv } from "@/lib/csv/transaction-csv";
import {
  summarizeExcludedTransactions,
  toTransactionPreviewRows,
} from "@/lib/csv-import/transaction-preview";
import {
  buildTransactionImportPlan,
  importTransactions,
} from "@/lib/csv-import/transaction-repository";

import type { JSX } from "react";

/** 画面の状態。プレビューを挟んでから取り込むため、選択直後に確定させない */
type PanelStatus = "idle" | "reading" | "previewing" | "importing";

/**
 * 入出金明細CSVの取込(B2の入出金明細タブ)。
 *
 * 流れは資産残高推移タブ(`AssetBalanceImportPanel`)と同じ「ファイル選択 → パース →
 * プレビューで実行前確認 → 取込を実行/キャンセル」で、パース失敗時はエラーだけを出して
 * 取込不可のまま画面に留まる(docs/screen-requirements-dashboard.md B2の遷移条件)。
 *
 * **中身は資産残高推移と共有していない。** パース・既存データの照会・取込・失敗時の文言・
 * プレビュー表のいずれも種別ごとに別物で(同B2「取込種別ごとの違い」)、共有できるのは
 * 状態遷移の骨組みだけになる。骨組みを取り出すには型引数を3つ持つhookを作って
 * 動いている資産残高推移側も書き換えることになるため、ここでは持ち込まない。
 *
 * プレビューには件数・期間・サンプル行に加え、**集計から外れる件数**と**新規/上書きの内訳**を
 * 出す(docs/transaction-import-requirements.md 7章)。振替だらけのファイルを取り込んで
 * B1の収支サマリが動かないとき、その理由が取込の前に分かるようにするため。
 */
export const TransactionImportPanel = ({
  onImported,
}: TransactionImportPanelProps): JSX.Element => {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<TransactionCsvParsed | null>(null);
  const [plan, setPlan] = useState<TransactionImportPlan | null>(null);
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
      failParse(TRANSACTION_CSV_PARSE_FAILURE_MESSAGES["too-large"]);
      return;
    }

    let text: string;

    try {
      text = decodeCsvBytes(await file.arrayBuffer());
    } catch (error) {
      console.error("CSVファイルを読み取れませんでした", error);

      if (!isStale(selectionId)) {
        failParse(TRANSACTION_CSV_PARSE_FAILURE_MESSAGES.unreadable);
      }
      return;
    }

    if (isStale(selectionId)) {
      return;
    }

    const result = parseTransactionCsv(text);

    if (!result.ok) {
      const detail = result.detail === undefined ? "" : `(${result.detail})`;
      failParse(`${TRANSACTION_CSV_PARSE_FAILURE_MESSAGES[result.reason]}${detail}`);
      return;
    }

    setParsed(result.parsed);
    setStatus("previewing");

    // 上書きになる件数は既存データを引いて初めて分かる。ここで失敗してもプレビュー自体は
    // 成立するため、取込をやめさせずに件数の表示だけを諦める
    const planResult = await buildTransactionImportPlan(result.parsed);

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

    const result = await importTransactions(parsed, fileName);

    if (!result.ok) {
      setStatus("previewing");

      // 途中まで確定してしまった場合は、それを伏せずに次の行動まで伝える
      const partial =
        result.writtenCount > 0 && result.reason !== "history-write-failed"
          ? ` ${buildTransactionPartialImportNotice(result.writtenCount)}`
          : "";
      setErrorMessage(`${TRANSACTION_IMPORT_FAILURE_MESSAGES[result.reason]}${partial}`);

      if (result.writtenCount > 0) {
        // 実際にデータは変わっているので、取込履歴とB1・B3の表示を取り直させる
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
  // 取込は最大20,000行(`MAX_TRANSACTION_ROWS`)まで受けるので、取込中・キャンセル等の
  // 再描画のたびに数え直さない。ファイルが変わったときだけ数える
  const exclusion = useMemo(() => summarizeExcludedTransactions(parsed?.rows ?? []), [parsed]);

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
            <Alert variant="info" role="status" data-testid="transaction-import-summary">
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
                収支の集計から外れる取引:{" "}
                <span className="tabular-nums">{exclusion.excludedCount}件</span>
                {exclusion.excludedCount > 0 ? (
                  <>
                    (振替 <span className="tabular-nums">{exclusion.transferCount}件</span>・
                    計算対象外{" "}
                    <span className="tabular-nums">{exclusion.nonCalculationTargetCount}件</span>)
                  </>
                ) : null}
                。いずれも取り込まれ、B3の収支明細一覧には表示されます。
              </p>
              <p className="mt-1 text-muted-foreground">
                内容を確認のうえ取込を実行してください。同じ取引IDのデータは上書きされます。
              </p>
            </Alert>

            <TransactionPreviewTable rows={toTransactionPreviewRows(parsed.rows)} />
            <p className="text-xs text-muted-foreground">
              CSVの先頭から最大{CSV_PREVIEW_ROW_LIMIT}件を表示しています。
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
