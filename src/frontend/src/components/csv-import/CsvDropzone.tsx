"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CSV_FILE_ACCEPT } from "@/constants/csv-import";

import type { DragEvent, JSX } from "react";

const FILE_INPUT_ID = "csv-import-file";

/**
 * CSVファイルの受け口(B2の入力項目「CSVファイル選択」)。
 *
 * ドラッグ&ドロップとファイル選択ダイアログの両方から同じ`onFileSelect`に流す。
 * ファイルの検証・パースは呼び出し側の責務にして、ここは受け取るところまでを担う。
 */
export const CsvDropzone = ({
  fileName,
  disabled,
  onFileSelect,
}: CsvDropzoneProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null): void => {
    const file = files?.item(0);

    if (file) {
      onFileSelect(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);

    if (!disabled) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    // 既定の動作のままだとブラウザがファイルを開いてしまい、画面から離れる
    event.preventDefault();
    setDragging(true);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      className={
        dragging
          ? "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary bg-accent py-10"
          : "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10"
      }
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden />
      <p className="px-4 text-center text-sm text-muted-foreground">
        マネーフォワードからエクスポートしたCSVファイルをドラッグ&ドロップ、または
      </p>
      {/*
        ファイル選択ダイアログはinput自身をクリックしないと開けないため、
        inputは隠したうえでボタンから発火させる(見た目だけを差し替える)
      */}
      <input
        ref={inputRef}
        id={FILE_INPUT_ID}
        type="file"
        aria-label="CSVファイル"
        accept={CSV_FILE_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={() => {
          const input = inputRef.current;

          if (input === null) {
            return;
          }

          handleFiles(input.files);
          // 同じファイルを選び直したときにもchangeが起きるように値を空へ戻す
          input.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        ファイルを選択
      </Button>
      {fileName === null ? null : (
        <p className="px-4 text-center text-xs text-muted-foreground">選択中: {fileName}</p>
      )}
    </div>
  );
};
