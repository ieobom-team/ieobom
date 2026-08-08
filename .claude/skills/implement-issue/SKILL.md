---
name: implement-issue
description: GitHub Issue 하나를 Manyfast 명세 기준으로 분석하고, 승인 후 브랜치 생성부터 구현·검증·PR 초안까지 수행한다. "#12 구현 준비해", "#12 진행해", "#12 명세 점검해" 같은 요청에 사용한다.
---

# implement-issue

Issue 하나를 **계획 보고 → 승인 → 구현 → 검증 → PR 초안** 순으로 처리한다.

## 절차

### 승인 전 (등급 A)

1. GitHub Issue를 읽는다. (`gh issue view <번호>`)
2. Issue가 가리키는 **Manyfast Requirement / Feature / Spec과 기준 버전**을 읽는다.
3. 관련 코드와 `docs/contracts/` 계약을 탐색한다.
4. **Issue에 Manyfast 참조 · 기준 버전 · 완료 조건 · 범위 제외 중 하나라도 없으면 여기서 멈춘다.**
   누락 항목과 보완 방법을 보고하고 팀의 결정을 기다린다.
5. 복잡하거나 하루 이상 걸릴 작업일 때만 `.agent/current-task.md`를 10~30줄로 작성한다.
6. 아래를 **한 번에** 보고한다.
   - 요구사항 요약 (Manyfast 원문 기준)
   - 변경할 파일 목록
   - 구현 순서
   - 테스트 계획
   - 위험 · 미결정 사항

**여기까지는 코드 · Issue · Manyfast를 수정하지 않는다.**

### 승인 후 (등급 B)

7. `feat/<issue-번호>-<짧은-이름>` 브랜치를 만든다. (`docs/conventions.md`)
8. 승인된 Manyfast 명세 범위 안에서만 구현한다.
9. 검증을 실행한다.
   ```bash
   pwsh ./scripts/verify-before-pr.ps1   # Windows
   ./scripts/verify-before-pr.sh         # macOS / Linux
   ```
10. 실패하면 **디버깅 로그부터 남겨 원인을 확인한 뒤** 수정한다. 최대 2회 재시도하고, 그래도 안 되면 보고한다.
11. 기술 계약(API · JSON · DB)이 바뀌었으면 `docs/contracts/`를 **같은 PR에서** 갱신한다.
12. 제품 동작이나 정책이 바뀌었으면 구현을 멈추고 `propose-change`로 넘어간다. (등급 C)
13. 범위 밖 개선점은 구현하지 말고 Backlog Issue 초안으로 분리한다.
14. **검증이 통과한 뒤에만** 커밋 · push · PR 초안을 만든다.
    PR 본문에 `Closes #<번호>`, Manyfast 참조 ID, 기준 버전, 검증 결과를 적는다.

## 경계

- `main` 병합과 배포는 **사람이 한다.** (등급 D)
- 검증 실패 상태에서 PR을 만들지 않는다.
- 비밀값(API 키·토큰·`.env`)을 커밋하지 않는다. Public 저장소다.
- Notion 회의록만 근거로 구현하지 않는다.

## 요청별 동작

| 사용자 입력 | 동작 |
|---|---|
| `#12 구현 준비해` | 1~6까지. 계획만 보고 |
| `진행해` | 승인된 계획 범위에서 7~11 |
| `#12 자동 완료 모드로 진행해` | 계획 보고 후 승인받고 14까지 |
| `#12 명세 점검해` | 구현하지 않고 Issue와 Manyfast의 누락·충돌만 보고 |
