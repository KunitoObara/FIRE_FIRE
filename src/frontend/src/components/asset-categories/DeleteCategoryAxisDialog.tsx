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
  DELETE_CATEGORY_AXIS_UNDETERMINED_MESSAGES,
} from "@/constants/asset-categories";
import { resolveCategoryAxisDebtReferences } from "@/lib/asset-categories/debt-references";
import { resolveCategoryAxisPropertyReferences } from "@/lib/asset-categories/property-references";

import type { JSX, MouseEvent } from "react";

/**
 * 削除確認・削除禁止ダイアログ(B4の遷移条件「既存の資産データが紐づいている分類は
 * 削除を禁止し、エラーメッセージを表示する」)。
 *
 * 集計対象が1件以上ある分類は、この画面から辿れるダイアログの時点で禁止する
 * (先に編集で割り当てを解除すれば削除できるようになる)。
 *
 * **負債(`debtIds`)だけ・物件(`propertyValuations`)だけが紐づいている分類も同じく禁止する。**
 * 集計対象が割り当てられた分類軸を消させないという制約を資産・負債・不動産で分ける理由が
 * 無いため(B4の遷移条件)。
 *
 * ただし**数えるのは実際に集計対象になっている負債だけ**で、参照の件数ではない(B4-3)。
 * B11で削除済みの負債しか参照していない分類軸は何も集計していないため、削除を止める
 * 理由が無い。`resolveCategoryAxisDebtReferences`が返す`activeIds`を使うので、一覧の
 * 件数表示・編集フォームの初期値と同じ判定になる。
 *
 * `firestore.rules`側は`assetTypeNames`しか見ない。負債・物件の生死は別コレクションを引かないと
 * 分からず、ルールには繰り返しが無いため可変長の`debtIds` / `propertyValuations`を1件ずつ
 * 確かめられないため(firestore.rulesの`categoryAxes`のコメント)。したがって負債・不動産側に
 * ついてはここが唯一の判定箇所になるが、これは表示制御であって保護ではない。
 */
export const DeleteCategoryAxisDialog = ({
  axis,
  debtOptions,
  propertyOptions,
  onOpenChange,
  onConfirm,
}: DeleteCategoryAxisDialogProps): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const references =
    axis === null ? null : resolveCategoryAxisDebtReferences(axis.debtIds, debtOptions);

  const propertyReferences =
    axis === null
      ? null
      : resolveCategoryAxisPropertyReferences(axis.propertyValuations, propertyOptions);

  const blocked =
    axis !== null &&
    (axis.assetTypeNames.length > 0 ||
      (references !== null && references.activeIds.length > 0) ||
      (propertyReferences !== null && Object.keys(propertyReferences.activeValuations).length > 0));

  /**
   * 負債の情報が揃っていないと削除してよいか決められない状態。安全側に倒して止めるが、
   * 「集計対象が紐づいている」とは言わない — 紐づいていると判明したわけではないため。
   *
   * **資産種別が1件でもある軸はここに含めない。** その軸は負債の情報が取れても削除できない
   * ままなので、「時間をおいてもう一度」と促す文言を出すと、永久に叶わない再試行を勧める
   * ことになる。確定してブロックされる軸は`blocked`側の文言で扱う。
   *
   * **`blocked`を条件に入れて排他にしてある。** 負債と不動産で状態が揃わないことがあり
   * (負債は取得済みで集計対象あり、物件は読み込み中、など)、片方だけを見ると「削除できない」と
   * 「判定できない」が同時に成立しうるため。確定してブロックされるならそちらを優先する。
   */
  const undetermined =
    axis !== null &&
    axis.assetTypeNames.length === 0 &&
    !blocked &&
    ((axis.debtIds.length > 0 && references === null) ||
      (Object.keys(axis.propertyValuations).length > 0 && propertyReferences === null));

  /**
   * 判定できない原因が**取得失敗**かどうか。読み込み中なら待てば解決するので、文言を分ける。
   *
   * 見るのは**その分類軸が参照している側**だけ。負債しか参照していない軸で、無関係な物件側の
   * 取得が失敗しているだけなら、待てば判定できる状態に変わりない。
   */
  const blockingFailure =
    axis !== null &&
    ((axis.debtIds.length > 0 && debtOptions.status === "error") ||
      (Object.keys(axis.propertyValuations).length > 0 && propertyOptions.status === "error"));

  /**
   * 見出しと本文をここで決める。3状態あるので式の中で分岐させると三項が入れ子になり、
   * どの状態がどの文言に対応するかが読み取りにくくなる。
   */
  const resolveContent = (): { title: string; description: string } => {
    if (undetermined) {
      return {
        title: "この分類を削除できるか判定できません",
        /*
          **その分類軸が参照している側の失敗だけを見る。** 画面全体で共有している取得状態を
          そのまま見ると、負債しか参照していない軸で「負債は読み込み中・物件(無関係)は
          取得失敗」のときに再試行を促すことになる。実際には待てば判定できる状態なので、
          恒久的な失敗であるかのような案内になってしまう([PR #154](https://github.com/KunitoObara/FIRE_FIRE/pull/154) のレビュー指摘)。

          「負債と不動産で文言を分けない」判断はそのまま — 分けていないのは文言であって、
          どちらの取得状態を見るかではない
        */
        description: blockingFailure
          ? DELETE_CATEGORY_AXIS_UNDETERMINED_MESSAGES.error
          : DELETE_CATEGORY_AXIS_UNDETERMINED_MESSAGES.loading,
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
