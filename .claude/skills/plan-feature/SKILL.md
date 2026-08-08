---
name: plan-feature
description: Manyfast의 Requirement/Feature/Spec을 검토 가능한 GitHub Issue 초안으로 분해한다. 기능을 착수하기 전 작업 쪼개기, Issue 일괄 생성 준비, 우선순위(P0/P1/P2) 배정이 필요할 때 사용한다.
---

# plan-feature

Manyfast 명세를 **하나의 PR로 끝나는 크기**의 GitHub Issue 초안으로 분해한다.

## 절차

0. **이름 있는 기준 버전이 있는지 확인한다.** 자동 저장(`v1`, `v2`)만 있으면 Issue를 만들 수 없다.
   Issue template의 "기준 버전"이 필수 항목이기 때문이다. 없으면 `sync-manyfast`의 버전 규칙대로 먼저 저장한다.
1. 지정된 Manyfast **Requirement / Feature / Spec**을 읽는다.
2. 범위, 완료 조건, 범위 제외, 미결정 질문을 추출한다.
3. **하나의 Issue가 하나의 검토 가능한 PR**이 되도록 분해한다.
   너무 크면 쪼개고, 하나로 묶어야 리뷰가 쉬우면 묶는다.
4. 각 Issue 초안에 아래를 작성한다.
   - 제목 (`[feat] ...`)
   - 목적
   - **Manyfast 참조 ID와 기준 버전**
   - 완료 조건 (데모/QA에서 독립 확인 가능한 형태로)
   - **범위 제외**
   - 의존성 (선행 Issue)
   - 예상 영향 파일
   - 위험 · 미결정
5. `P0` / `P1` / `P2`와 영역 라벨(`frontend` `backend` `ai` `infra` `docs`)을 제안한다.
6. 마일스톤을 제안한다. (`docs/conventions.md` 참고)

## 경계

- **승인 전에는 Issue를 실제로 생성하지 않는다.** 초안만 제시한다.
- Manyfast에 없는 기능을 추측해서 Issue로 만들지 않는다.
  명세가 부족하면 그 사실을 보고하고 `propose-change` 또는 `sync-manyfast`로 넘긴다.
- MVP 범위를 넓히는 분해는 하지 않는다. 범위 밖 아이디어는 Backlog Issue 초안으로 따로 뺀다.

## 출력 형식

```
### Issue 1 — [feat] 인계 텍스트 입력 폼
- Manyfast: R-LIEATL / F-XXXXXX / S-XXXXXX · v0.1-core-flow
- 관련 화면: n14 텍스트 입력 화면
- 목적:
- 완료 조건:
  - [ ]
- 범위 제외:
- 의존성: 없음
- 예상 파일:
- 라벨: frontend, P0
- 마일스톤: 코어 플로우
```
