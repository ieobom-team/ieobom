# contracts

**코드와 함께 바뀌는 기술 계약**만 둔다.

- REST API 요청·응답 스펙
- AI 구조화 결과의 JSON Schema
- DB 스키마 / Flyway 마이그레이션 설계

## 아직 비어 있는 이유

기획이 확정 전이고 Manyfast 명세가 아직 없다.
계약을 지금 적으면 곧 틀린 문서가 되고, 틀린 문서는 없는 문서보다 나쁘다.

**첫 API를 구현하는 PR에서 그 API의 계약을 이 디렉터리에 함께 추가한다.**
계약이 바뀌는 PR은 코드와 이 문서를 같은 PR에서 고친다.

## 여기 두지 않는 것

- **Manyfast 원문을 복제하지 않는다.** 제품이 어떻게 동작해야 하는지는 Manyfast가 기준이다.
  여기에는 "그래서 JSON이 어떻게 생겼나"만 적는다.
- 회의록·결정 배경 — Notion
- 실행 방법·환경변수 — [`docs/development.md`](../development.md)

## 파일 이름 예시

```
docs/contracts/
├── handover-api.md          POST /api/handovers 등
├── handover-card-schema.md  AI 구조화 결과 JSON Schema
└── db-schema.md             테이블·관계
```
