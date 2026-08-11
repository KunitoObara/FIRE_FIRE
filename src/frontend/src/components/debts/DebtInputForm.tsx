"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { DeleteDebtsDialog } from "@/components/debts/DeleteDebtsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  buildDebtTotalLabel,
  buildDebtUpdatedAtLabel,
  DEBT_ADD_ROW_LABEL,
  DEBT_BALANCE_LABEL,
  DEBT_FAILURE_MESSAGES,
  DEBT_INTEREST_RATE_LABEL,
  DEBT_MAX_COUNT,
  DEBT_MAX_COUNT_REACHED_MESSAGE,
  DEBT_NAME_LABEL,
  DEBT_NOT_SAVED_LABEL,
  DEBT_OPTIONAL_SUFFIX,
  DEBT_ORIGINATED_ON_HINT,
  DEBT_ORIGINATED_ON_LABEL,
  DEBT_REAL_ESTATE_LOAN_NOTICE,
  DEBT_REMOVE_ROW_LABEL,
  DEBT_REPAYMENT_PERIOD_LABEL,
  DEBT_SAVE_NOTICE,
  DEBT_SCREEN_NOTICE,
  NO_DEBTS_LABEL,
} from "@/constants/debts";
import { ASSET_CATEGORIES_PATH, DASHBOARD_PATH, REAL_ESTATE_PATH } from "@/constants/routes";
import {
  buildDebtDeletionPreviews,
  collectAffectedAxisNames,
  sumDebtFormBalances,
} from "@/lib/debts/form-summary";
import { buildEmptyDebtRow, toDebtInputs, toDebtRowFormValues } from "@/lib/debts/form-values";
import { formatJpy } from "@/lib/format/currency";
import { debtFormSchema } from "@/schemas/debts";

import type { JSX } from "react";

/**
 * B11 負債入力画面のフォーム(docs/screen-requirements-dashboard.md B11)。
 *
 * 1件=1フォームに見える見た目だが、**フォームは画面に1つ**で`useFieldArray`が行を持つ
 * (DESIGN.md 6章)。行ごとに独立したフォーム状態を持たせて1件ずつ保存する形にすると、
 * 途中まで保存された状態が残る。負債は複数まとめて見直すことが多いため、画面全体を
 * 「保存」で一括保存する。
 *
 * 「負債を追加」「削除」はどちらも**画面上の行を増減するだけ**で、保存するまで確定しない。
 * したがって保存前の削除は取り消せる(画面を離れれば元に戻る)ので、削除ボタン自体には
 * 確認を挟まず、**保存時に既存の負債を削除する場合だけ**確認ダイアログを出す。
 */
export const DebtInputForm = ({ debts, axes, onSave }: DebtInputScreenProps): JSX.Element => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する(B7・A1と揃える)
    mode: "onTouched",
    defaultValues: { debts: debts.map(toDebtRowFormValues) },
  });

  /*
    `keyName`を既定の`id`から変えている。行そのものが`id`(負債のドキュメントID)を
    持っており、既定のままだと`useFieldArray`が採番する行キーに上書きされて、
    保存済みの負債を新規として書き込んでしまう。
  */
  const { fields, append, remove } = useFieldArray({ control, name: "debts", keyName: "rowKey" });

  const [pendingValues, setPendingValues] = useState<DebtFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // `watch()`はReact Compilerがメモ化できないため、購読には`useWatch`を使う
  const rows = useWatch({ control, name: "debts" });
  const total = sumDebtFormBalances(rows ?? []);

  const save = async (values: DebtFormValues): Promise<void> => {
    setPendingValues(null);
    setSaveError(null);
    setSaving(true);

    /*
      画面が読み込んだ時点のIDを基準として渡す。保存側がサーバーの最新状態を基準に
      削除対象を求めると、別のタブで追加された負債まで消える(`saveDebts`)。
      確認ダイアログの削除対象(`buildDebtDeletionPreviews`)も同じ`debts`から
      組み立てているので、ダイアログに出した負債と実際に消える負債が一致する
    */
    const result = await onSave(
      toDebtInputs(values),
      debts.map((debt) => debt.id),
    );

    setSaving(false);

    if (!result.ok) {
      // 保存に失敗しても画面の入力値は保持する(B11「保存はまとめて行い、一部だけ
      // 書き込まれた状態を残さない」)。書き直しをやり直させない
      setSaveError(DEBT_FAILURE_MESSAGES[result.reason]);
      return;
    }

    /*
      保存結果でフォームを組み直す。**これが無いと次の保存で残債の履歴が消える。**

      `defaultValues`はマウント時にしか効かず、保存後に`debts`propが取り直されても
      react-hook-formの内部状態は追随しない。画面上で追加した行は保存でIDが決まるのに、
      フォーム側は`id: null`のまま残るため、次の保存でその負債が「消して作り直し」に
      化ける — 触っていない負債が削除確認ダイアログに出て、確定すると元のドキュメントが
      履歴ごと削除され、同じ内容が別IDで作り直される。

      再取得(`invalidateQueries`)の到着を待つ形にはしない。届くまでの間にもう一度
      保存できてしまい、同じ経路を踏むため、保存が返した結果でその場で揃える。
      保存直後は未保存の編集が存在しないので、ここで組み直しても入力は失われない。
    */
    reset({ debts: result.debts.map(toDebtRowFormValues) });
  };

  const handleValidSubmit = async (values: DebtFormValues): Promise<void> => {
    const deletions = buildDebtDeletionPreviews(debts, values);

    if (deletions.length > 0) {
      // 確認を挟むのはここだけ。保存済みの負債が消える保存かどうかで分ける
      setPendingValues(values);
      return;
    }

    await save(values);
  };

  const pendingDeletions =
    pendingValues === null ? [] : buildDebtDeletionPreviews(debts, pendingValues);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      {/*
        手動入力・自動計算なしであることを最初に示す(要件定義書 4.8)。
        マネーフォワードが負債をCSVに出力しないため、この画面だけが負債の入り口になる
      */}
      <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">{DEBT_SCREEN_NOTICE}</p>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{buildDebtTotalLabel(fields.length)}</p>
            {/*
              負債の金額には必ずラベルを添える(DESIGN.md 3章)。`--destructive`は削除ボタンや
              入力エラーにも使う色なので、単独の赤い数字が警告に読まれないようにするため
            */}
            <p className="text-2xl font-bold text-destructive tabular-nums">{formatJpy(total)}</p>
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            ここで登録した負債は、
            <Link className="underline" href={ASSET_CATEGORIES_PATH}>
              資産分類マスタ
            </Link>
            で分類軸の集計対象に選ぶと、
            <Link className="underline" href={DASHBOARD_PATH}>
              ダッシュボード
            </Link>
            の資産から差し引かれます。
          </p>
        </CardContent>
      </Card>

      <form noValidate onSubmit={handleSubmit(handleValidSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {fields.map((field, index) => (
            /*
              `key`に配列インデックスを使わない(DESIGN.md 6章)。行を削除したときに
              残った行の入力値が1つずつずれるため、`useFieldArray`が採番する行キーを使う
            */
            <Card key={field.rowKey}>
              <CardContent className="flex items-start gap-4">
                <div className="flex flex-1 flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`debt-name-${field.rowKey}`}>
                        {DEBT_NAME_LABEL}
                      </FieldLabel>
                      <Input
                        id={`debt-name-${field.rowKey}`}
                        type="text"
                        autoComplete="off"
                        disabled={saving}
                        aria-invalid={errors.debts?.[index]?.name !== undefined}
                        {...register(`debts.${index}.name`)}
                      />
                      <FieldError errors={[errors.debts?.[index]?.name]} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`debt-balance-${field.rowKey}`}>
                        {DEBT_BALANCE_LABEL}
                      </FieldLabel>
                      {/*
                        `type="number"`にせず`inputMode="numeric"`のテキストにする。数値入力にすると
                        指数表記や全角数字の扱いがブラウザごとに変わり、「半角数字のみ」という判定を
                        画面側で揃えられない(検証は`debtFormSchema`が一手に引き受ける。B7と同じ)
                      */}
                      <Input
                        id={`debt-balance-${field.rowKey}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        className="tabular-nums"
                        disabled={saving}
                        aria-invalid={errors.debts?.[index]?.balance !== undefined}
                        {...register(`debts.${index}.balance`)}
                      />
                      <FieldError errors={[errors.debts?.[index]?.balance]} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/*
                      発生年月。資産推移グラフがこの月から負債を差し引き始める
                      (docs/screen-requirements-dashboard.md B1「発生年月からの反映」)。
                      残債の履歴はB11で保存したときにしか積まれないので、これが無いと
                      段差が「借りた月」ではなく「アプリに登録した月」に出る。
                      金額欄と違い`type="month"`にするのは、`yyyy-MM`の形をブラウザに
                      揃えさせるため(手入力の表記ゆれをこちらで正規化せずに済む)
                    */}
                    <Field>
                      <FieldLabel htmlFor={`debt-originated-on-${field.rowKey}`}>
                        {DEBT_ORIGINATED_ON_LABEL}
                        <span className="font-normal text-muted-foreground">
                          ・{DEBT_OPTIONAL_SUFFIX}
                        </span>
                      </FieldLabel>
                      <Input
                        id={`debt-originated-on-${field.rowKey}`}
                        type="month"
                        autoComplete="off"
                        className="tabular-nums"
                        disabled={saving}
                        aria-invalid={errors.debts?.[index]?.originatedOn !== undefined}
                        aria-describedby={`debt-originated-on-hint-${field.rowKey}`}
                        {...register(`debts.${index}.originatedOn`)}
                      />
                      <FieldError errors={[errors.debts?.[index]?.originatedOn]} />
                      {/*
                        入れても負債サマリ・円グラフ・ゲージの数字は変わらないので、
                        何のための欄かを添えないと入力されないまま残る(同要件B11)
                      */}
                      <p
                        id={`debt-originated-on-hint-${field.rowKey}`}
                        className="text-xs text-muted-foreground"
                      >
                        {DEBT_ORIGINATED_ON_HINT}
                      </p>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`debt-rate-${field.rowKey}`}>
                        {DEBT_INTEREST_RATE_LABEL}
                        <span className="font-normal text-muted-foreground">
                          ・{DEBT_OPTIONAL_SUFFIX}
                        </span>
                      </FieldLabel>
                      <Input
                        id={`debt-rate-${field.rowKey}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className="tabular-nums"
                        disabled={saving}
                        aria-invalid={errors.debts?.[index]?.interestRate !== undefined}
                        {...register(`debts.${index}.interestRate`)}
                      />
                      <FieldError errors={[errors.debts?.[index]?.interestRate]} />
                    </Field>

                    {/*
                      総月数だけを入力させると「残り23年4ヶ月」を月数へ直す計算をユーザーに
                      させることになる。年・ヶ月の2欄で受け取り、保存時に総月数へ正規化する
                      (片方だけの入力は空欄側を0として扱う。`toRepaymentMonths`)
                    */}
                    <Field>
                      <FieldLabel htmlFor={`debt-years-${field.rowKey}`}>
                        {DEBT_REPAYMENT_PERIOD_LABEL}
                        <span className="font-normal text-muted-foreground">
                          ・{DEBT_OPTIONAL_SUFFIX}
                        </span>
                      </FieldLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`debt-years-${field.rowKey}`}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label={`${DEBT_REPAYMENT_PERIOD_LABEL}(年)`}
                          className="tabular-nums"
                          disabled={saving}
                          aria-invalid={errors.debts?.[index]?.repaymentYears !== undefined}
                          {...register(`debts.${index}.repaymentYears`)}
                        />
                        <span className="shrink-0 text-sm text-muted-foreground">年</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label={`${DEBT_REPAYMENT_PERIOD_LABEL}(ヶ月)`}
                          className="tabular-nums"
                          disabled={saving}
                          aria-invalid={errors.debts?.[index]?.repaymentMonths !== undefined}
                          {...register(`debts.${index}.repaymentMonths`)}
                        />
                        <span className="shrink-0 text-sm text-muted-foreground">ヶ月</span>
                      </div>
                      <FieldError
                        errors={[
                          errors.debts?.[index]?.repaymentYears,
                          errors.debts?.[index]?.repaymentMonths,
                        ]}
                      />
                    </Field>
                  </div>

                  {/*
                    最終更新日は入力項目ではなく保存時に付く(B11)。手動更新の値がいつ時点の
                    ものか分からないと、B1の負債サマリの数字をどこまで信用してよいか判断できない
                  */}
                  <p className="text-xs text-muted-foreground">
                    {field.updatedAt === null
                      ? DEBT_NOT_SAVED_LABEL
                      : buildDebtUpdatedAtLabel(field.updatedAt)}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive"
                  disabled={saving}
                  onClick={() => remove(index)}
                >
                  {DEBT_REMOVE_ROW_LABEL}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{NO_DEBTS_LABEL}</p>
        ) : null}

        {/* 行を増やすだけの副次操作なので、保存ボタンより目立たせない(HTMLモックと同じ) */}
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          disabled={saving || fields.length >= DEBT_MAX_COUNT}
          onClick={() => append(buildEmptyDebtRow())}
        >
          <Plus />
          {DEBT_ADD_ROW_LABEL}
        </Button>

        {fields.length >= DEBT_MAX_COUNT ? (
          <p className="text-xs text-muted-foreground">{DEBT_MAX_COUNT_REACHED_MESSAGE}</p>
        ) : null}

        {saveError ? (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
          <p className="text-xs text-muted-foreground">{DEBT_SAVE_NOTICE}</p>
        </div>
      </form>

      {/*
        B7のローン残高との関係。注記が無いと、B7に入れたローンがダッシュボードに
        出ないことを不具合と読まれる(docs/screen-requirements-dashboard.md B11)
      */}
      <p className="border-t pt-4 text-xs text-muted-foreground">
        {DEBT_REAL_ESTATE_LOAN_NOTICE}
        <Link className="ml-1 underline" href={REAL_ESTATE_PATH}>
          不動産一覧
        </Link>
      </p>

      <DeleteDebtsDialog
        deletions={pendingDeletions}
        affectedAxisNames={collectAffectedAxisNames(axes, pendingDeletions)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingValues(null);
          }
        }}
        onConfirm={() => {
          if (pendingValues !== null) {
            void save(pendingValues);
          }
        }}
      />
    </div>
  );
};
