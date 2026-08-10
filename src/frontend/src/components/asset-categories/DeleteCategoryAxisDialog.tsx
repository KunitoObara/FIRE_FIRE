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
  DELETE_CATEGORY_AXIS_UNDETERMINED_MESSAGE,
} from "@/constants/asset-categories";
import { resolveCategoryAxisDebtReferences } from "@/lib/asset-categories/debt-references";

import type { JSX, MouseEvent } from "react";

/**
 * 削除確認・削除禁止ダイアログ(B4の遷移条件「既存の資産データが紐づいている分類は
 * 削除を禁止し、エラーメッセージを表示する」)。
 *
 * 集計対象が1件以上ある分類は、この画面から辿れるダイアログの時点で禁止する
 * (先に編集で割り当てを解除すれば削除できるようになる)。
 *
 * **負債(`debtIds`)だけが紐づいている分類も同じく禁止する。** 集計対象が割り当てられた
 * 分類軸を消させないという制約を資産・負債で分ける理由が無いため(B4の遷移条件)。
 *
 * ただし**数えるのは実際に集計対象になっている負債だけ**で、参照の件数ではない(B4-3)。
 * B11で削除済みの負債しか参照していない分類軸は何も集計していないため、削除を止める
 * 理由が無い。`resolveCategoryAxisDebtReferences`が返す`activeIds`を使うので、一覧の
 * 件数表示・編集フォームの初期値と同じ判定になる。
 *
 * `firestore.rules`側は`assetTypeNames`しか見ない。負債の生死は別コレクションを引かないと
 * 分からず、ルールには繰り返しが無いため可変長の`debtIds`を1件ずつ確かめられないため
 * (firestore.rulesの`categoryAxes`のコメント)。したがって負債側についてはここが唯一の
 * 判定箇所になるが、これは表示制御であって保護ではない。
 */
export const DeleteCategoryAxisDialog = ({
  axis,
  debtOptions,
  onOpenChange,
  onConfirm,
}: DeleteCategoryAxisDialogProps): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const references =
    axis === null ? null : resolveCategoryAxisDebtReferences(axis.debtIds, debtOptions);

  // 負債の情報が揃っていないと削除してよいか決められない。安全側に倒して止めるが、
  // 「集計対象が紐づいている」とは言わない — 紐づいていると判明したわけではないため
  const undetermined = axis !== null && axis.debtIds.length > 0 && references === null;

  const blocked =
    axis !== null &&
    (axis.assetTypeNames.length > 0 || (references !== null && references.activeIds.length > 0));

  /**
   * 見出しと本文をここで決める。3状態あるので式の中で分岐させると三項が入れ子になり、
   * どの状態がどの文言に対応するかが読み取りにくくなる。
   */
  const resolveContent = (): { title: string; description: string } => {
    if (undetermined) {
      return {
        title: "この分類を削除できるか判定できません",
        description: DELETE_CATEGORY_AXIS_UNDETERMINED_MESSAGE,
      };
    }

    if (blocked) {
      return {
        title: "この分類は削除できません",
        description: DELETE_CATEGORY_AXIS_BLOCKED_MESSAGE,
      };
    }

    return {
      title: "この分類を削除しますか?",
      // `axis`が`null`のときダイアログは閉じていて中身は見えない
      description: axis === null ? "" : buildDeleteCategoryAxisConfirmMessage(axis.name),
    };
  };

  const { title, description } = resolveContent();

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
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription>{description}</AlertDialogDescription>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <AlertDialogFooter>
          {blocked || undetermined ? (
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
