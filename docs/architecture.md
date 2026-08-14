# 구조

> ⚠️ **이 문서는 기획 확정 전 초안이다.**
> 확정된 개발 명세는 **Manyfast**에 있고, 이 문서는 그것을 코드 구조로 옮긴 계획일 뿐이다.
> 둘이 어긋나면 Manyfast가 맞다. 구조를 바꿔야 하면 `propose-change` 절차를 따른다.

## 디렉터리

```
ieobom/
├── apps/
│   ├── web/                  React 19 + TypeScript + Vite + Tailwind v4
│   └── api/                  Spring Boot 4.1.0 / Java 21
├── docs/
│   ├── development.md        로컬 실행·환경변수·검증
│   ├── architecture.md       이 문서
│   ├── conventions.md        브랜치·커밋·PR·라벨
│   ├── submission.md         대회 제출 요건
│   └── contracts/            API · JSON · DB 계약
├── .claude/skills/           에이전트 절차 4종
├── .agent/                   긴 작업의 세션 앵커 (current-task.md 는 미추적)
├── .github/
│   ├── ISSUE_TEMPLATE/       feature · bug · chore
│   ├── pull_request_template.md
│   └── workflows/            ci.yml (가드) · api.yml (백엔드 빌드) · web.yml (프론트 검증)
├── scripts/                  verify-before-pr.sh / .ps1
├── docker-compose.yml        MySQL 8.4
├── AGENTS.md                 에이전트 공통 규칙
└── CLAUDE.md / GEMINI.md     @AGENTS.md
```

모노레포 하나로 간다. 제출 시 프론트/백 두 칸에 같은 URL을 넣는다. ([submission.md](./submission.md))

## 배포 배치

**프론트와 API 를 같은 출처(same-origin)에 둔다.** 리버스 프록시 하나가 앞에 서고,
그 뒤에 정적 산출물과 API 가 붙는다. 브라우저 기준으로는 주소가 하나다.

```
사용자 → https://<서브도메인>.duckdns.org
           ↓
        Caddy (HTTPS 자동 발급·갱신)
        ├─ /      → apps/web 빌드 산출물 (정적)
        └─ /api   → Spring Boot :8080
                      ↓
                   MySQL 8.4 (같은 compose, 볼륨)
```

VM 한 대에 `docker compose` 로 Caddy · API · MySQL 을 함께 올린다.
배포 구성 파일(Dockerfile · compose · Caddyfile)은 [#19](https://github.com/ieobom-team/ieobom/issues/19)에서 만든다.

### 왜 같은 출처인가

- **CORS 설정이 필요 없다.** 백엔드에 CORS 코드가 한 줄도 없고([#37](https://github.com/ieobom-team/ieobom/issues/37)),
  그 상태 그대로 배포된다. 개발 편의로 열어 둔 와일드카드가 배포까지 따라갈 위험 자체가 없다.
- **개발과 배포의 모양이 같다.** 개발은 `apps/web/vite.config.ts` 의 `/api` 프록시가,
  배포는 Caddy 가 같은 일을 한다. 양쪽 다 브라우저에서 같은 출처다.
- **`VITE_API_BASE_URL` 을 배포에서 주입하지 않는다.** 값이 비면 `shared/api/client.ts` 가
  상대경로 `/api` 로 호출한다. 배포 주소를 번들에 굳혀 넣지 않아도 된다. ([development.md](./development.md#1-환경변수))
- **HTTPS 가 필요하다.** 음성 입력(`features/handover/speechRecognition.ts` 의 `webkitSpeechRecognition`)은
  secure context 에서만 동작한다. 공인 IP 에 `http://` 로 붙이면 배포에서 음성 입력이 그냥 실패한다.
  Caddy 가 Let's Encrypt 인증서를 자동으로 처리한다.
- **제출 링크가 서버에 묶이지 않는다.** 도메인을 우리가 통제하므로 서버를 옮기거나 IP 가 바뀌어도
  README 의 링크는 그대로다. 코드 수정이 아니라 DNS 변경으로 대응한다.
  (제출 마감 후 코드 수정은 탈락 사유다. [submission.md](./submission.md))

다른 출처에 두고 백엔드에 CORS 를 여는 안은 채택하지 않았다.
허용 출처 환경변수 · 프리플라이트 · 와일드카드 관리가 따라붙는데, 남은 기간에 늘릴 표면이 아니다.

## 백엔드 패키지

`com.ieobom.api` 아래 **도메인별로** 나눈다. 계층(controller/service/repository)이 아니라 도메인이 1차 기준이다.

| 패키지 | 책임 |
|---|---|
| `common` | 도메인이 함께 쓰는 값 — `JobRole`(담당 직종 5종), `SafetyKeyword`(지정 키워드 4종), `BaseTimeEntity`(생성·수정 시각) |
| `recipient` | 어르신(`CareRecipient`) |
| `staff` | 직원 명단(`Staff`) — 진입 화면의 본인 선택 목록. 계정이 아니다 |
| `handover` | 원본 인계 입력 — 음성·텍스트·체크로 들어온 그대로 |
| `handovercard` | AI가 구조화한 어르신별 카드 |
| `task` | 담당자 배정, 당일 기한, 미처리/완료 상태 |
| `ai` | LLM 호출, JSON Schema 강제, 응답 검증 |
| `export` | 출력 문구 생성 — **전산 붙여넣기용**과 **보호자 전달용** 두 가지 |

AI 호출은 추상화 라이브러리를 쓰지 않고 `RestClient`로 직접 호출한다.
해커톤 기간에는 디버깅과 JSON 검증이 단순한 쪽이 낫다.

## 프론트엔드 구조

백엔드와 같은 기준으로 **도메인별로** 나눈다. 계층이 아니라 도메인이 1차다.

```
apps/web/src/
├── features/session/      진입 역할·본인 식별, 직원 명단 조회·캐시, 진입 선택값 보관
├── features/field/        현장 근무자 홈 (모바일)
├── features/admin/        관리자 홈 (웹)
├── routes/                라우트 정의(`AppRoutes`)와 진입 가드(`RequireSession`)
├── shared/ui/             여러 화면이 함께 쓰는 UI 조각
└── test/setup.ts          vitest 공통 설정
```

화면 전환은 `react-router`의 선언형 `BrowserRouter`를 쓴다.
검증은 `oxlint` · `vitest`(+ `@testing-library/react`, `jsdom`) · `tsc -b && vite build` 세 가지다.

## 엔티티

인계 흐름을 잇는 네 엔티티다. `Staff`는 여기에 붙지 않고 따로 선다 — 아래 표 다음에 적었다.

```
CareRecipient   어르신
      │ 1
      │
      │ N
HandoverCard ───┐ N          1 ┌─── Handover      원본 인계 입력 (발화 한 덩어리)
   구조화 카드   │ ─────────────┘        │ 1
      │ 1                                │ 0..1
      │                             HandoverAudio   원본 음성 (음성 입력일 때만)
      │ N
    Task        후속 업무 (담당자 · 미처리/완료)
```

모든 엔티티가 `BaseTimeEntity`를 상속해 `createdAt` · `updatedAt`을 갖는다.
아래에서 *(선택)* 표시가 없는 필드는 `nullable = false`다.

| 엔티티 | 필드 |
|---|---|
| `CareRecipient` | `name` 이름, **`code` 내부 ID(unique)**, `dischargedAt` 이용 종료 시점(선택) |
| `Handover` | `careRecipient`, `rawText` 원문, `inputMethod`(`VOICE`/`TEXT`/`CHECK`), `occurredAt` 입력 시점, `reporterName` 입력자 이름, **`proxyInput` 대리 입력 여부**, **`infoSource` 정보 출처**(`GUARDIAN`/`DRIVER`/`COLLEAGUE`/`OTHER`, 선택), **`audioMimeType` 원본 음성 형식**(선택 — 있으면 들을 음성이 있다는 뜻) |
| `HandoverAudio` | `handover`(unique), `data` 음성 바이트(`MEDIUMBLOB`) |
| `HandoverCard` | `handover`, `careRecipient`(선택), `observedAt` 시각(선택), `statusChange` 변화(선택), `actionTaken` 조치(선택), `nextAction` 다음 행동(선택), **`evidenceText` 근거 원문 문장**, `safetyRelated` 안전 관련 여부, **`safetyFlagSource` 판정 출처**(`KEYWORD`/`STAFF`, 선택), **`reviewStatus` 검토 상태**(`NEEDS_REVIEW`/`REVIEWED`), `suggestedJobRole` 제안 직종(선택), `suggestedDueTime` 제안 기한(선택) |
| `Task` | `handoverCard`, `content` 업무 내용, `assigneeJobRole` 담당 직종(선택), `assigneeName` 담당자 이름(선택), **`dueTime` 기한(`LocalTime`, 당일 HH:MM)**, `status`(`PENDING`/`DONE`), `completedAt` 완료 시각(선택), `completedByName` 완료 기록자(선택) |

**원본 음성은 테이블을 나눠 둔다.** 카드 조회는 원문을 `join fetch`로 함께 읽는데(`HandoverCardRepository`),
음성 바이트가 `Handover`에 있으면 카드 한 장을 볼 때마다 그날 녹음이 통째로 메모리에 올라온다.
그래서 바이트는 `HandoverAudio`에 두고, "음성이 있는지"만 `Handover.audioMimeType`으로 남긴다.
데모 규모라 파일 스토리지 없이 DB에 넣고, 한 건 상한은 10MB다(화면은 5분에서 스스로 멈춘다). ([#44](https://github.com/ieobom-team/ieobom/issues/44))

**`Staff`는 위 그림에 없다.** 직원 명단(`name` 이름, `code` 사번(unique))은 진입 화면이 본인 선택 목록을
그릴 때만 읽고, 인계·업무는 직원을 **이름 문자열**로 가리키므로 연관관계를 걸지 않는다.
외래키를 걸려면 이름 대신 직원 id를 저장해야 하는데, 그 결정은 아직 하지 않았다. (인증 절 참고)

**`CareRecipient.code`가 내부 ID다.** 가명처리용 필드를 따로 두지 않는다.
LLM 호출 전에 실명을 바꿔 넣는 값이 이 `code`이고, 화면에 그릴 때만 실명으로 되돌린다.
동명이인을 화면에서 구분하는 식별번호와 같은 값이며, 형식은 **접두어 `IB-` + 순번**이다.
발급은 `RecipientCodeIssuer`가 하고, 순번은 개수가 아니라 **이미 쓰인 최대 순번 + 1**이다. ([#42](https://github.com/ieobom-team/ieobom/issues/42))

**어르신 명단은 화면에서 관리한다.** 관리자가 `/admin/care-recipients`에서 등록·이름 수정·이용 종료
표시를 한다. **삭제는 없다** — 기존 인계 기록과 카드가 어르신을 가리키고 있어서, 지우면 이미 남긴
기록이 대상을 잃는다. 이용 종료로 표시한 어르신은 새 입력의 대상 목록에서만 빠지고,
AI가 발화를 어르신별로 분리할 때 쓰는 이름 대조 후보(`CardDraftVerifier`)에는 그대로 남는다.

**어르신 시드.** `CareRecipientSeeder`가 기동 시 데모용 어르신 20명(`IB-001`~`IB-020`)을 채운다.
식별번호 단위로 확인하고 넣으므로 여러 번 기동해도 중복이 쌓이지 않는다. 이름은 모두 가상 인물이다.
화면에서 등록한 어르신은 `IB-021`부터 이어지므로 시드와 겹치지 않는다.

**직원 시드.** `StaffSeeder`가 같은 방식으로 데모용 직원 8명(`ST-001`~`ST-008`)을 채운다.
명단이 비면 진입 화면에서 본인을 고를 수 없어 앱 전체가 시작되지 않는다.

**`HandoverCard.careRecipient`가 비어 있을 수 있는 이유.** 대상 어르신을 분리할 수 없는 원문은
확정 카드로 만들지 않고 사람에게 넘긴다. 이때 어르신 없이 `검토 필요` 상태로 남는다.
반면 `Handover.careRecipient`는 입력 시 반드시 고르므로 필수다.

**대리 입력.** `Handover.대리 입력 여부`와 `정보 출처`는 입력자와 별개로 저장한다.
운전원이 등원 시 보호자에게 들은 내용을 데스크 근무자가 대신 남기는 것이 기본 경로다.
수행자에게 앱 설치를 요구하지 않으려면 입력 지점과 정보 출처가 분리돼야 한다.

**검토 상태.** `검토 필요` / `검토 완료` **두 값만** 쓴다.
출력 문구 생성은 `검토 완료` 카드에서만 가능하다.

**기한.** `Task.기한`은 **당일 시각(HH:MM)** 단위다. 날짜 단위 기한과 익일 기한은 쓰지 않는다.
어르신이 당일 귀가하므로 기본 상한은 **당일 하원 시각**이다.
하원까지 미완료된 업무는 다음 날로 자동 승계하지 않고 하원 미처리 브리핑에서 확인한다.
상태는 **미처리 / 완료 두 값만** 쓴다. 진행 중·접수·확인 같은 중간 상태를 추가하지 않는다.

`Task.완료 기록자`가 담당자와 달라도 된다. **대리 완료 처리**가 설계상 허용된다.
현장에서 확인한 사람이 대신 눌러도 루프가 닫혀야, 전원이 앱을 설치하지 않아도 동작한다.

## 화면 역할 분리

| | 모바일 (현장) | 웹 (정리·관리) |
|---|---|---|
| 언제 | 돌봄 중, 상태 변화가 생긴 그 순간 | 프로그램 시간 / **하원 직전** / 하원 후 |
| 무엇을 | 한 번 남기기 · 내 할 일 확인 · 완료 체크 | 카드 검토·수정 · 당일 현황 · **하원 미처리 브리핑** · 문구 복사 |
| 왜 갈리나 | 돌봄 중엔 컴퓨터 앞에 못 감 | 서술형 기록은 결국 PC 전산에 들어감 |

**웹을 먼저 만들고 반응형으로 모바일을 커버한다.** 네이티브 앱은 만들지 않는다.

**하원 미처리 브리핑**은 지연 재알림이나 다음 교대 자동 승계를 대신하는 장치다.
그 둘은 MVP 범위 밖이므로, 당일 마감은 사람이 이 화면에서 눈으로 닫는다.

## 오프라인 입력

현장 입력은 네트워크가 끊겨도 유실되면 안 된다.

- 저장 중 연결이 실패하면 입력 내용을 **기기에 임시 저장**하고 연결이 회복되면 **자동 재전송**한다.
- 재전송 대기 중인 입력이 있으면 화면에 그 상태를 표시한다.
- **돌봄 중인 근무자에게 재입력을 요구하지 않는다.** 실패 안내로 끝내지 않는다.

## 인증

**로그인·계정·권한 모델을 만들지 않는다.** 대회 가이드가 로그인 최소화를 권장하고,
사용자 상당수가 고령이며, 남은 기간이 짧다 — 세 조건이 같은 답을 가리킨다.

대신 **역할을 두 층으로 나눈다.** 이 둘을 섞지 않는 것이 중요하다.

| | 값 | 쓰는 곳 |
|---|---|---|
| **진입 역할** | 현장 근무자 / 관리자·센터장 **2종** | 앱 진입 시 선택. 어떤 화면을 보여줄지 결정 |
| **담당 직종** | 요양보호사 · 간호조무사 · 사회복지사 · 운전원 · 센터장 **5종** | 후속 업무 배정 전용. 진입 역할과 무관 |

본인 식별은 **직원 이름 또는 사번 선택**으로 하고 비밀번호를 요구하지 않는다.
담당 직종 선택지는 Manyfast PRD의 역할 목록으로 한정한다. 목록에 없는 직종을 새로 만들지 않는다.

### 구현 (`features/session`)

- 고른 값은 **사번만** 브라우저에 저장하고 이름은 명단에서 다시 찾는다.
  명단이나 역할 값이 바뀌어 더는 맞지 않는 저장값은 **버리고 다시 고르게 한다.**
- `RequireSession`이 진입 전 화면 접근을 막고, 진입 역할과 다른 홈을 주소로 열면 자기 홈으로 되돌린다.
  **권한 검사가 아니다.** 권한 모델은 없고 어떤 화면을 보여줄지만 정한다.
- 기기 하나를 여러 직원이 돌려 쓰므로 홈 헤더에 **본인 바꾸기**를 둔다.
  이게 없으면 앞사람 이름으로 입력이 남는다.

**직원 명단은 서버가 관리한다.** (`GET /api/staff`, [#33](https://github.com/ieobom-team/ieobom/issues/33))
진입 화면이 명단을 받아 본인 선택 목록을 그리고, 후속 업무 배정 화면(`F-IVFNPC`)은 담당 직종에 맞는 직원 드롭다운을 그린다.
받아 온 명단을 기기에 캐시해 두고, 브라우저에는 **사번만** 저장하므로 선택값을 되살릴 때 이 캐시에서 이름을 다시 찾는다.
(`features/session/staffApi.ts` · `staffDirectory.ts`)

- **연결이 끊겨도 진입을 막지 않는다.** 명단을 받지 못하면 마지막으로 캐시해 둔 명단으로 고르게 하고,
  캐시까지 비어 있을 때만 오류로 알린다. 여기서 막으면 현장 근무자가 입력 자체를 못 한다.
- **직원 명단 관리 화면은 만들지 않는다.** 유저플로우 "AI 인계 도구 내비게이션 맵"에 그 화면이 없다.
  입·퇴사는 `StaffSeeder`와 DB로 반영한다. 어르신 명단([#42](https://github.com/ieobom-team/ieobom/issues/42))과 다른 점이다.
- API는 직원을 여전히 `reporterName` · `assigneeName` · `completedByName` 같은 **이름 문자열**로 받는다.
  사번을 함께 저장할지는 동명이인 구분이 실제로 필요해지는 시점에 다시 판단한다.

**어르신 명단 등록은 이 원칙의 예외가 아니다.** 등록되는 것은 어르신(데이터)이지 근무자(계정)가
아니다. 비밀번호도 로그인도 없고, 어르신이 서비스에 접속하지도 않는다. 데이터 세팅이다.
([#42](https://github.com/ieobom-team/ieobom/issues/42), Manyfast `F-LUDCWW` permissions)

## AI 구조화 규칙

> 구현된 스키마와 검증 규칙은 [`docs/contracts/handover-card-schema.md`](./contracts/handover-card-schema.md)에 있다.

- LLM 응답은 **Function Calling으로 JSON Schema를 강제**한다. 자유 텍스트 파싱에 의존하지 않는다.
  정해진 필드 외의 값을 애초에 만들 수 없게 하는 것이 목적이다.
- 카드의 모든 항목에는 **근거가 된 원문 구간**을 함께 담는다. 근거는 **필수 필드**다.
- **근거가 없으면 항목을 만들지 않는다.** 근거 필드가 비면 그 항목을 폐기하고 목록에 내보내지 않는다.
- **대상 어르신을 분리할 수 없는 원문은 확정 카드로 만들지 않는다.** 검토 대상으로 표시해 사람에게 넘긴다.
- AI가 확신하지 못한 내용은 `검토 필요`로 구분해 표시한다.
- 의료적 판단·진단·투약 권고는 생성하지 않는다. 원문에 없는 사실을 채우지 않는다.

### 안전 항목 우선 표시

**지정 키워드와 직원 직접 표시 중 하나에만 해당해도 우선 표시한다.** (`v0.1-core-flow` 확정)

- 지정 키워드는 **낙상 · 발열 · 식사 저하 · 투약 변경** 4개로 시작하고 운영하면서 보완한다.
- 직원은 카드 항목을 안전 관련으로 **직접 표시하거나 해제**할 수 있다.
- 판정 출처(키워드 자동 판정 / 직원 직접 표시)를 항목에 함께 저장한다.

키워드만 쓰면 표현이 다른 위험을 놓치고, 직원 표시만 쓰면 바쁠 때 아무도 안 누른다.
둘 중 하나로 잡히게 두는 편이 놓치는 쪽보다 낫다.

### 담당 직종 추론 매핑

| 다음 행동 | 담당 직종 |
|---|---|
| 투약 · 바이탈 확인 | 간호조무사 |
| 보호자 연락 · 상담 | 사회복지사 |
| 등하원 · 송영 | 운전원 |
| 그 외 일상 돌봄 | 요양보호사 |

- **판단 근거가 부족하면 직종을 비워 두고 직원이 지정하게 한다.** 억지로 채우지 않는다.
- 다음 행동 · 담당 직종 · 기한은 모두 **AI 제안값을 미리 채운 상태**로 배정 화면에 띄우고,
  직원이 그대로 확정하거나 수정한다. 빈 입력으로 시작하지 않는다.
- 조치·다음 행동 칸에는 AI가 발화 맥락에서 추론한 **추천 액션 칩(최대 3개)**을 함께 제시한다.
  칩은 원문 근거가 있는 내용만으로 만들고, 직접 입력 경로도 동등하게 열어 둔다. (RFC [#62](https://github.com/ieobom-team/ieobom/issues/62))
