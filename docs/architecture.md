# 구조

> ⚠️ **이 문서는 기획 확정 전 초안이다.**
> 확정된 개발 명세는 **Manyfast**에 있고, 이 문서는 그것을 코드 구조로 옮긴 계획일 뿐이다.
> 둘이 어긋나면 Manyfast가 맞다. 구조를 바꿔야 하면 `propose-change` 절차를 따른다.

## 디렉터리

```
ieobom/
├── apps/
│   ├── web/                  React + TypeScript + Vite (생성 전)
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
│   └── workflows/            ci.yml (가드) · api.yml (백엔드 빌드)
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
| `recipient` | 어르신(`CareRecipient`) |
| `handover` | 원본 인계 입력 — 음성·텍스트·체크로 들어온 그대로 |
| `handovercard` | AI가 구조화한 어르신별 카드 |
| `task` | 담당자 배정, 미처리/완료 상태 |
| `ai` | LLM 호출, JSON Schema 강제, 응답 검증 |
| `export` | 전산 붙여넣기용 정제 텍스트 생성 |

AI 호출은 추상화 라이브러리를 쓰지 않고 `RestClient`로 직접 호출한다.
해커톤 기간에는 디버깅과 JSON 검증이 단순한 쪽이 낫다.

## 엔티티 (초안 4개)

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

| 엔티티 | 핵심 필드(예정) |
|---|---|
| `CareRecipient` | 이름, 식별번호 |
| `Handover` | 원문 텍스트, 입력 방식(음성/텍스트/체크), 입력 시각, 입력자 이름 |
| `HandoverCard` | 어르신, 시간, 변화, 조치, 다음 행동, **근거 원문 문장**, 안전 관련 여부 |
| `Task` | 카드, 담당 직종, 담당자 이름, 상태(미처리/완료), 완료 시각, 완료 기록자 |

`Task.완료 기록자`가 담당자와 달라도 된다. **대리 완료 처리**가 설계상 허용된다.
현장에서 확인한 사람이 대신 눌러도 루프가 닫혀야, 전원이 앱을 설치하지 않아도 동작한다.

## 화면 역할 분리

| | 모바일 (현장) | 웹 (정리·관리) |
|---|---|---|
| 언제 | 돌봄 중, 상태 변화가 생긴 그 순간 | 프로그램 시간 / 하원 후 |
| 무엇을 | 한 번 남기기 · 내 할 일 확인 · 완료 체크 | 카드 검토·수정 · 미처리 현황 · 붙여넣기 텍스트 복사 |
| 왜 갈리나 | 돌봄 중엔 컴퓨터 앞에 못 감 | 서술형 기록은 결국 PC 전산에 들어감 |

**웹을 먼저 만들고 반응형으로 모바일을 커버한다.** 네이티브 앱은 만들지 않는다.

## 인증

**로그인·계정·권한 모델을 만들지 않는다.** 화면 안에서 이름을 고르는 것으로 역할을 구분한다.
대회 가이드가 로그인 최소화를 권장하고, 사용자 상당수가 고령이며, 남은 기간이 짧다 —
세 조건이 같은 답을 가리킨다.

## AI 구조화 규칙

- LLM 응답은 **JSON Schema로 강제**한다. 자유 텍스트 파싱에 의존하지 않는다.
- 카드의 모든 항목에는 **근거가 된 원문 문장**을 함께 담는다.
- **근거가 없으면 항목을 만들지 않는다.** 스키마 검증에서 근거 필드가 비면 거부한다.
- 안전 관련 항목(낙상·발열·식사 저하·투약 변경)은 우선순위 상단에 배치한다.
- 의료적 판단·진단·투약 권고는 생성하지 않는다.
