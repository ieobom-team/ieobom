#!/usr/bin/env bash
# PR 을 만들기 전에 실행한다. 아직 생성되지 않은 앱은 SKIP 한다.
#
#   ./scripts/verify-before-pr.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0

section() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
skip()    { printf '   SKIP - %s\n' "$1"; }
ok()      { printf '   \033[32mOK\033[0m - %s\n' "$1"; }
fail()    { printf '   \033[31mFAIL\033[0m - %s\n' "$1"; FAILED=1; }

section "backend (apps/api)"
if [ -f "$ROOT/apps/api/gradlew" ]; then
  if (cd "$ROOT/apps/api" && ./gradlew build --no-daemon); then
    ok "gradlew build"
  else
    fail "gradlew build"
  fi
else
  skip "apps/api 가 아직 없습니다"
fi

section "frontend (apps/web)"
if [ -f "$ROOT/apps/web/package.json" ]; then
  (cd "$ROOT/apps/web" && npm run lint) && ok "npm run lint" || fail "npm run lint"
  (cd "$ROOT/apps/web" && npm test) && ok "npm test" || fail "npm test"
  (cd "$ROOT/apps/web" && npm run build) && ok "npm run build" || fail "npm run build"
else
  skip "apps/web 이 아직 없습니다 (apps/web/README.md 참고)"
fi

section "secrets"
if git -C "$ROOT" ls-files | grep -qE '(^|/)\.env$|\.pem$|(^|/)id_rsa$'; then
  fail "비밀 파일이 추적되고 있습니다"
else
  ok "추적된 비밀 파일 없음"
fi

printf '\n'
if [ "$FAILED" -eq 0 ]; then
  printf '\033[32m검증 통과. PR 을 만들어도 됩니다.\033[0m\n'
else
  printf '\033[31m검증 실패. 원인을 확인하고 고친 뒤 다시 실행하세요.\033[0m\n'
fi
exit "$FAILED"
