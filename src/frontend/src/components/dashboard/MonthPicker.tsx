"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CASHFLOW_MONTH_PICKER_NEXT_YEAR_LABEL,
  CASHFLOW_MONTH_PICKER_PREVIOUS_YEAR_LABEL,
  MONTH_PICKER_CLEAR_LABEL,
  MONTH_PICKER_UNSET_LABEL,
} from "@/constants/dashboard";
import { buildMonthKey, formatMonthLabel, yearOfMonthKey } from "@/lib/dashboard/month";

import type { JSX } from "react";

/** 月グリッドに並べる1〜12月 */
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * 年月(`yyyy-MM`)を選ぶピッカー(B1の収支サマリ)。
 *
 * shadcnのDate Pickerと同じ「ボタン+ポップオーバー」の形を採るが、**中身は月のグリッドを
 * 自前で組む**(docs/screen-requirements-dashboard.md B1「年月の選択」)。shadcnの`calendar`
 * (react-day-picker)は日単位の選択しか持たず、月・年のドロップダウンは表示月を移動するための
 * ものなので、確定には日をクリックさせることになる。選んだ日が結果に一切効かない操作を
 * 画面に置かないため、日のグリッドは使わない。
 *
 * **選べる上限は`maxMonth`(当月)。** それより後の月は押せない。未来の月には数える取引が無く、
 * URLで直接指定されても当月に丸める(`resolveMonthId`)ので、ここで選ばせると押した先で
 * 当月に戻る操作を残すことになる。**下限は設けない** — 取り込んである最も古い月をこの画面は
 * 知らない(読むのは選択中の1ヶ月だけ。docs/transaction-import-requirements.md 8章)。
 *
 * 前月/翌月の矢印は併置しない(同要件)。開けば隣の月も同じ操作数で選べる。
 *
 * **`month`は空文字を「未設定」として受け付ける。** B7取得年月・B11発生年月は任意入力で、
 * 一度選んだ後でも未設定に戻せる必要がある(`clearable`)。B1の収支サマリは常に実在する月を
 * 渡すので、この状態には入らない。
 */
export const MonthPicker = ({
  month,
  maxMonth,
  label,
  id,
  clearable = false,
  disabled = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onSelect,
  onBlur,
}: MonthPickerProps): JSX.Element => {
  /*
    開閉とグリッドが表示している年。**どちらもURLには載せない。** 押して確定するまで表示は
    変わらないので、リンク共有やブラウザの戻る/進むで再現すべき状態ではない
    (CODING_STANDARDS.md 2章の「URLに載せる必要のない一時的な状態」)。

    開閉を自分で持つのは、**月を押したときに閉じる**ため。Radixのポップオーバーは中身の
    ボタンを押しても閉じないので、開いたまま残ると選んだ結果(カードの数字)が隠れる。
  */
  const [open, setOpen] = useState(false);
  // 未設定(空文字)の間は`maxMonth`の年を初期表示にする。`yearOfMonthKey("")`は日付として読めない
  const [displayedYear, setDisplayedYear] = useState(() =>
    yearOfMonthKey(month === "" ? maxMonth : month),
  );

  const maxYear = yearOfMonthKey(maxMonth);

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);

    /*
      開くたびに選択中の月の年へ戻す。年を送ったまま閉じた状態を覚えていると、次に開いたときに
      選択中の月がグリッドに無く、「いまどの月を見ているか」と表示がずれる
    */
    if (nextOpen) {
      setDisplayedYear(yearOfMonthKey(month === "" ? maxMonth : month));
    }
  };

  const handleSelect = (value: string): void => {
    setOpen(false);
    onSelect(value);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          className="tabular-nums"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          onBlur={onBlur}
        >
          {/*
            見えている文字を読み上げの名前にしたいので、ラベルは視覚的に隠して添える。
            外側に`<label htmlFor>`(id指定時)がある呼び出し側では、そちらの表示文言が
            読み上げ名として優先されるため、実質的には冗長だが害はない。
          */}
          <span className="sr-only">{label}</span>
          {month === "" ? MONTH_PICKER_UNSET_LABEL : formatMonthLabel(month)}
          <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={CASHFLOW_MONTH_PICKER_PREVIOUS_YEAR_LABEL}
            onClick={() => setDisplayedYear(displayedYear - 1)}
          >
            <ChevronLeftIcon aria-hidden className="size-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{displayedYear}年</span>
          {/* 当月より後は選べないので、上限の年を表示中は次の年へ進めない */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={CASHFLOW_MONTH_PICKER_NEXT_YEAR_LABEL}
            disabled={displayedYear >= maxYear}
            onClick={() => setDisplayedYear(displayedYear + 1)}
          >
            <ChevronRightIcon aria-hidden className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_NUMBERS.map((monthNumber) => {
            const value = buildMonthKey(displayedYear, monthNumber);
            const selected = value === month;

            return (
              <Button
                key={monthNumber}
                type="button"
                variant={selected ? "default" : "ghost"}
                size="sm"
                className="tabular-nums"
                /*
                  色だけでなく選択状態も属性で表す。`yyyy-MM`は桁が揃っているので、上限の判定は
                  文字列の比較でそのまま時系列の比較になる
                */
                aria-pressed={selected}
                disabled={value > maxMonth}
                onClick={() => handleSelect(value)}
              >
                {monthNumber}月
              </Button>
            );
          })}
        </div>
        {clearable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full"
            disabled={month === ""}
            onClick={() => handleSelect("")}
          >
            {MONTH_PICKER_CLEAR_LABEL}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
