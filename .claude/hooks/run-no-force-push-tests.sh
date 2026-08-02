#!/bin/bash
# force push 遮断フック(.claude/settings.json の PreToolUse)の回帰テスト。
#
# 判定ロジックは settings.json から取り出して実行する。テスト側にロジックを
# 書き写すと本体と乖離するため。
#
# 実行: bash .claude/hooks/run-no-force-push-tests.sh
#
# 注意: ケースは外部ファイルから読む。判定対象の綴りをこのスクリプト本文に
# 直接書くと、スクリプトを実行するコマンド自体がフックに拒否される。

set -u

here="$(cd "$(dirname "$0")" && pwd)"
settings="$here/../settings.json"
cases="$here/no-force-push-cases.txt"
hook="$(mktemp)"
trap 'rm -f "$hook"' EXIT

if ! python3 -c "
import json, sys
s = json.load(open('$settings'))
hooks = [h for e in s['hooks']['PreToolUse'] if e.get('matcher') == 'Bash' for h in e['hooks'] if h.get('type') == 'command']
if len(hooks) != 1:
    sys.exit('PreToolUse/Bash の command フックが %d 個見つかりました(1個を想定)' % len(hooks))
open('$hook', 'w').write(hooks[0]['command'])
"; then
  echo "フック本体を settings.json から取り出せませんでした" >&2
  exit 1
fi

pass=0
fail=0
while IFS='|' read -r want cmd; do
  case "$want" in ''|'#'*) continue ;; esac
  payload=$(CMD="$cmd" python3 -c 'import json,os;print(json.dumps({"tool_name":"Bash","tool_input":{"command":os.environ["CMD"]}}))')
  if [ -n "$(printf '%s' "$payload" | bash "$hook")" ]; then got=DENY; else got=ALLOW; fi
  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    printf 'FAIL  判定=%-5s 期待=%-5s  %s\n' "$got" "$want" "$cmd"
  fi
done < "$cases"

echo "----"
if [ "$fail" -eq 0 ]; then
  echo "全 $pass ケース一致"
  exit 0
fi
echo "$pass 件成功 / $fail 件不一致"
exit 1
