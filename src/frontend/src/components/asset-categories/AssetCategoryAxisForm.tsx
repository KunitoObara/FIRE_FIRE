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
  buildCategoryAxisMissingPropertyMessage,
  CATEGORY_AXIS_ALL_TYPES_HINT,
  CATEGORY_AXIS_ASSET_TYPE_GROUP_LABEL,
  CATEGORY_AXIS_CSV_DUPLICATION_WARNING,
  CATEGORY_AXIS_DEBT_GROUP_LABEL,
  CATEGORY_AXIS_DEFAULT_VALUATION_MODE,
  CATEGORY_AXIS_DOUBLE_DEDUCTION_NOTICE,
  CATEGORY_AXIS_FAILURE_MESSAGES,
  CATEGORY_AXIS_NAME_REQUIRED_MESSAGE,
  CATEGORY_AXIS_NAME_TOO_LONG_MESSAGE,
  CATEGORY_AXIS_NO_DEBT_HINT,
  CATEGORY_AXIS_NO_PROPERTY_HINT,
  CATEGORY_AXIS_PROPERTY_GROUP_LABEL,
  CATEGORY_AXIS_PROPERTY_TOO_MANY_MESSAGE,
  CATEGORY_AXIS_SPREAD_ONLY_LABEL,
  DEBT_OPTIONS_LOADING_LABEL,
  DEBT_OPTIONS_UNAVAILABLE_NOTICE,
  NO_ASSET_TYPE_OPTIONS_NOTICE,
  NO_DEBT_OPTIONS_NOTICE,
  NO_PROPERTY_OPTIONS_NOTICE,
  PROPERTY_OPTIONS_LOADING_LABEL,
  PROPERTY_OPTIONS_UNAVAILABLE_NOTICE,
} from "@/constants/asset-categories";
import { formatJpy } from "@/lib/format/currency";
import { toShortLocation } from "@/lib/real-estate/location";
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
  propertyOptions,
  missingPropertyCount,
  submitLabel,
  onSubmit,
  onCancel,
}: AssetCategoryAxisFormProps): JSX.Element => {
  const [name, setName] = useState(initialValues.name);
  const [assetTypeNames, setAssetTypeNames] = useState<string[]>(initialValues.assetTypeNames);
  const [debtIds, setDebtIds] = useState<string[]>(initialValues.debtIds);
  const [propertyValuations, setPropertyValuations] = useState<CategoryAxisPropertyValuations>(
    initialValues.propertyValuations,
  );
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

  /**
   * 物件の選択を切り替える。
   *
   * **選択を外した物件の反映方法は保存しない**(キーごと落とす)。選択と反映方法を別々に
   * 覚えると、画面に出ていない設定が保存され続ける(B4)。選び直したときは既定に戻る。
   */
  const handlePropertyToggle = (propertyId: string, checked: boolean): void => {
    setPropertyValuations((current) => {
      if (!checked) {
        // 分割代入で捨てる書き方は未使用変数になるため、写してから消す
        const next = { ...current };
        delete next[propertyId];
        return next;
      }

      return { ...current, [propertyId]: CATEGORY_AXIS_DEFAULT_VALUATION_MODE };
    });
  };

  /** 「利ざやのみ反映」の切り替え。選択済みの物件にしか出さないので、キーは必ず存在する */
  const handleValuationModeToggle = (propertyId: string, spreadOnly: boolean): void => {
    setPropertyValuations((current) => ({
      ...current,
      [propertyId]: spreadOnly ? "spread" : "marketValue",
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    const parsed = categoryAxisFormSchema.safeParse({
      name,
      assetTypeNames,
      debtIds,
      propertyValuations,
    });

    if (!parsed.success) {
      /*
        分類名以外の失敗を分類名のエラーに丸めない。丸めると、物件を選びすぎただけの保存に
        「分類名を入力してください」と出て、直す場所が画面から分からなくなる。
        負債は登録そのものが50件で止まるので同じ状態にならないが、物件は登録件数を
        縛っていないため51件目を選べば実際に到達する(B4)
      */
      const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");

      if (nameIssue === undefined) {
        setSubmitError(
          parsed.error.issues.some((issue) => issue.path[0] === "propertyValuations")
            ? CATEGORY_AXIS_PROPERTY_TOO_MANY_MESSAGE
            : CATEGORY_AXIS_FAILURE_MESSAGES.unknown,
        );
        return;
      }

      setNameError(
        nameIssue.code === "too_big"
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
          集計対象は「資産種別」「不動産(手動)」「負債」の3グループに分ける
          (B4「集計対象に負債を含める」「集計対象に不動産を含める」)。
          未選択の意味がグループごとに違い(資産種別=すべてが対象 / 不動産=反映しない /
          負債=差し引かない)、この非対称は分かりにくいので、それぞれの見出しの下に明示する
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

      {/*
        3つ目のグループ「不動産(手動)」(B4「集計対象に不動産を含める」)。選択肢はB5〜B7で
        登録済みの物件で、選んだ物件の額を集計に**加える**(負債とは符号が逆)。
      */}
      <div className="flex flex-col gap-2">
        <Label>{CATEGORY_AXIS_PROPERTY_GROUP_LABEL}</Label>
        {/*
          カードで指定された赤字の注意。物件名とCSVの列名は一致せず金額も別物なので、
          同じ物件かどうかをアプリ側で突き合わせて防ぐことはできない(B1「CSV取込データとの重複」)。
          「注意」のラベルを添えるのは、単独の赤字が入力エラーに読まれないようにするため。
          位置も入力エラーが出る欄の直下ではなく選択肢の上に置く
        */}
        <p role="note" className="text-sm text-destructive">
          <span className="font-semibold">{CATEGORY_AXIS_CSV_DUPLICATION_WARNING.label}</span>{" "}
          {CATEGORY_AXIS_CSV_DUPLICATION_WARNING.message}
        </p>
        {/* 資産種別と違い、未選択は「不動産を反映しない」を意味する(負債と同じ非対称) */}
        <p className="text-xs text-muted-foreground">
          1つも選ばない場合は{CATEGORY_AXIS_NO_PROPERTY_HINT}
          。選んだ物件の額はこの分類軸の集計に加わります。
        </p>
        {/* こちらは赤字にしない。2つの注意を同じ強さで並べると、上の重複の注意が埋もれる */}
        <p className="text-xs text-muted-foreground">{CATEGORY_AXIS_DOUBLE_DEDUCTION_NOTICE}</p>
        {missingPropertyCount > 0 ? (
          <p role="status" className="text-sm text-destructive">
            {buildCategoryAxisMissingPropertyMessage(missingPropertyCount)}
          </p>
        ) : null}
        {propertyOptions.status === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {PROPERTY_OPTIONS_LOADING_LABEL}
          </p>
        ) : null}
        {propertyOptions.status === "error" ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            <p>{propertyOptions.message}</p>
            <p>{PROPERTY_OPTIONS_UNAVAILABLE_NOTICE}</p>
          </div>
        ) : null}
        {propertyOptions.status === "ready" && propertyOptions.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">{NO_PROPERTY_OPTIONS_NOTICE}</p>
        ) : null}
        {propertyOptions.status === "ready" && propertyOptions.properties.length > 0 ? (
          <div className="flex flex-col gap-3 text-sm">
            {propertyOptions.properties.map((property) => {
              const checkboxId = `category-axis-property-${property.id}`;
              const modeCheckboxId = `category-axis-property-mode-${property.id}`;
              const mode = propertyValuations[property.id];
              const shortLocation = toShortLocation(property.location);

              return (
                <div key={property.id} className="flex flex-col gap-1">
                  <label htmlFor={checkboxId} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId}
                      checked={mode !== undefined}
                      disabled={submitting}
                      onCheckedChange={(checked) =>
                        handlePropertyToggle(property.id, checked === true)
                      }
                    />
                    {/*
                      物件名は重複を許すため(B7)、簡略表記の所在地を添えて見分けられるように
                      する。所在地は任意入力なので、未入力の物件は名前だけで並ぶ
                    */}
                    <span>
                      {property.name}
                      {shortLocation.length > 0 ? (
                        <span className="ml-1 text-muted-foreground">({shortLocation})</span>
                      ) : null}
                    </span>
                  </label>
                  {/*
                    反映方法は**選んだ物件の行にだけ**出す。選んでいない物件に残っていると、
                    何が集計されるのかが行から読めない(B4)
                  */}
                  {mode === undefined ? null : (
                    <label
                      htmlFor={modeCheckboxId}
                      className="flex items-center gap-2 pl-6 text-xs text-muted-foreground"
                    >
                      <Checkbox
                        id={modeCheckboxId}
                        checked={mode === "spread"}
                        disabled={submitting}
                        onCheckedChange={(checked) =>
                          handleValuationModeToggle(property.id, checked === true)
                        }
                      />
                      <span>{CATEGORY_AXIS_SPREAD_ONLY_LABEL}</span>
                    </label>
                  )}
                </div>
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
            submitting ||
            assetTypeOptions.status !== "ready" ||
            debtOptions.status !== "ready" ||
            propertyOptions.status !== "ready"
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
