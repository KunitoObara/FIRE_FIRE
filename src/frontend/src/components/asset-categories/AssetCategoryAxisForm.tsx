"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ASSET_TYPE_OPTIONS_LOADING_LABEL,
  ASSET_TYPE_OPTIONS_UNAVAILABLE_NOTICE,
  buildCategoryAxisMissingDebtMessage,
  CATEGORY_AXIS_ALL_TYPES_HINT,
  CATEGORY_AXIS_ASSET_TYPE_GROUP_LABEL,
  CATEGORY_AXIS_DEBT_GROUP_LABEL,
  CATEGORY_AXIS_FAILURE_MESSAGES,
  CATEGORY_AXIS_NAME_REQUIRED_MESSAGE,
  CATEGORY_AXIS_NAME_TOO_LONG_MESSAGE,
  CATEGORY_AXIS_NO_DEBT_HINT,
  DEBT_OPTIONS_LOADING_LABEL,
  DEBT_OPTIONS_UNAVAILABLE_NOTICE,
  NO_ASSET_TYPE_OPTIONS_NOTICE,
  NO_DEBT_OPTIONS_NOTICE,
} from "@/constants/asset-categories";
import { formatJpy } from "@/lib/format/currency";
import { categoryAxisFormSchema } from "@/schemas/asset-categories";

import type { JSX } from "react";

const NAME_INPUT_ID = "category-axis-name";

/**
 * 分類軸の追加・編集フォーム(B4の入力項目)。
 *
 * 新規追加・編集の両方で使う(HTMLモックの「新規分類」セクションと同じ構成)。
 * B4はDESIGN.md 6章のreact-hook-form必須画面に含まれないため、送信直前にzodスキーマで
 * 確かめるだけのシンプルな状態管理にしている。
 */
export const AssetCategoryAxisForm = ({
  initialValues,
  assetTypeOptions,
  debtOptions,
  missingDebtCount,
  submitLabel,
  onSubmit,
  onCancel,
}: AssetCategoryAxisFormProps): JSX.Element => {
  const [name, setName] = useState(initialValues.name);
  const [assetTypeNames, setAssetTypeNames] = useState<string[]>(initialValues.assetTypeNames);
  const [debtIds, setDebtIds] = useState<string[]>(initialValues.debtIds);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAssetTypeToggle = (assetTypeName: string, checked: boolean): void => {
    setAssetTypeNames((current) =>
      checked ? [...current, assetTypeName] : current.filter((name_) => name_ !== assetTypeName),
    );
  };

  const handleDebtToggle = (debtId: string, checked: boolean): void => {
    setDebtIds((current) =>
      checked ? [...current, debtId] : current.filter((id) => id !== debtId),
    );
  };

  const handleSubmit = async (): Promise<void> => {
    const parsed = categoryAxisFormSchema.safeParse({ name, assetTypeNames, debtIds });

    if (!parsed.success) {
      const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");
      setNameError(
        nameIssue?.code === "too_big"
          ? CATEGORY_AXIS_NAME_TOO_LONG_MESSAGE
          : CATEGORY_AXIS_NAME_REQUIRED_MESSAGE,
      );
      return;
    }

    setNameError(null);
    setSubmitError(null);
    setSubmitting(true);

    const result = await onSubmit(parsed.data);

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(CATEGORY_AXIS_FAILURE_MESSAGES[result.reason]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={NAME_INPUT_ID}>分類名</FieldLabel>
        <FieldContent>
          <Input
            id={NAME_INPUT_ID}
            value={name}
            placeholder="例: 純金融資産"
            disabled={submitting}
            aria-invalid={nameError !== null}
            onChange={(event) => setName(event.target.value)}
          />
          {nameError ? (
            <p role="alert" className="text-sm text-destructive">
              {nameError}
            </p>
          ) : null}
        </FieldContent>
      </Field>

      <div className="flex flex-col gap-2">
        {/*
          集計対象は「資産種別」「負債」の2グループに分ける(B4「集計対象に負債を含める」)。
          未選択の意味がグループごとに違い(資産種別=すべてが対象 / 負債=差し引かない)、
          この非対称は分かりにくいので、それぞれの見出しの下に明示する
        */}
        <Label>{CATEGORY_AXIS_ASSET_TYPE_GROUP_LABEL}</Label>
        <p className="text-xs text-muted-foreground">
          1つも選ばない場合は{CATEGORY_AXIS_ALL_TYPES_HINT}になります。
        </p>
        {/*
          「まだ選択肢が無い」の案内を出すのは取得できたときだけ。読み込み中や取得失敗で
          出すと、取り込み済みでも未取込に見える(B4-1・B4-2)
        */}
        {assetTypeOptions.status === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {ASSET_TYPE_OPTIONS_LOADING_LABEL}
          </p>
        ) : null}
        {assetTypeOptions.status === "error" ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            <p>{assetTypeOptions.message}</p>
            <p>{ASSET_TYPE_OPTIONS_UNAVAILABLE_NOTICE}</p>
          </div>
        ) : null}
        {assetTypeOptions.status === "ready" && assetTypeOptions.assetTypeNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">{NO_ASSET_TYPE_OPTIONS_NOTICE}</p>
        ) : null}
        {assetTypeOptions.status === "ready" && assetTypeOptions.assetTypeNames.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {assetTypeOptions.assetTypeNames.map((assetTypeName) => {
              const checkboxId = `category-axis-asset-type-${assetTypeName}`;
              return (
                <label key={assetTypeName} htmlFor={checkboxId} className="flex items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={assetTypeNames.includes(assetTypeName)}
                    disabled={submitting}
                    onCheckedChange={(checked) =>
                      handleAssetTypeToggle(assetTypeName, checked === true)
                    }
                  />
                  <span>{assetTypeName}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{CATEGORY_AXIS_DEBT_GROUP_LABEL}</Label>
        {/*
          資産種別と違い、**未選択は「負債を差し引かない」**を意味する。「未選択=すべて」の
          読み替えを負債に適用すると、負債の選択を持たない既存の分類軸が、負債の登録と
          同時に黙って純資産の軸へ変わる。結果として負債だけを集計対象にした分類軸は
          作れない(資産種別が未選択なら全資産が対象になるため)
        */}
        <p className="text-xs text-muted-foreground">
          1つも選ばない場合は{CATEGORY_AXIS_NO_DEBT_HINT}
          。選んだ負債はこの分類軸の集計から差し引かれます。
        </p>
        {/*
          B11で削除された負債への参照を選択から外したことを出す(B4)。黙って外すと、
          この分類軸が何を差し引いているかが変わったことに気付けず、B1の値が前と違う理由を
          追えなくなる。B8が対象分類の削除で既定へ戻すときに出しているのと同じ扱い。
          エラーではなく集計の基準が変わった事実の通知なので、保存自体は妨げない
        */}
        {missingDebtCount > 0 ? (
          <p role="status" className="text-sm text-destructive">
            {buildCategoryAxisMissingDebtMessage(missingDebtCount)}
          </p>
        ) : null}
        {debtOptions.status === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {DEBT_OPTIONS_LOADING_LABEL}
          </p>
        ) : null}
        {debtOptions.status === "error" ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            <p>{debtOptions.message}</p>
            <p>{DEBT_OPTIONS_UNAVAILABLE_NOTICE}</p>
          </div>
        ) : null}
        {debtOptions.status === "ready" && debtOptions.debts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{NO_DEBT_OPTIONS_NOTICE}</p>
        ) : null}
        {debtOptions.status === "ready" && debtOptions.debts.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {debtOptions.debts.map((debt) => {
              const checkboxId = `category-axis-debt-${debt.id}`;
              return (
                <label key={debt.id} htmlFor={checkboxId} className="flex items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={debtIds.includes(debt.id)}
                    disabled={submitting}
                    onCheckedChange={(checked) => handleDebtToggle(debt.id, checked === true)}
                  />
                  {/*
                    項目名は重複を許すため、残債を添えて同名の負債を見分けられるようにする
                    (B11の削除確認ダイアログと同じ理由。識別はIDで行う)
                  */}
                  <span>
                    {debt.name}
                    <span className="ml-1 text-muted-foreground tabular-nums">
                      {formatJpy(debt.balance)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          type="button"
          size="sm"
          disabled={
            submitting || assetTypeOptions.status !== "ready" || debtOptions.status !== "ready"
          }
          onClick={() => {
            void handleSubmit();
          }}
        >
          {submitting ? "保存中..." : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </div>
  );
};
