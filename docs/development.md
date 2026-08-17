# 개발 환경

## 사전 준비

| 도구 | 버전 | 비고 |
|---|---|---|
| JDK | **21** (Temurin 권장) | `apps/api`. Gradle toolchain이 21로 고정돼 있다 |
| Node.js | 20 이상 | `apps/web`. CI 도 20 으로 돈다 |
| Docker | Desktop 또는 Engine | 로컬 MySQL 8.4 |
| GitHub CLI | 최신 | `gh auth status`로 인증 확인 |

> 💡 **빠른 로컬 실행 (DB + 백엔드 + 프론트엔드)**  
> `./scripts/dev-run.sh` (Git Bash / Linux / macOS) 또는 `pwsh ./scripts/dev-run.ps1` (Windows)를 실행하면 한 번에 뜹니다. 접속은 `http://localhost:5173` 입니다.

## 1. 환경변수

```bash
cp .env.example .env
```

`.env`를 열어 값을 채운다. **`.env`는 절대 커밋하지 않는다.** CI가 커밋 여부를 검사한다.

| 변수 | 쓰는 곳 | 비고 |
|---|---|---|
| `MYSQL_DATABASE` `MYSQL_USER` `MYSQL_PASSWORD` `MYSQL_ROOT_PASSWORD` | `docker-compose.yml` | 로컬 MySQL 컨테이너 |
| `DB_URL` `DB_USERNAME` `DB_PASSWORD` | `apps/api` | `application.yml`이 읽는다 |
| `SERVER_PORT` | `apps/api` | 기본 8080 |
| `LLM_API_KEY` `LLM_BASE_URL` `LLM_MODEL` `LLM_TIMEOUT` | `apps/api` | **백엔드에서만 쓴다.** 프론트로 내려보내지 않는다. 비어 있어도 앱은 뜨고 테스트도 통과한다 |
| `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` | `apps/api` | 웹 푸시 발송 키 (`npx web-push generate-vapid-keys` 로 생성). 비어 있으면 푸시 발송만 비활성화 |
| `VITE_API_BASE_URL` | `apps/web` | **로컬도 배포도 비워 둔다.** 아래 설명을 읽는다 |

배포 환경에서는 `.env` 대신 플랫폼의 환경변수 주입 기능을 쓴다.
`application-prod.yml`에 접속 정보나 키를 직접 적지 않는다.

### `VITE_API_BASE_URL`을 채우지 않는 이유

**프론트와 API를 같은 출처에 두기로 했다.** ([architecture.md 배포 배치](./architecture.md#배포-배치))
개발은 `apps/web/vite.config.ts`의 `/api` 프록시가, 배포는 Caddy가 같은 일을 한다.
그래서 브라우저 기준으로 양쪽 다 출처가 하나고, **백엔드 주소를 프론트에 알려 줄 일이 없다.**

값이 비면 `shared/api/client.ts`가 상대경로 `/api`로 호출한다. 이게 의도한 동작이다.

- **로컬** — 채우지 않는다. `npm run dev`만으로 `localhost:8080`에 붙는다.
- **배포** — 주입하지 않는다. 배포 주소를 브라우저 번들에 굳혀 넣지 않아도 된다.

⚠️ **여기에 `http://localhost:8080` 같은 절대 주소를 넣으면 오히려 깨진다.**
프록시를 우회해 다른 출처로 나가게 되고, 백엔드에 CORS 설정이 없으므로 브라우저가 막는다.

> Vite는 저장소 루트의 `.env`를 읽지 않는다(`envDir` 기본값이 `apps/web`).
> 프론트에 값을 넘겨야 할 일이 생기면 `apps/web/.env`에 둔다.

## 2. 데이터베이스

```bash
docker compose up -d          # MySQL 8.4 기동
docker compose ps             # healthy 확인
docker compose logs -f mysql  # 로그
docker compose down           # 중지 (데이터는 mysql-data 볼륨에 남는다)
docker compose down -v        # 데이터까지 삭제
```

로컬도 배포도 **MySQL 8.4 LTS**로 맞춘다. H2는 백엔드 테스트에서만 쓴다.

## 3. 백엔드 (apps/api)

```bash
cd apps/api

./gradlew bootRun     # 실행 (http://localhost:8080)
./gradlew build       # 컴파일 + 테스트 + 패키징
./gradlew test        # 테스트만
```

Windows에서는 `.\gradlew.bat`을 쓴다. `JAVA_HOME`이 없으면 먼저 잡는다.

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\temurin-21.0.10"
```

**헬스체크:** `GET http://localhost:8080/actuator/health`

### 테스트가 DB 없이 도는 이유

`src/test/resources/application.yml`이 H2 인메모리를 쓰고 Flyway를 끈다.
그래서 CI와 개발자 로컬에서 DB 컨테이너 없이도 `./gradlew build`가 통과한다.

⚠️ **그래서 테스트는 Flyway 마이그레이션을 검증하지 못한다.** `./gradlew build`가 초록이어도
V1이 MySQL에서 실제로 도는지는 확인되지 않는다. 확인 방법은
[`db-schema.md`](./contracts/db-schema.md#테스트가-이-스키마를-검증하지-못한다)에 적어 뒀다.
Testcontainers로 이 확인을 CI에 넣는 것은 별도 Issue로 뗐다.

### LLM 실호출 확인

AI를 쓰는 테스트는 기본적으로 **실제 호출 없이** 돈다. `HandoverStructuringClient`와 `ExportPhraseClient`를
stub으로 바꿔 끼우기 때문이다. 그래서 `./gradlew build`는 키가 없어도 통과하고 크레딧도 쓰지 않는다.

다만 **스키마가 실제로 걸리는지, 근거가 정말 원문·카드 안에서 나오는지는 stub으로 확인할 수 없다.**
그 확인은 별도 태스크로 뗐다.

```bash
cd apps/api

# macOS / Linux
LLM_API_KEY=... ./gradlew llmLiveTest

# Windows PowerShell
$env:LLM_API_KEY = "..."; .\gradlew.bat llmLiveTest
```

- 실행당 호출은 **4회**다. 구조화 2회(`OpenAiStructuringLiveTest`) + 문구 생성 2회(`OpenAiExportPhraseLiveTest`).
  `build`에 매달지 않았으므로 push나 CI에서 저절로 나가지 않는다.
- `LLM_API_KEY`가 없으면 테스트가 실패가 아니라 **skip**된다.
- 모델이 만드는 문장은 매번 다르므로 문구를 단정하지 않는다.
  근거가 원문 안에 있는지, 역할 목록 밖 직종이 나오지 않는지, 카드에 없는 숫자를 지어내지 않는지 같은 **계약만** 본다.

CI에서는 `ai` 라벨이 붙은 PR과 수동 실행(`workflow_dispatch`)에서만 이 태스크가 돈다.
저장소 Secret `LLM_API_KEY`를 쓰며, 키가 비어 있으면 조용히 skip되지 않도록 잡을 먼저 실패시킨다.

### 스키마 관리

**스키마는 Flyway가 만들고 Hibernate는 검증만 한다.** (`spring.flyway.enabled: true` + `ddl-auto: validate`)
테이블·컬럼·제약과 마이그레이션 규칙은 [`docs/contracts/db-schema.md`](./contracts/db-schema.md)에 있다.

- 엔티티를 고치면 **같은 PR에서** `src/main/resources/db/migration/`에 `V2__…`처럼 새 파일을 추가한다.
- **`V1__init.sql`은 고치지 않는다.** 이미 적용된 DB에서 체크섬이 어긋나 기동이 막힌다.
- 엔티티와 DB가 한 글자만 달라도 **기동이 실패한다.** `ddl-auto: validate`라서 그렇다.

> ⚠️ **V1이 병합되면 각자 로컬 DB를 한 번 초기화한다.**
>
> ```bash
> docker compose down -v && docker compose up -d
> ```
>
> `baseline-on-migrate: true`라서 이미 `ddl-auto: update`로 자란 로컬 DB는 baseline으로 찍히고
> V1을 건너뛴다. 로컬은 안 깨지지만 **로컬(baseline)과 배포(빈 DB → V1 실행)가 서로 다른 경로로
> 만들어진 스키마를 쓰게 된다.** 한 번 비우면 그 비대칭이 사라진다.
> **로컬 데이터는 시더가 다시 넣는 시드뿐이라 잃을 것이 없다.**

### API 문서

Springdoc(Swagger UI)은 아직 넣지 않았다.
최신 릴리스 `springdoc-openapi 2.8.x`가 Spring Boot 3.x / Spring Framework 6 대상이라 Boot 4.1과 호환되지 않는다.
`apps/api/build.gradle`에 TODO 주석으로 자리를 잡아 뒀다.
그때까지 API 계약은 [`docs/contracts/`](./contracts)에 적는다.

## 4. 프론트엔드 (apps/web)

React 19 + TypeScript + Vite. 스타일은 Tailwind CSS v4, 서버 상태는 TanStack Query,
화면 전환은 `react-router`(선언형 `BrowserRouter`)를 쓴다.

```bash
cd apps/web

npm install           # 처음 한 번
npm run dev           # 실행 (http://localhost:5173)
npm run lint          # oxlint
npm test              # vitest 1회 실행
npm run test:watch    # vitest watch
npm run build         # tsc -b + vite build
```

백엔드는 `vite.config.ts`의 `/api` 프록시로 붙는다. **`VITE_API_BASE_URL`은 비워 둔다.**
([위 설명](#vite_api_base_url을-채우지-않는-이유))

**`VITE_` 접두사 값은 브라우저 번들에 그대로 들어가므로 API 키나 비밀값을 넣지 않는다.**

### 디렉터리

```
apps/web/src/
├── features/<도메인>/     화면과 그 도메인 전용 로직 (session, handover, ...)
├── routes/                라우트 정의와 진입 가드
├── shared/api/            백엔드 호출 한 겹과 쿼리 캐시 설정
├── shared/ui/             여러 화면이 함께 쓰는 UI 조각
└── test/setup.ts          vitest 공통 설정
```

`shared/api/client.ts`는 서버 오류 응답의 `fields`를 살려 `ApiError`로 던진다.
**보완할 항목을 한 번에 모아 보여 주는 화면이 이 목록에 기대고 있으므로** 메시지 한 줄로 뭉개지 않는다.

### 테스트

`vitest` + `@testing-library/react` + `jsdom`이다. 테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다.

```bash
npm test -- src/routes            # 경로로 좁혀 실행
npm test -- -t "본인 바꾸기"       # 이름으로 좁혀 실행
```

브라우저 저장소를 쓰는 코드가 있으므로 `src/test/setup.ts`가 매 테스트 뒤에 DOM 과 `localStorage`를 비운다.
**진입 선택값이 테스트 사이에 새면 다음 테스트가 이미 로그인된 것처럼 보이므로** 이 정리를 지운 채로 테스트를 늘리지 않는다.

### 진입 역할과 담당 직종

로그인이 없다. 진입 시 **역할 2종과 본인**을 고르고 그 값을 이후 화면의 입력자 식별로 쓴다.
업무 배정에 쓰는 **담당 직종 5종은 다른 개념이며 섞지 않는다.** ([architecture.md 인증](./architecture.md#인증))

직원 명단(`features/session/staffDirectory.ts`)은 **서버에서 받아 온다.** (`GET /api/staff`, #33, #83)
기기에 캐시해 두고, 공용 기기 보호를 위해 선택형 4~6자리 숫자 PIN(`PinPadModal`, `PinSettingsModal`)을 지원한다.

**어르신 목록도 마찬가지다.** `GET /api/care-recipients`로 서버에서 받아 온다.
인계 등록이 서버가 발급한 `careRecipientId`를 요구하므로 프론트 상수로 두면 id 를 추측하게 된다.

## 5. PR 전 검증

```bash
./scripts/verify-before-pr.sh         # macOS / Linux
pwsh ./scripts/verify-before-pr.ps1   # Windows
```

백엔드는 `gradlew build`, 프론트엔드는 `lint` · `test` · `build`를 돌리고 비밀 파일이 추적되는지 본다.
아직 없는 앱은 SKIP으로 넘어간다. **검증이 실패한 상태로 PR을 만들지 않는다.**

## 6. CI

| 워크플로 | 언제 | 무엇을 |
|---|---|---|
| `.github/workflows/ci.yml` | 모든 PR·push | 필수 문서 존재 확인, 비밀값 커밋 검사 |
| `.github/workflows/api.yml` | `apps/api/**` 변경 시 | JDK 21 + `./gradlew build` (실호출 없음) |
| `api.yml` 의 `llm-live` 잡 | `ai` 라벨이 붙은 PR · 수동 실행 | `./gradlew llmLiveTest` — 실제 LLM 호출 4회 |
| `web.yml` | `apps/web/**` 변경 시 | Node 20 + `npm run lint` · `npm test` · `npm run build` |

CI는 최종 안전망이지 로컬 검증의 대체가 아니다. `main` 병합 전 CI 통과를 사람이 확인한다.

## 7. 배포

VM 한 대에 **Caddy · API · MySQL**을 `docker compose`로 함께 올린다.
왜 같은 출처에 두는지는 [architecture.md 배포 배치](./architecture.md#배포-배치)에 있다.

| 파일 | 무엇 |
|---|---|
| `deploy/docker-compose.yml` | 배포용 compose. **루트의 `docker-compose.yml`과 다른 파일이다** (그쪽은 로컬 MySQL 단독) |
| `deploy/Caddyfile` | HTTPS 자동 발급, `/api` → `api:8080`, 나머지는 정적 + SPA 폴백 |
| `deploy/.env.example` | 배포용 환경변수 **이름만**. 값은 채우지 않는다 |
| `apps/api/Dockerfile` | JDK 21 빌드 → JRE 21 실행 (멀티스테이지) |
| `apps/web/Dockerfile` | Node 20 빌드 → Caddy 이미지에 `dist` 탑재 |

```bash
cp deploy/.env.example deploy/.env      # 값을 채운 뒤 (커밋하지 않는다)
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f api
```

이미지 빌드와 compose 문법만 확인하려면 이렇게 한다.

```bash
docker build -t ieobom-api apps/api
docker build -t ieobom-web apps/web
docker compose -f deploy/docker-compose.yml config
```

> `config`는 `deploy/.env`를 읽는다. 파일이 없으면 필수 변수가 비어 있다며 실패한다.
> **그게 의도한 동작이다.** Public 저장소라 비밀값에 기본값을 넣어 두지 않았고,
> 값이 비면 배포되는 대신 기동이 막힌다.

**배포 실행과 비밀값 주입은 사람이 한다.** (`AGENTS.md` 승인 경계 등급 D)
`SITE_ADDRESS` · `MYSQL_PASSWORD` · `MYSQL_ROOT_PASSWORD` · `LLM_API_KEY`가 그 대상이다.
`LLM_API_KEY`가 없으면 앱은 뜨지만 AI 구조화가 503으로 끊긴다.
