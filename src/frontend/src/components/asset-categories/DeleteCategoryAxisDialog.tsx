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
  buildDeleteCategoryAxisConfirmMessage,
  CATEGORY_AXIS_FAILURE_MESSAGES,
  DELETE_CATEGORY_AXIS_BLOCKED_MESSAGE,
} from "@/constants/asset-categories";

import type { JSX, MouseEvent } from "react";

/**
 * 削除確認・削除禁止ダイアログ(B4の遷移条件「既存の資産データが紐づいている分類は
 * 削除を禁止し、エラーメッセージを表示する」)。
 *
 * 集計対象が1件以上ある分類は、この画面から辿れるダイアログの時点で禁止する
 * (先に編集で割り当てを解除すれば削除できるようになる)。`firestore.rules`側にも
 * 同じ条件を書いており、ここでの判定は表示の分岐であって保護そのものではない。
 *
 * **負債(`debtIds`)だけが紐づいている分類も同じく禁止する。** 集計対象が割り当てられた
 * 分類軸を消させないという制約を資産・負債で分ける理由が無いため(B4の遷移条件)。
 */
export const DeleteCategoryAxisDialog = ({
  axis,
  onOpenChange,
  onConfirm,
}: DeleteCategoryAxisDialogProps): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const blocked = axis !== null && (axis.assetTypeNames.length > 0 || axis.debtIds.length > 0);

  const handleOpenChange = (next: boolean): void => {
    if (submitting) {
      return;
    }
    setErrorMessage(null);
    onOpenChange(next);
  };

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    // 失敗時はダイアログを開いたままエラーを表示したいため、既定の自動クローズを止める
    event.preventDefault();

    if (axis === null) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const result = await onConfirm(axis);

    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(CATEGORY_AXIS_FAILURE_MESSAGES[result.reason]);
      return;
    }

    onOpenChange(false);
  };

  return (
    <AlertDialog open={axis !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocked ? "この分類は削除できません" : "この分類を削除しますか?"}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription>
          {blocked
            ? DELETE_CATEGORY_AXIS_BLOCKED_MESSAGE
            : axis !== null && buildDeleteCategoryAxisConfirmMessage(axis.name)}
        </AlertDialogDescription>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <AlertDialogFooter>
          {blocked ? (
            <AlertDialogAction onClick={() => onOpenChange(false)}>閉じる</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={submitting}>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={submitting}
                onClick={handleConfirm}
              >
                {submitting ? "削除中..." : "削除する"}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
