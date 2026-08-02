#!/bin/bash
# 禁止コマンド遮断フック(.claude/settings.json の PreToolUse)の回帰テスト。
# 対象は force push と docs/.env への Bash 経由アクセス。
#
# 判定ロジックは settings.json から取り出して実行する。テスト側にロジックを
# 書き写すと本体と乖離するため。
#
# 実行: bash .claude/hooks/run-dangerous-command-tests.sh
#
# 注意: ケースは外部ファイルから読む。判定対象の綴りをこのスクリプト本文に
# 直接書くと、スクリプトを実行するコマンド自体がフックに拒否される。

set -u

here="$(cd "$(dirname "$0")" && pwd)"
settings="$here/../settings.json"
cases="$here/dangerous-command-cases.txt"
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
  out=$(printf '%s' "$payload" | bash "$hook")
  if [ -z "$out" ]; then
    got=ALLOW
  else
    got=$(OUT="$out" python3 -c 'import json,os;print(json.loads(os.environ["OUT"])["hookSpecificOutput"]["permissionDecision"].upper())')
  fi
  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    printf 'FAIL  判定=%-5s 期待=%-5s  %s\n' "$got" "$want" "$cmd"
  fi
done < "$cases"

# Grep / Glob / Read 側のフック。Bash を経由しなくても Grep は一致行を返すため、
# 秘密ファイルを対象にした検索は内容の読み出しになる。
file_hook="$(mktemp)"
trap 'rm -f "$hook" "$file_hook"' EXIT
python3 -c "
import json
s = json.load(open('$settings'))
h = [x for e in s['hooks']['PreToolUse'] if 'Grep' in e.get('matcher', '') for x in e['hooks']]
open('$file_hook', 'w').write(h[0]['command'])
"
check_file_tool() {
  # $1=期待値 $2=tool_name $3=tool_input(JSON)
  got=ALLOW
  [ -n "$(printf '{"tool_name":"%s","tool_input":%s}' "$2" "$3" | bash "$file_hook")" ] && got=DENY
  if [ "$got" = "$1" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    printf 'FAIL  判定=%-5s 期待=%-5s  %s %s\n' "$got" "$1" "$2" "$3"
  fi
}
check_file_tool DENY  Grep '{"pattern":"KEY","path":"docs/.env"}'
check_file_tool DENY  Grep '{"pattern":"KEY","glob":"docs/.env*"}'
check_file_tool DENY  Read '{"file_path":"/repo/docs/.env"}'
check_file_tool ALLOW Grep '{"pattern":"KEY","path":"docs/"}'
check_file_tool ALLOW Grep '{"pattern":"KEY","path":"src/frontend"}'
check_file_tool ALLOW Read '{"file_path":"/repo/docs/development-workflow.md"}'

# CI(GitHub Actions)では歯止めごと無効になること。
# claude-review ジョブは settingSources に project を含むため、このフックを
# 読み込んでしまう。歯止めの対象(秘密ファイル・ローカルのpush)はCIの
# チェックアウトに存在しないのに、レビュー本文に禁止語が含まれるだけで
# コメント投稿が拒否され、ジョブが落ちる。
ci_case=$(grep -m1 '^DENY|' "$cases" | cut -d'|' -f2-)
ci_payload=$(CMD="$ci_case" python3 -c 'import json,os;print(json.dumps({"tool_name":"Bash","tool_input":{"command":os.environ["CMD"]}}))')
if [ -n "$(printf '%s' "$ci_payload" | GITHUB_ACTIONS=true bash "$hook")" ]; then
  fail=$((fail + 1))
  printf 'FAIL  GITHUB_ACTIONS=true でも拒否された: %s\n' "$ci_case"
else
  pass=$((pass + 1))
fi

echo "----"
if [ "$fail" -eq 0 ]; then
  echo "全 $pass ケース一致"
  exit 0
fi
echo "$pass 件成功 / $fail 件不一致"
exit 1
