"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  CONTACT_BETA_NOTICE,
  CONTACT_FAILURE_MESSAGES,
  CONTACT_SENT_MESSAGE,
} from "@/constants/public";
import { sendContactMessage } from "@/lib/contact/send-contact-message";
import { CONTACT_BODY_MAX_LENGTH, contactSchema } from "@/schemas/contact";

import type { JSX } from "react";

/**
 * A11 お問い合わせフォーム(docs/screen-requirements-public.md A11)。
 *
 * **送信できても画面を遷移させない**(A6と同じ扱い)。未ログインの利用者に次の行き先が無く、
 * 送れなかったときに書いた本文をそのまま残せるのも同じ理由による。
 *
 * 宛先もスパム対策もサーバー側にある(`src/backend/src/contact/functions.ts`)。この画面が
 * 持つのは入力と、結果の出し分けだけ。
 */
export const ContactForm = (): JSX.Element => {
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する(A6と同じ)
    mode: "onTouched",
    defaultValues: { email: "", body: "", website: "" },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleValidSubmit = async (values: ContactFormValues): Promise<void> => {
    clearErrors("root");
    // 2通目を送る時点で前回の完了表示は消す(どちらの内容について出ているのか分からなくなるため)
    setIsSent(false);
    setIsSubmitting(true);

    const result = await sendContactMessage(values);
    setIsSubmitting(false);

    if (!result.ok) {
      setError("root", { message: CONTACT_FAILURE_MESSAGES[result.reason] });
      return;
    }

    // 送れた内容は残さない。同じ問い合わせを二重に送る操作を、そのままではできないようにする
    reset();
    setIsSent(true);
  };

  return (
    <form noValidate onSubmit={handleSubmit(handleValidSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email !== undefined}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="body">お問い合わせ内容</FieldLabel>
          {/*
            `textarea`のshadcnコンポーネントはこの画面が初出のため、まだ入れていない
            (DESIGN.md 2章。CLI経由で必要なものだけ追加する方針)。使うのが1箇所のうちは、
            `Input`の見た目に合わせた素の`textarea`で足りる。
          */}
          <textarea
            id="body"
            rows={8}
            maxLength={CONTACT_BODY_MAX_LENGTH}
            aria-invalid={errors.body !== undefined}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
            {...register("body")}
          />
          <FieldError errors={[errors.body]} />
        </Field>

        {/*
          ハニーポット。**画面から隠すだけでなく支援技術からも外す** — `sr-only`だと読み上げられ、
          スクリーンリーダーの利用者が善意で埋めてしまう。`tabIndex={-1}`でキーボードの順路からも外す。
          埋まっていた場合の扱いはサーバー側が決める(画面では判定しない)。
        */}
        <div aria-hidden className="hidden">
          <label htmlFor="website">website</label>
          <input
            id="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register("website")}
          />
        </div>

        <FieldError errors={[errors.root]} />

        {isSent ? (
          <p role="status" className="rounded-lg bg-muted p-4 text-sm">
            {CONTACT_SENT_MESSAGE}
          </p>
        ) : null}

        {/*
          **送信中の無効化が二重送信の防波堤そのものである。** 既定のsubmitボタンが無効な間は
          入力欄でEnterを押しても暗黙の送信が起こらない(HTML標準)ため、これ1つで両方の経路が
          塞がる。外すと同じ問い合わせが2通届き、2通目はサーバー側の送信間隔制限に阻まれて
          `throttled`で返る — 1通目は送れているのに失敗したように見える。
        */}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "送信中..." : "送信する"}
        </Button>

        <p className="text-[0.8125rem] text-muted-foreground">{CONTACT_BETA_NOTICE}</p>
      </FieldGroup>
    </form>
  );
};
