#!/usr/bin/env bash
# 로컬 개발 환경 통합 실행 스크립트 (DB + Backend + Frontend)
#
#   ./scripts/dev-run.sh

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 색상 정의
GREEN='\033[32m'
BLUE='\033[36m'
YELLOW='\033[33m'
RED='\033[31m'
BOLD='\033[1m'
NC='\033[0m'

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

# .env 파일이 있으면 환경변수로 로드 (키 값은 콘솔에 노출하지 않음)
if [ -f "$ROOT/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    trimmed="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [[ -z "$trimmed" || "$trimmed" =~ ^# ]] && continue
    if [[ "$trimmed" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      key="${trimmed%%=*}"
      val="${trimmed#*=}"
      val="${val%\"}"
      val="${val#\"}"
      val="${val%\'}"
      val="${val#\'}"
      export "$key"="$val"
    fi
  done < "$ROOT/.env"
fi

# 로컬 DB 기본 환경변수 세팅 (미정의 시 기본값 제공)
export MYSQL_DATABASE="${MYSQL_DATABASE:-ieobom}"
export MYSQL_USER="${MYSQL_USER:-ieobom}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-ieobom}"
export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
export DB_URL="${DB_URL:-jdbc:mysql://localhost:3306/ieobom?characterEncoding=UTF-8&serverTimezone=Asia/Seoul}"
export DB_USERNAME="${DB_USERNAME:-ieobom}"
export DB_PASSWORD="${DB_PASSWORD:-ieobom}"

# 1. DB 기동
printf "${BOLD}== 1. 데이터베이스(MySQL) 기동${NC}\n"
if command -v docker >/dev/null 2>&1; then
  # Docker 데몬이 꺼져 있는 경우 자동 실행 시도 (Windows)
  if ! docker info >/dev/null 2>&1; then
    DOCKER_EXE="/c/Program Files/Docker/Docker/Docker Desktop.exe"
    if [ -f "$DOCKER_EXE" ]; then
      printf "${YELLOW}   Docker Desktop이 꺼져 있어 자동으로 실행합니다...${NC}\n"
      cmd.exe //c start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>/dev/null || true
      
      # 최대 40초 대기
      printf "   Docker 시작 대기 중"
      for i in {1..20}; do
        if docker info >/dev/null 2>&1; then
          printf "\n"
          break
        fi
        printf "."
        sleep 2
      done
    fi
  fi

  if docker info >/dev/null 2>&1; then
    (cd "$ROOT" && docker compose up -d)
    printf "${GREEN}   OK - MySQL 컨테이너가 실행 중입니다.${NC}\n"
    # MySQL이 포트를 열고 준비될 때까지 잠시 대기
    printf "   MySQL 초기화 확인 중..."
    sleep 3
    printf " 완료\n"
  else
    printf "${YELLOW}   WARN - Docker 데몬이 실행 중이지 않습니다. Docker Desktop을 실행해 주세요.${NC}\n"
  fi
else
  printf "${YELLOW}   WARN - docker 명령을 찾을 수 없습니다. DB가 이미 실행 중인지 확인하세요.${NC}\n"
fi

# 2. 백엔드 및 프론트엔드 기동
printf "\n${BOLD}== 2. 백엔드 및 프론트엔드 기동${NC}\n"
if ! find_java_home; then
  printf "${RED}   FAIL - JDK 21을 찾지 못했습니다. JAVA_HOME을 설정해 주세요.${NC}\n"
  exit 1
fi
[ -n "${JAVA_HOME:-}" ] && printf "   JAVA_HOME=$JAVA_HOME\n"

API_PID=""
WEB_PID=""

cleanup() {
  trap - INT TERM EXIT
  printf "\n\n${YELLOW}== 서버를 종료합니다...${NC}\n"
  if [ -n "$API_PID" ]; then
    taskkill //F //T //PID "$API_PID" 2>/dev/null || kill -TERM "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$WEB_PID" ]; then
    taskkill //F //T //PID "$WEB_PID" 2>/dev/null || kill -TERM "$WEB_PID" 2>/dev/null || true
  fi
  (cd "$ROOT/apps/api" && ./gradlew --stop >/dev/null 2>&1 || true)
  wait 2>/dev/null || true
  printf "${GREEN}== 백엔드/프론트엔드 개발 서버가 종료되었습니다.${NC}\n"

  # Docker 및 WSL 종료 여부 확인
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    printf "\n${YELLOW}Docker DB 및 WSL을 완전히 종료하여 메모리(RAM)를 확보하시겠습니까? (y/N): ${NC}"
    read -r response < /dev/tty 2>/dev/null || response="n"
    if [[ "$response" =~ ^[Yy]$ ]]; then
      printf "   Docker 컨테이너 중지 중...\n"
      (cd "$ROOT" && docker compose down 2>/dev/null || true)
      if command -v wsl.exe >/dev/null 2>&1; then
        printf "   WSL 가상머신 종료 및 메모리 반환 중 (wsl --shutdown)...\n"
        wsl.exe --shutdown 2>/dev/null || true
      fi
      printf "${GREEN}   OK - Docker 및 WSL이 완전히 종료되었습니다.${NC}\n"
    else
      printf "   Docker DB 컨테이너를 실행 상태로 유지합니다.\n"
    fi
  fi

  printf "${GREEN}== 종료 완료.${NC}\n"
  exit 0
}

trap cleanup INT TERM EXIT

# 백엔드 실행 (백그라운드)
printf "   백엔드 기동 중 (http://localhost:8080)...\n"
(cd "$ROOT/apps/api" && ./gradlew bootRun --console=plain) &
API_PID=$!

# 프론트엔드 의존성 확인 후 실행 (백그라운드)
if [ ! -d "$ROOT/apps/web/node_modules" ]; then
  printf "   프론트엔드 의존성(npm install) 설치 중...\n"
  (cd "$ROOT/apps/web" && npm install)
fi

printf "   프론트엔드 기동 중 (http://localhost:5173)...\n"
(cd "$ROOT/apps/web" && npm run dev) &
WEB_PID=$!

printf "\n${GREEN}${BOLD}🚀 로컬 개발 환경이 시작되었습니다!${NC}\n"
printf "   - 프론트엔드 접속: ${BLUE}${BOLD}http://localhost:5173${NC}\n"
printf "   - 백엔드 API 주소: http://localhost:8080\n"
printf "   - 종료하려면 터미널에서 ${YELLOW}Ctrl + C${NC} 를 누르세요.\n\n"

# 프로세스 유지
wait
