# contracts

**코드와 함께 바뀌는 기술 계약**만 둔다.

- REST API 요청·응답 스펙
- AI 구조화 결과의 JSON Schema
- DB 스키마 / Flyway 마이그레이션 설계

## 지금 있는 것

| 파일 | 범위 |
|---|---|
| [`handover-api.md`](handover-api.md) | `GET /api/staff` 직원 명단, `GET /api/care-recipients` 어르신 목록, `POST /api/handovers` 현장 특이사항 입력. **모든 API가 공유하는 오류 응답 형태**를 여기서 정의한다 |
| [`handover-card-schema.md`](handover-card-schema.md) | AI 구조화 결과의 JSON Schema와 카드 API. **무엇이 카드가 되지 못하는지**를 여기서 정의한다 |
| [`export-api.md`](export-api.md) | 전산 기록 문구 · 보호자 전달 문구 API. **근거 없는 내용을 문구에서 어떻게 막는지**를 여기서 정의한다 |
| [`task-api.md`](task-api.md) | 후속 업무 배정 · 완료 처리 API. **기한이 왜 당일 시각인지**를 여기서 정의한다 |

## 채워 나가는 방식

Manyfast에 PRD와 요구사항 5개 · 기능 6개가 올라와 있지만 **Spec은 아직 0개다.**
그래서 화면 단위 동작은 정해졌어도 아직 구현하지 않은 엔드포인트를 확정할 근거가 부족하다.
계약을 미리 추측해서 적으면 곧 틀린 문서가 되고, 틀린 문서는 없는 문서보다 나쁘다.

**API를 구현하는 PR에서 그 API의 계약을 이 디렉터리에 함께 추가한다.**
계약이 바뀌는 PR은 코드와 이 문서를 같은 PR에서 고친다.

## 여기 두지 않는 것

- **Manyfast 원문을 복제하지 않는다.** 제품이 어떻게 동작해야 하는지는 Manyfast가 기준이다.
  여기에는 "그래서 JSON이 어떻게 생겼나"만 적는다.
- 회의록·결정 배경 — Notion
- 실행 방법·환경변수 — [`docs/development.md`](../development.md)

## 앞으로 채울 파일

```
docs/contracts/
├── handover-api.md          GET /api/staff, GET /api/care-recipients, POST /api/handovers (대리 입력·정보 출처 포함)  ← 작성됨
├── handover-card-schema.md  AI 구조화 결과 JSON Schema (근거 원문 필수 필드)   ← 작성됨
├── export-api.md            전산 기록 문구 · 보호자 전달 문구 생성                  ← 작성됨
├── task-api.md              후속 업무 배정·완료 — 담당 직종, 당일 HH:MM 기한, 미처리/완료  ← 작성됨
└── db-schema.md             테이블·관계
```

## v0.3-plan-0813에서 늘어난 계약

명세가 갱신되면서 아래 계약이 바뀐다. **위 규칙대로 각 API를 구현하는 PR에서 함께 고친다.**
지금 미리 적으면 틀린 문서가 된다.

| 파일 | 무엇이 늘어나나 | Issue |
|---|---|---|
| `handover-api.md` | 어르신 명단 등록·수정 API / 음성 원본 저장 | #42, #44 |
| `handover-card-schema.md` | LLM 호출 전 실명→내부 ID 치환 시점과 식별자 규칙 | #43 |
| `export-api.md` | 문구 파일 출력 (`.txt` · `.md` · `.xlsx` · `.docx`) | #45 |
| `../architecture.md` | `CareRecipient.code`가 가명처리의 내부 ID임을 명시 / 음성 원본 필드 / 시드 서술 | #42, #43, #44 |
