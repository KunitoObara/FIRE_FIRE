"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  buildDeleteRealEstateAxisWarning,
  buildDeleteRealEstateConfirmTitle,
  DELETE_REAL_ESTATE_AXES_UNKNOWN_WARNING,
  DELETE_REAL_ESTATE_CONFIRM_LABEL,
  DELETE_REAL_ESTATE_HISTORY_WARNING,
  DELETE_REAL_ESTATE_IRREVERSIBLE_WARNING,
  DELETE_REAL_ESTATE_SUBMITTING_LABEL,
  REAL_ESTATE_FAILURE_MESSAGES,
} from "@/constants/real-estate";

import type { JSX, MouseEvent } from "react";

/**
 * 物件の削除確認ダイアログ(docs/screen-requirements-real-estate.md「物件の削除」)。
 *
 * 削除は元に戻せないので必ず確認を挟む(DESIGN.md 6章の「削除のブロッキング確認」)。
 * 出すのは3つ — **どの物件を消すのか**(見出しの物件名)、**履歴も消えて資産推移グラフから
 * 過去に遡って額が消えること**、**その物件を集計対象にしている分類軸**である。
 *
 * 分類軸は該当するものを**すべて列挙する**(B11の負債削除と同じ)。件数だけを示すと、
 * どの軸の集計が変わるかを確かめるためにB4を開き直させることになる。
 *
 * **分類軸を取得できていないときも削除は止めない。** 分類軸の情報は影響の説明であって
 * 削除の可否を決めるものではなく、無関係な取得失敗で物件の整理ができなくなるほうが困る
 * (B4の削除判定とは事情が違う)。ただし黙って省くと「影響する軸が無い」と読めてしまうため、
 * 確かめられなかったこと自体を出す(PO判断)。
 */
export const DeleteRealEstateDialog = ({
  property,
  affectedAxisNames,
  onOpenChange,
  onConfirm,
}: DeleteRealEstateDialogProps): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = (next: boolean): void => {
    // 削除中は閉じさせない。閉じた先で結果を伝える場所が無くなる
    if (submitting) {
      return;
    }

    setErrorMessage(null);
    onOpenChange(next);
  };

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    // 失敗時はダイアログを開いたままエラーを表示したいため、既定の自動クローズを止める
    event.preventDefault();

    setSubmitting(true);
    setErrorMessage(null);

    const result = await onConfirm();

    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(REAL_ESTATE_FAILURE_MESSAGES[result.reason]);
      return;
    }

    // 成功時は呼び出し側がB5へ遷移させる。ここで閉じる必要は無い
  };

  return (
    <AlertDialog open={property !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {/* `property`が`null`のときダイアログは閉じていて中身は見えない */}
            {property === null ? "" : buildDeleteRealEstateConfirmTitle(property.name)}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-3">
            <p>{DELETE_REAL_ESTATE_IRREVERSIBLE_WARNING}</p>
            <p>{DELETE_REAL_ESTATE_HISTORY_WARNING}</p>
            {affectedAxisNames.status === "unknown" ? (
              <p>{DELETE_REAL_ESTATE_AXES_UNKNOWN_WARNING}</p>
            ) : null}
            {affectedAxisNames.status === "ready" && affectedAxisNames.axisNames.length > 0 ? (
              <p>{buildDeleteRealEstateAxisWarning(affectedAxisNames.axisNames)}</p>
            ) : null}
          </div>
        </AlertDialogDescription>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>キャンセル</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={submitting} onClick={handleConfirm}>
            {submitting ? DELETE_REAL_ESTATE_SUBMITTING_LABEL : DELETE_REAL_ESTATE_CONFIRM_LABEL}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
