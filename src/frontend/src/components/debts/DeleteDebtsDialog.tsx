"use client";

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
  buildDeleteDebtLabel,
  buildDeleteDebtsAxisWarning,
  buildDeleteDebtsConfirmTitle,
  DELETE_DEBTS_CONFIRM_LABEL,
  DELETE_DEBTS_HISTORY_WARNING,
} from "@/constants/debts";

import type { JSX } from "react";

/**
 * 保存時の削除確認ダイアログ(docs/screen-requirements-dashboard.md B11「追加・削除と保存」)。
 *
 * 削除ボタン自体には確認を挟まない。画面上の「削除」は行を減らすだけで、保存するまで
 * 取り消せるため。**既存の負債を削除する保存のときだけ**このダイアログを挟む
 * (DESIGN.md 6章の「削除のブロッキング確認」)。
 *
 * 削除対象は項目名と残債額を並べて示す。項目名の重複を許す仕様のため、名前だけでは
 * 同名の負債が2件あるときにどちらが消えるのか確認できず、誤操作を防ぐという目的を果たせない。
 *
 * 分類軸は該当するものを**すべて列挙する**(B11)。件数だけを示すと、どの軸の集計が
 * 変わるかを確かめるためにB4を開き直させることになる。
 */
export const DeleteDebtsDialog = ({
  deletions,
  affectedAxisNames,
  onOpenChange,
  onConfirm,
}: DeleteDebtsDialogProps): JSX.Element => (
  <AlertDialog open={deletions.length > 0} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{buildDeleteDebtsConfirmTitle(deletions.length)}</AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription asChild>
        <div className="flex flex-col gap-3">
          <p>
            削除する負債:{" "}
            <span className="text-foreground">
              {deletions
                .map((deletion) => buildDeleteDebtLabel(deletion.name, deletion.balance))
                .join("、")}
            </span>
          </p>
          <p>{DELETE_DEBTS_HISTORY_WARNING}</p>
          {affectedAxisNames.length > 0 ? (
            <p>{buildDeleteDebtsAxisWarning(affectedAxisNames)}</p>
          ) : null}
        </div>
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel>キャンセル</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onConfirm}>
          {DELETE_DEBTS_CONFIRM_LABEL}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
