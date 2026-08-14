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
info()    { printf '   %s\n' "$1"; }

# apps/api 의 gradle toolchain 이 Java 21 을 요구한다(build.gradle). JAVA_HOME 이 없으면
# gradlew 자체가 뜨지 못하므로, 이미 잡혀 있거나 PATH 에 java 가 있으면 그대로 두고
# 없을 때만 흔한 설치 위치(JetBrains `.jdks`, Adoptium, 배포판 jvm 경로)를 뒤져 이 스크립트
# 실행 동안만 JAVA_HOME 을 채운다. 사용자 셸 환경은 건드리지 않는다.
find_java_home() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    return 0
  fi
  if command -v java >/dev/null 2>&1; then
    return 0
  fi

  local dir picked=""
  for dir in "$HOME/.jdks"/* "${USERPROFILE:-}/.jdks"/* \
             "/c/Program Files/Eclipse Adoptium"/* "/c/Program Files/Java"/* \
             /usr/lib/jvm/* /Library/Java/JavaVirtualMachines/*/Contents/Home; do
    [ -x "$dir/bin/java" ] || continue
    case "$dir" in
      *21*) JAVA_HOME="$dir"; export JAVA_HOME; return 0 ;;
    esac
    [ -z "$picked" ] && picked="$dir"
  done

  if [ -n "$picked" ]; then
    JAVA_HOME="$picked"
    export JAVA_HOME
    return 0
  fi
  return 1
}

section "backend (apps/api)"
if [ -f "$ROOT/apps/api/gradlew" ]; then
  if find_java_home; then
    [ -n "${JAVA_HOME:-}" ] && info "JAVA_HOME=$JAVA_HOME"
    if (cd "$ROOT/apps/api" && ./gradlew build --no-daemon); then
      ok "gradlew build"
    else
      fail "gradlew build"
    fi
  else
    fail "gradlew build (JDK 21 을 찾지 못했습니다 — 설치 후 JAVA_HOME 을 직접 설정해 주세요)"
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
