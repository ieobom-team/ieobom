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

## 백엔드 패키지

`com.ieobom.api` 아래 **도메인별로** 나눈다. 계층(controller/service/repository)이 아니라 도메인이 1차 기준이다.

| 패키지 | 책임 |
|---|---|
| `common` | 도메인이 함께 쓰는 값 — `JobRole`(담당 직종 5종), `SafetyKeyword`(지정 키워드 4종), `BaseTimeEntity`(생성·수정 시각) |
| `recipient` | 어르신(`CareRecipient`) |
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
├── features/session/      진입 역할·본인 식별, 진입 선택값 보관
├── features/field/        현장 근무자 홈 (모바일)
├── features/admin/        관리자 홈 (웹)
├── routes/                라우트 정의(`AppRoutes`)와 진입 가드(`RequireSession`)
├── shared/ui/             여러 화면이 함께 쓰는 UI 조각
└── test/setup.ts          vitest 공통 설정
```

화면 전환은 `react-router`의 선언형 `BrowserRouter`를 쓴다.
검증은 `oxlint` · `vitest`(+ `@testing-library/react`, `jsdom`) · `tsc -b && vite build` 세 가지다.

## 엔티티 (4개)

```
CareRecipient   어르신
      │ 1
      │
      │ N
HandoverCard ───┐ N          1 ┌─── Handover      원본 인계 입력 (발화 한 덩어리)
   구조화 카드   │ ─────────────┘
      │ 1
      │
      │ N
    Task        후속 업무 (담당자 · 미처리/완료)
```

네 엔티티 모두 `BaseTimeEntity`를 상속해 `createdAt` · `updatedAt`을 갖는다.
아래에서 *(선택)* 표시가 없는 필드는 `nullable = false`다.

| 엔티티 | 필드 |
|---|---|
| `CareRecipient` | `name` 이름, `code` 식별번호(unique) |
| `Handover` | `careRecipient`, `rawText` 원문, `inputMethod`(`VOICE`/`TEXT`/`CHECK`), `occurredAt` 입력 시점, `reporterName` 입력자 이름, **`proxyInput` 대리 입력 여부**, **`infoSource` 정보 출처**(`GUARDIAN`/`DRIVER`/`COLLEAGUE`/`OTHER`, 선택) |
| `HandoverCard` | `handover`, `careRecipient`(선택), `observedAt` 시각(선택), `statusChange` 변화(선택), `actionTaken` 조치(선택), `nextAction` 다음 행동(선택), **`evidenceText` 근거 원문 문장**, `safetyRelated` 안전 관련 여부, **`safetyFlagSource` 판정 출처**(`KEYWORD`/`STAFF`, 선택), **`reviewStatus` 검토 상태**(`NEEDS_REVIEW`/`REVIEWED`), `suggestedJobRole` 제안 직종(선택), `suggestedDueTime` 제안 기한(선택) |
| `Task` | `handoverCard`, `content` 업무 내용, `assigneeJobRole` 담당 직종(선택), `assigneeName` 담당자 이름(선택), **`dueTime` 기한(`LocalTime`, 당일 HH:MM)**, `status`(`PENDING`/`DONE`), `completedAt` 완료 시각(선택), `completedByName` 완료 기록자(선택) |

**어르신 시드.** `CareRecipientSeeder`가 기동 시 데모용 어르신 20명(`IB-001`~`IB-020`)을 채운다.
식별번호 단위로 확인하고 넣으므로 여러 번 기동해도 중복이 쌓이지 않는다. 이름은 모두 가상 인물이다.

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

**직원 명단은 프론트 상수(mock)다.** (`features/session/staffDirectory.ts`)
서버에 직원 엔티티가 없고, API는 직원을 `reporterName` · `assigneeName` · `completedByName`
같은 **이름 문자열**로만 받는다. 명단을 서버가 관리해야 하면 별도 Issue로 뺀다.

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
