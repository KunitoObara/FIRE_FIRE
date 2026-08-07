"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { GOOGLE_LINK_FAILURE_MESSAGE } from "@/constants/auth";
import { clearGoogleLinkFailureNotice, wasGoogleLinkFailed } from "@/lib/auth/google-link-notice";

import type { JSX } from "react";

/**
 * B1の「Googleアカウント連携の失敗通知」(docs/screen-requirements-dashboard.md B1)。
 *
 * A8経由のログインで連携に失敗した場合にだけ、B1到達時に一度だけトーストで伝える。
 * 連携の成否にかかわらずサインイン自体は成立しているため、ログインはやり直させない。
 *
 * 表示するものが無いので描画は返さない。B1本体はServer Componentのままにしておきたい一方、
 * トーストの発火にはeffectが要るため、この一点だけをClient Componentとして切り出している。
 *
 * フラグの読み出しと消費が分かれているのは`google-link-notice.ts`のとおりで、ここでは
 * effectの中で読んでその場で消費する(Strict Modeでeffectが2回走っても2回目は既に消費済みで
 * falseになり、トーストは1回しか出ない)。
 */
export const GoogleLinkFailureNotice = (): JSX.Element | null => {
  useEffect(() => {
    if (!wasGoogleLinkFailed()) {
      return;
    }

    clearGoogleLinkFailureNotice();
    toast.error(GOOGLE_LINK_FAILURE_MESSAGE);
  }, []);

  return null;
};
