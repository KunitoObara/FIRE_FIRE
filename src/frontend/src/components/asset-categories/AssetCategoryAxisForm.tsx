"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_AXIS_FAILURE_MESSAGES,
  CATEGORY_AXIS_NAME_REQUIRED_MESSAGE,
  CATEGORY_AXIS_NAME_TOO_LONG_MESSAGE,
  NO_ASSET_TYPE_OPTIONS_NOTICE,
} from "@/constants/asset-categories";
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
  submitLabel,
  onSubmit,
  onCancel,
}: AssetCategoryAxisFormProps): JSX.Element => {
  const [name, setName] = useState(initialValues.name);
  const [assetTypeNames, setAssetTypeNames] = useState<string[]>(initialValues.assetTypeNames);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAssetTypeToggle = (assetTypeName: string, checked: boolean): void => {
    setAssetTypeNames((current) =>
      checked ? [...current, assetTypeName] : current.filter((name_) => name_ !== assetTypeName),
    );
  };

  const handleSubmit = async (): Promise<void> => {
    const parsed = categoryAxisFormSchema.safeParse({ name, assetTypeNames });

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
          {nameError === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {nameError}
            </p>
          )}
        </FieldContent>
      </Field>

      <div className="flex flex-col gap-2">
        <Label>集計対象(資産種別を複数選択可。1つも選ばない場合はすべての資産種別が対象)</Label>
        {assetTypeOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{NO_ASSET_TYPE_OPTIONS_NOTICE}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {assetTypeOptions.map((assetTypeName) => {
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
        )}
      </div>

      {submitError === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          size="sm"
          disabled={submitting}
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
