import { Mail } from "lucide-react";

import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LAST_PROVIDER_NOTICE,
  LINKED_PROVIDER_LABELS,
  LINKED_PROVIDER_LINKED_LABEL,
  LINKED_PROVIDER_NOT_LINKED_LABEL,
  LINK_GOOGLE_LABEL,
  LINK_GOOGLE_SUBMITTING_LABEL,
  UNLINK_PROVIDER_LABEL,
  buildUnlinkProviderButtonLabel,
} from "@/constants/account";

import type { JSX } from "react";

/**
 * ログイン方法1行(docs/screen-requirements-account.md「連携アカウントの管理」)。
 *
 * 連携済みなら解除ボタン、未連携のGoogleなら連携ボタンを出す。未連携のパスワードに操作は
 * 置かない — このアプリにはGoogle専用アカウントへパスワードを設定する導線が無い
 * (docs/auth-login-requirements.md 8章のオープン課題)。
 */
export const LinkedProviderRow = ({
  provider,
  isLastProvider,
  isLinking,
  onLink,
  onUnlink,
}: LinkedProviderRowProps): JSX.Element => (
  <li className="flex items-center justify-between gap-3 py-3">
    <div className="flex min-w-0 items-center gap-2.5">
      {provider.id === "google.com" ? (
        <GoogleIcon className="size-5 shrink-0" />
      ) : (
        <Mail aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      )}

      <div className="min-w-0">
        <p className="text-sm font-medium">{LINKED_PROVIDER_LABELS[provider.id]}</p>
        {provider.email ? (
          <p className="text-xs break-all text-muted-foreground">{provider.email}</p>
        ) : null}
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-3">
      <Badge variant={provider.isLinked ? "default" : "outline"}>
        {provider.isLinked ? LINKED_PROVIDER_LINKED_LABEL : LINKED_PROVIDER_NOT_LINKED_LABEL}
      </Badge>

      {provider.isLinked ? (
        <div className="flex items-center gap-2">
          {/* 押せない理由は併記する。ボタンが無効なだけでは、なぜ解除できないかが分からないため */}
          {isLastProvider ? (
            <span className="text-xs text-muted-foreground">{LAST_PROVIDER_NOTICE}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            aria-label={buildUnlinkProviderButtonLabel(provider.id)}
            disabled={isLastProvider}
            onClick={() => onUnlink(provider.id)}
          >
            {UNLINK_PROVIDER_LABEL}
          </Button>
        </div>
      ) : null}

      {!provider.isLinked && provider.id === "google.com" ? (
        <Button type="button" variant="outline" size="sm" disabled={isLinking} onClick={onLink}>
          {isLinking ? LINK_GOOGLE_SUBMITTING_LABEL : LINK_GOOGLE_LABEL}
        </Button>
      ) : null}
    </div>
  </li>
);
