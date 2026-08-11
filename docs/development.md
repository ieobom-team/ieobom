# 개발 환경

## 사전 준비

| 도구 | 버전 | 비고 |
|---|---|---|
| JDK | **21** (Temurin 권장) | `apps/api`. Gradle toolchain이 21로 고정돼 있다 |
| Node.js | 20 이상 | `apps/web` (아직 생성 전) |
| Docker | Desktop 또는 Engine | 로컬 MySQL 8.4 |
| GitHub CLI | 최신 | `gh auth status`로 인증 확인 |

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
| `VITE_API_BASE_URL` | `apps/web` | `VITE_` 접두사 값은 브라우저 번들에 그대로 들어간다 |

배포 환경에서는 `.env` 대신 플랫폼의 환경변수 주입 기능을 쓴다.
`application-prod.yml`에 접속 정보나 키를 직접 적지 않는다.

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
MySQL 고유 문법이 필요한 테스트가 생기면 Testcontainers 도입을 별도 Issue로 검토한다.

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

- 개발 초반은 `spring.jpa.hibernate.ddl-auto: update`로 빠르게 간다.
- **제출 전에는 Flyway 마이그레이션으로 고정한다.**
  `src/main/resources/db/migration/V1__*.sql`을 추가하고 `spring.flyway.enabled: true`로 바꾼 뒤,
  `ddl-auto`를 `validate`로 내린다.

### API 문서

Springdoc(Swagger UI)은 아직 넣지 않았다.
최신 릴리스 `springdoc-openapi 2.8.x`가 Spring Boot 3.x / Spring Framework 6 대상이라 Boot 4.1과 호환되지 않는다.
`apps/api/build.gradle`에 TODO 주석으로 자리를 잡아 뒀다.
그때까지 API 계약은 [`docs/contracts/`](./contracts)에 적는다.

## 4. 프론트엔드 (apps/web)

**아직 생성 전이다.** 생성 명령과 체크리스트는 [`apps/web/README.md`](../apps/web/README.md)에 있다.

## 5. PR 전 검증

```bash
./scripts/verify-before-pr.sh         # macOS / Linux
pwsh ./scripts/verify-before-pr.ps1   # Windows
```

아직 없는 앱은 SKIP으로 넘어간다. **검증이 실패한 상태로 PR을 만들지 않는다.**

## 6. CI

| 워크플로 | 언제 | 무엇을 |
|---|---|---|
| `.github/workflows/ci.yml` | 모든 PR·push | 필수 문서 존재 확인, 비밀값 커밋 검사 |
| `.github/workflows/api.yml` | `apps/api/**` 변경 시 | JDK 21 + `./gradlew build` (실호출 없음) |
| `api.yml` 의 `llm-live` 잡 | `ai` 라벨이 붙은 PR · 수동 실행 | `./gradlew llmLiveTest` — 실제 LLM 호출 4회 |
| `web.yml` | _아직 없음_ | `apps/web` 생성 PR에서 함께 추가 |

CI는 최종 안전망이지 로컬 검증의 대체가 아니다. `main` 병합 전 CI 통과를 사람이 확인한다.
