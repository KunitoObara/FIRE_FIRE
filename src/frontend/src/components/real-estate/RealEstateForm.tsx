"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  REAL_ESTATE_ACQUIRED_ON_HINT,
  REAL_ESTATE_ACQUIRED_ON_LABEL,
  REAL_ESTATE_FAILURE_MESSAGES,
  REAL_ESTATE_FORM_CANCEL_LABEL,
  REAL_ESTATE_FORM_LOAN_BALANCE_LABEL,
  REAL_ESTATE_FORM_MARKET_VALUE_LABEL,
  REAL_ESTATE_FORM_OPTIONAL_SUFFIX,
  REAL_ESTATE_FORM_RENTAL_EXPENSE_LABEL,
  REAL_ESTATE_FORM_RENTAL_INCOME_LABEL,
  REAL_ESTATE_FORM_RENTAL_TOGGLE_LABEL,
  REAL_ESTATE_FORM_SUBMIT_LABEL,
  REAL_ESTATE_FORM_SUBMITTING_LABEL,
  REAL_ESTATE_FORM_TITLES,
  REAL_ESTATE_LOCATION_LABEL,
  REAL_ESTATE_NAME_LABEL,
} from "@/constants/real-estate";
import { toRealEstatePropertyInput } from "@/lib/real-estate/form-values";
import { realEstateFormSchema } from "@/schemas/real-estate";

import type { JSX } from "react";

/**
 * 金額の入力欄。
 *
 * `type="number"`にせず`inputMode="numeric"`のテキストにする。数値入力にすると指数表記や
 * 全角数字の扱いがブラウザごとに変わり、「半角数字のみ」という判定を画面側で揃えられない
 * (検証は`realEstateFormSchema`が一手に引き受ける)。スマートフォンでは数字キーパッドが出る。
 */
const AmountField = ({ id, label, error, registration, disabled }: RealEstateAmountFieldProps) => (
  <Field>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="tabular-nums"
      disabled={disabled}
      aria-invalid={error !== undefined}
      {...registration}
    />
    <FieldError errors={[error]} />
  </Field>
);

/**
 * B7 不動産登録・編集画面のフォーム(docs/screen-requirements-real-estate.md B7)。
 *
 * 新規登録・編集の両モードで使い、違いは見出し・初期値・キャンセルの戻り先・保存処理だけを
 * Propsで受ける。バリデーションはreact-hook-form + zodでインラインに表示する(DESIGN.md 6章)。
 *
 * 保存の成否そのものは呼び出し側(`onSubmit`)に委ね、ここでは失敗時の文言表示までを担う。
 * 成功後の遷移先(B6)が新規登録と編集で変わり、この中では決められないため。
 */
export const RealEstateForm = ({
  mode,
  initialValues,
  cancelHref,
  onSubmit,
}: RealEstateFormProps): JSX.Element => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<RealEstateFormValues>({
    resolver: zodResolver(realEstateFormSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する(A1と揃える)
    mode: "onTouched",
    defaultValues: initialValues,
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // `watch()`はReact Compilerがメモ化できないため、購読には`useWatch`を使う
  const isRentalProperty = useWatch({ control, name: "isRentalProperty" });

  const handleValidSubmit = async (values: RealEstateFormValues): Promise<void> => {
    setSaveError(null);
    setSaving(true);

    const result = await onSubmit(toRealEstatePropertyInput(values));

    if (result.ok) {
      // 成功時は呼び出し側がB6へ遷移させる。ここで`saving`を戻すと、遷移が終わるまでの間だけ
      // ボタンが押せる状態に戻り、二重に保存できてしまう
      return;
    }

    setSaving(false);
    setSaveError(REAL_ESTATE_FAILURE_MESSAGES[result.reason]);
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">
          <h2>{REAL_ESTATE_FORM_TITLES[mode]}</h2>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form noValidate onSubmit={handleSubmit(handleValidSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{REAL_ESTATE_NAME_LABEL}</FieldLabel>
              <Input
                id="name"
                type="text"
                autoComplete="off"
                disabled={saving}
                aria-invalid={errors.name !== undefined}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="location">
                {REAL_ESTATE_LOCATION_LABEL}
                {REAL_ESTATE_FORM_OPTIONAL_SUFFIX}
              </FieldLabel>
              <Input
                id="location"
                type="text"
                autoComplete="off"
                disabled={saving}
                aria-invalid={errors.location !== undefined}
                {...register("location")}
              />
              <FieldError errors={[errors.location]} />
            </Field>

            {/*
              取得年月。資産推移グラフがこの月から物件を積み始める
              (docs/screen-requirements-dashboard.md B1「不動産を含む分類軸の集計」)。
              時価・ローン残高の履歴はB7で保存したときにしか積まれないので、これが無いと
              段差が「取得した月」ではなく「アプリに登録した月」に出る(B11の発生年月と同じ)。
              金額欄と違い`type="month"`にするのは、`yyyy-MM`の形をブラウザに揃えさせるため。
            */}
            <Field>
              <FieldLabel htmlFor="acquiredOn">
                {REAL_ESTATE_ACQUIRED_ON_LABEL}
                {REAL_ESTATE_FORM_OPTIONAL_SUFFIX}
              </FieldLabel>
              <Input
                id="acquiredOn"
                type="month"
                autoComplete="off"
                className="tabular-nums"
                disabled={saving}
                aria-invalid={errors.acquiredOn !== undefined}
                /*
                  エラーが出ているあいだはエラー文、それ以外はヒント文を指す。
                  `FieldError`は`role="alert"`を持つので発生時には読み上げられるが、
                  あとからこの欄へフォーカスしたときに理由を辿れるのは`aria-describedby`で
                  結び付けている側だけ(B11の発生年月と同じ組み方)。
                */
                aria-describedby={errors.acquiredOn === undefined ? "acquiredOn-hint" : undefined}
                {...register("acquiredOn")}
              />
              <FieldError errors={[errors.acquiredOn]} />
              {errors.acquiredOn === undefined ? (
                <p id="acquiredOn-hint" className="text-xs text-muted-foreground">
                  {REAL_ESTATE_ACQUIRED_ON_HINT}
                </p>
              ) : null}
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <AmountField
                id="marketValue"
                label={REAL_ESTATE_FORM_MARKET_VALUE_LABEL}
                error={errors.marketValue}
                registration={register("marketValue")}
                disabled={saving}
              />
              <AmountField
                id="loanBalance"
                label={REAL_ESTATE_FORM_LOAN_BALANCE_LABEL}
                error={errors.loanBalance}
                registration={register("loanBalance")}
                disabled={saving}
              />
            </div>

            <Field orientation="horizontal">
              <Controller
                control={control}
                name="isRentalProperty"
                render={({ field }) => (
                  <Checkbox
                    id="isRentalProperty"
                    name={field.name}
                    ref={field.ref}
                    checked={field.value}
                    disabled={saving}
                    onBlur={field.onBlur}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <FieldLabel htmlFor="isRentalProperty" className="font-normal">
                {REAL_ESTATE_FORM_RENTAL_TOGGLE_LABEL}
              </FieldLabel>
            </Field>

            {/*
              チェックがオフの間は入力欄ごと隠す(HTMLモックと同じ)。`unregister`はせず
              入力値をフォームに残すため、誤ってオフにしても戻せば書きかけの値が戻る。
              オフのまま保存した場合は`toRealEstatePropertyInput`が賃貸収入/支出を捨てる。
            */}
            {isRentalProperty ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <AmountField
                  id="rentalMonthlyIncome"
                  label={REAL_ESTATE_FORM_RENTAL_INCOME_LABEL}
                  error={errors.rentalMonthlyIncome}
                  registration={register("rentalMonthlyIncome")}
                  disabled={saving}
                />
                <AmountField
                  id="rentalMonthlyExpense"
                  label={REAL_ESTATE_FORM_RENTAL_EXPENSE_LABEL}
                  error={errors.rentalMonthlyExpense}
                  registration={register("rentalMonthlyExpense")}
                  disabled={saving}
                />
              </div>
            ) : null}

            {saveError ? (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            ) : null}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? REAL_ESTATE_FORM_SUBMITTING_LABEL : REAL_ESTATE_FORM_SUBMIT_LABEL}
              </Button>
              {/*
                保存中もキャンセルは押せるままにする(`disabled`はリンクには効かない)。
                保存を待つ間に離脱しても、書き込みは成立するかしないかのどちらかで、
                中途半端な物件が残ることはない。
              */}
              <Button asChild variant="ghost">
                <Link href={cancelHref}>{REAL_ESTATE_FORM_CANCEL_LABEL}</Link>
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};
