"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { RiskLevelIndicator } from "@/components/assumptions/RiskLevelIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ASSUMPTIONS_ASSET_COLUMN_LABEL,
  ASSUMPTIONS_BALANCE_COLUMN_LABEL,
  ASSUMPTIONS_EXPECTED_RETURN_COLUMN_LABEL,
  ASSUMPTIONS_FAILURE_MESSAGES,
  ASSUMPTIONS_RISK_LEVEL_COLUMN_LABEL,
  ASSUMPTIONS_SUBMITTING_LABEL,
  ASSUMPTIONS_SUBMIT_LABEL,
  ASSUMPTION_RISK_LEVELS,
  buildExpectedReturnFieldLabel,
  buildRiskLevelFieldLabel,
  UNSET_RISK_LEVEL_LABEL,
  UNSET_RISK_LEVEL_VALUE,
} from "@/constants/assumptions";
import { formatJpy } from "@/lib/format/currency";
import { assumptionsFormSchema } from "@/schemas/assumptions";

import type { JSX } from "react";

/**
 * B9 想定利回り・リスク設定画面のフォーム(docs/screen-requirements-fire-goal.md B9)。
 *
 * 要件どおり一覧の中で直接編集する(DESIGN.md 6章「一覧+インライン編集」)。行ごとに
 * 別画面や編集モードへ入る形にはせず、表のセルがそのまま入力欄になる。
 *
 * 保存は行ごとではなく1回にまとめる。要件の主な操作が「インライン編集」と「保存」ボタンの
 * 2つで、複数行を見比べながら調整する画面だからで、行ごとに書き込むと調整の途中経過が
 * そのままFIRE到達予測に反映されてしまう。
 *
 * 保存の成否は呼び出し側(`onSubmit`)に委ね、ここでは失敗時の文言表示までを担う。
 */
export const AssumptionSettingsForm = ({
  balances,
  initialValues,
  onSubmit,
}: AssumptionSettingsFormProps): JSX.Element => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AssumptionsFormValues>({
    resolver: zodResolver(assumptionsFormSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する(B7・B8と揃える)
    mode: "onTouched",
    defaultValues: initialValues,
  });

  const { fields } = useFieldArray({ control, name: "rows" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 現在残高は入力値ではないので、フォームには持たせず資産種別名で引く
  const balanceByName = new Map(balances.map((item) => [item.assetTypeName, item.balance]));

  const handleValidSubmit = async (values: AssumptionsFormValues): Promise<void> => {
    setSaveError(null);
    setSaving(true);

    const result = await onSubmit(values);

    if (result.ok) {
      // 成功時は呼び出し側がB1へ遷移させる。ここで`saving`を戻すと、遷移が終わるまでの間だけ
      // ボタンが押せる状態に戻り、二重に保存できてしまう(B7・B8と同じ扱い)
      return;
    }

    setSaving(false);
    setSaveError(ASSUMPTIONS_FAILURE_MESSAGES[result.reason]);
  };

  return (
    <Card>
      <form noValidate onSubmit={handleSubmit(handleValidSubmit)}>
        <CardContent className="px-0">
          {/* 列が4つあり狭い画面では収まらないため、横スクロールはこの中だけで起こす */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ASSUMPTIONS_ASSET_COLUMN_LABEL}</TableHead>
                  <TableHead className="text-right">{ASSUMPTIONS_BALANCE_COLUMN_LABEL}</TableHead>
                  <TableHead>{ASSUMPTIONS_EXPECTED_RETURN_COLUMN_LABEL}</TableHead>
                  <TableHead>{ASSUMPTIONS_RISK_LEVEL_COLUMN_LABEL}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const balance = balanceByName.get(field.assetTypeName);
                  const expectedReturnError = errors.rows?.[index]?.expectedReturn;

                  return (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.assetTypeName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {/* 残高は数値。`0`が正当な値なのでtruthyではなく`!== undefined`で判定する */}
                        {balance !== undefined ? formatJpy(balance) : null}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          className="w-24 tabular-nums"
                          aria-label={buildExpectedReturnFieldLabel(field.assetTypeName)}
                          aria-invalid={expectedReturnError !== undefined}
                          disabled={saving}
                          {...register(`rows.${index}.expectedReturn`)}
                        />
                        <FieldError errors={[expectedReturnError]} className="mt-1" />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`rows.${index}.riskLevel`}
                          render={({ field: riskField }) => (
                            <Select
                              value={riskField.value}
                              onValueChange={riskField.onChange}
                              disabled={saving}
                            >
                              <SelectTrigger
                                className="w-28"
                                aria-label={buildRiskLevelFieldLabel(field.assetTypeName)}
                                onBlur={riskField.onBlur}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNSET_RISK_LEVEL_VALUE}>
                                  {UNSET_RISK_LEVEL_LABEL}
                                </SelectItem>
                                {ASSUMPTION_RISK_LEVELS.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    <RiskLevelIndicator level={option.id} />
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="flex-col items-start gap-3 border-t pt-6">
          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <Button type="submit" disabled={saving}>
            {saving ? ASSUMPTIONS_SUBMITTING_LABEL : ASSUMPTIONS_SUBMIT_LABEL}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
