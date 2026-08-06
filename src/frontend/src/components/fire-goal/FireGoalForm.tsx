"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildFireGoalAchievementHint,
  buildFireGoalHiddenTabNoticeMessage,
  FIRE_GOAL_AMOUNT_PATTERN,
  FIRE_GOAL_ANNUAL_EXPENSE_LABEL,
  FIRE_GOAL_CALCULATED_TARGET_LABEL,
  FIRE_GOAL_DIRECT_DESCRIPTION,
  FIRE_GOAL_FAILURE_MESSAGES,
  FIRE_GOAL_FIELDS,
  FIRE_GOAL_MODE_LABELS,
  FIRE_GOAL_MODES,
  FIRE_GOAL_REVERSE_DESCRIPTION,
  FIRE_GOAL_SUBMIT_LABEL,
  FIRE_GOAL_SUBMITTING_LABEL,
  FIRE_GOAL_TARGET_AMOUNT_LABEL,
  FIRE_GOAL_WITHDRAWAL_RATE_HINT,
  FIRE_GOAL_WITHDRAWAL_RATE_LABEL,
  FIRE_GOAL_WITHDRAWAL_RATE_PATTERN,
} from "@/constants/fire-goal";
import { calculateAchievementRate } from "@/lib/dashboard/fire-progress";
import { calculateTargetFromAnnualExpense } from "@/lib/fire-goal/calculation";
import { toFireGoal, toPreviewNumber } from "@/lib/fire-goal/form-values";
import { formatJpy, formatPercent } from "@/lib/format/currency";
import { fireGoalFormSchema } from "@/schemas/fire-goal";

import type { JSX } from "react";
import type { FieldErrors } from "react-hook-form";

/**
 * B8 FIRE目標設定画面のフォーム(docs/screen-requirements-fire-goal.md B8)。
 *
 * タブの選択状態はフォームの`mode`そのもので、そのまま「現在有効な設定方式」として保存される。
 * タブとフォームで選択状態を二重に持つと、表示中のタブと保存される方式がずれうるため。
 *
 * 非表示タブのパネルは`forceMount`で組み立てたままにし、切り替えても入力値を捨てない
 * (要件の「タブ切替時、入力値は両タブとも保持される」・DESIGN.md 6章)。
 *
 * 保存の成否は呼び出し側(`onSubmit`)に委ね、ここでは失敗時の文言表示までを担う。
 */
export const FireGoalForm = ({
  initialValues,
  currentAssetTotal,
  onSubmit,
}: FireGoalFormProps): JSX.Element => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<FireGoalFormValues>({
    resolver: zodResolver(fireGoalFormSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する(A1・B7と揃える)
    mode: "onTouched",
    defaultValues: initialValues,
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 表示していなかったタブのエラーで保存が止まり、こちらからタブを切り替えたときだけ出す説明。
  // タブが勝手に切り替わった理由が画面から読み取れないため添える
  const [hiddenTabNotice, setHiddenTabNotice] = useState<string | null>(null);

  // `watch()`はReact Compilerがメモ化できないため、購読には`useWatch`を使う
  const mode = useWatch({ control, name: "mode" });
  const targetAmount = useWatch({ control, name: "targetAmount" });
  const annualExpense = useWatch({ control, name: "annualExpense" });
  const withdrawalRate = useWatch({ control, name: "withdrawalRate" });

  // 参考表示は入力しながら更新する。まだ検証を通っていない値なので、数値として
  // 読める場合だけ計算し、読めなければ何も出さない(誤った達成率を見せない)
  const parsedAnnualExpense = toPreviewNumber(annualExpense, FIRE_GOAL_AMOUNT_PATTERN);
  const parsedWithdrawalRate = toPreviewNumber(withdrawalRate, FIRE_GOAL_WITHDRAWAL_RATE_PATTERN);
  const calculatedTarget =
    parsedAnnualExpense === null || parsedWithdrawalRate === null
      ? null
      : calculateTargetFromAnnualExpense(parsedAnnualExpense, parsedWithdrawalRate);

  /** 目標資産額に対する達成率。現在資産額が分からなければ出さない */
  const achievementHint = (target: number | null): string | null => {
    if (target === null || currentAssetTotal === null) {
      return null;
    }

    const rate = calculateAchievementRate(currentAssetTotal, target);

    return rate !== null ? buildFireGoalAchievementHint(formatPercent(rate)) : null;
  };

  const directAchievementHint = achievementHint(
    toPreviewNumber(targetAmount, FIRE_GOAL_AMOUNT_PATTERN),
  );
  const reverseAchievementHint = achievementHint(calculatedTarget);

  const handleValidSubmit = async (values: FireGoalFormValues): Promise<void> => {
    setSaveError(null);
    setHiddenTabNotice(null);
    setSaving(true);

    const result = await onSubmit(toFireGoal(values));

    if (result.ok) {
      // 成功時は呼び出し側がB1へ遷移させる。ここで`saving`を戻すと、遷移が終わるまでの間だけ
      // ボタンが押せる状態に戻り、二重に保存できてしまう(B7と同じ扱い)
      return;
    }

    setSaving(false);
    setSaveError(FIRE_GOAL_FAILURE_MESSAGES[result.reason]);
  };

  /**
   * 表示中のタブに問題が無いのに保存できないときは、エラーの出ているタブへ切り替える。
   *
   * 非表示タブの欄も、入力されている以上は形式を検証する(`fireGoalFormSchema`)。
   * 切り替えずに黙って止めると、押しても何も起きないボタンになるため。
   * 切り替えた先が保存される設定方式になるが、それは画面に見えているタブと一致する。
   *
   * 切り替えたときは、なぜそのタブに飛ばされたのかが分かる説明を添える。インラインエラーだけでは
   * 「使うつもりのない方の入力が保存を止めている」ことが読み取れないため。
   */
  const handleInvalidSubmit = (formErrors: FieldErrors<FireGoalFormValues>): void => {
    const errored = FIRE_GOAL_FIELDS.filter((field) => formErrors[field.name] !== undefined);
    const hidden = errored.find((field) => field.mode !== mode);

    if (hidden === undefined || errored.some((field) => field.mode === mode)) {
      // 表示中のタブにもエラーがあるなら、そのインラインエラーがそのまま理由になる
      setHiddenTabNotice(null);

      return;
    }

    setValue("mode", hidden.mode);
    setHiddenTabNotice(
      buildFireGoalHiddenTabNoticeMessage(
        FIRE_GOAL_MODE_LABELS[mode],
        FIRE_GOAL_MODE_LABELS[hidden.mode],
      ),
    );
  };

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form noValidate onSubmit={handleSubmit(handleValidSubmit, handleInvalidSubmit)}>
          {/*
            タブの上に置く。切り替わったこと自体への補足なので、切替先のパネルの中ではなく
            タブ見出しより前に出す。読み上げは`FieldError`(role="alert")と競合しないよう
            polite(role="status")にし、インラインエラーの読み上げを妨げない。
          */}
          {hiddenTabNotice !== null ? (
            <p
              role="status"
              className="mb-6 rounded-md border border-destructive/50 px-4 py-3 text-sm text-destructive"
            >
              {hiddenTabNotice}
            </p>
          ) : null}

          <Tabs
            value={mode}
            onValueChange={(value) => {
              // `TabsTrigger`のvalueは`FIRE_GOAL_MODES`のIDしか取らないが、Radixからは
              // 文字列で渡るため、フォームに入れる前に設定方式として扱えるものか確かめる
              const selected = FIRE_GOAL_MODES.find((option) => option.id === value);

              if (selected !== undefined) {
                setValue("mode", selected.id);
                // 自分でタブを選び直した時点で「勝手に切り替わった」説明は用済み。
                // 残すと、いま見ているタブと合わない案内が出たままになる
                setHiddenTabNotice(null);
              }
            }}
            className="gap-6"
          >
            <TabsList aria-label="設定方式">
              {FIRE_GOAL_MODES.map((option) => (
                <TabsTrigger key={option.id} value={option.id} disabled={saving}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/*
              `forceMount`を付けると選択されていないタブも組み立てられたままになる代わりに、
              Radixは`hidden`属性を付けなくなる。非表示は`data-state`から自分で当てる
              (B2のCSV取込タブと同じ扱い)。
            */}
            <TabsContent value="direct" forceMount className="data-[state=inactive]:hidden">
              <FieldGroup>
                <p className="text-sm text-muted-foreground">{FIRE_GOAL_DIRECT_DESCRIPTION}</p>

                <Field>
                  <FieldLabel htmlFor="targetAmount">{FIRE_GOAL_TARGET_AMOUNT_LABEL}</FieldLabel>
                  <Input
                    id="targetAmount"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="tabular-nums"
                    disabled={saving}
                    aria-invalid={errors.targetAmount !== undefined}
                    {...register("targetAmount")}
                  />
                  <FieldError errors={[errors.targetAmount]} />
                  {directAchievementHint !== null ? (
                    <FieldDescription>{directAchievementHint}</FieldDescription>
                  ) : null}
                </Field>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="reverse" forceMount className="data-[state=inactive]:hidden">
              <FieldGroup>
                <p className="text-sm text-muted-foreground">{FIRE_GOAL_REVERSE_DESCRIPTION}</p>

                <Field>
                  <FieldLabel htmlFor="annualExpense">{FIRE_GOAL_ANNUAL_EXPENSE_LABEL}</FieldLabel>
                  <Input
                    id="annualExpense"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="tabular-nums"
                    disabled={saving}
                    aria-invalid={errors.annualExpense !== undefined}
                    {...register("annualExpense")}
                  />
                  <FieldError errors={[errors.annualExpense]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="withdrawalRate">
                    {FIRE_GOAL_WITHDRAWAL_RATE_LABEL}
                  </FieldLabel>
                  <Input
                    id="withdrawalRate"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                    disabled={saving}
                    aria-invalid={errors.withdrawalRate !== undefined}
                    {...register("withdrawalRate")}
                  />
                  <FieldError errors={[errors.withdrawalRate]} />
                  <FieldDescription>{FIRE_GOAL_WITHDRAWAL_RATE_HINT}</FieldDescription>
                </Field>

                {/*
                  金額・達成率は`0`が正当な値なので、`!== null`で判定する。truthyかどうかで
                  書くと、算出結果が0円のときにこの表示ごと消える(CODING_STANDARDS.md 2章)
                */}
                {calculatedTarget !== null ? (
                  <p className="rounded-md bg-muted px-4 py-3 text-sm">
                    {FIRE_GOAL_CALCULATED_TARGET_LABEL}{" "}
                    <strong className="tabular-nums">{formatJpy(calculatedTarget)}</strong>
                    {reverseAchievementHint !== null ? (
                      <span className="text-muted-foreground">({reverseAchievementHint})</span>
                    ) : null}
                  </p>
                ) : null}
              </FieldGroup>
            </TabsContent>
          </Tabs>

          {saveError !== null ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <Button type="submit" className="mt-6" disabled={saving}>
            {saving ? FIRE_GOAL_SUBMITTING_LABEL : FIRE_GOAL_SUBMIT_LABEL}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
