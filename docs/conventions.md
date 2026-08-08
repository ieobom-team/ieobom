# 협업 규칙

## 문서 우선순위

| 순위 | 위치 | 역할 |
|---|---|---|
| 1 | **Manyfast** | 개발 명세 SSOT. PRD · Requirement · Feature · Spec |
| 2 | **GitHub Issue** | 명세를 구현 단위로 배정한 작업 지시 |
| 3 | **코드 · PR · `docs/`** | 실제 구현과 기술 계약 |
| 4 | **Notion** | 회의 · 인터뷰 · 일정 · 결정 배경 |

> 논의와 운영은 Notion에서 한다.
> 개발 요구사항은 Manyfast에서 확정한다.
> 구현 작업은 GitHub Issue로 관리한다.
> 실제 변경과 검증은 코드 · PR · CI에 남는다.

**Notion 회의에서 나온 내용은 Manyfast에 반영되기 전까지 개발 요구사항이 아니다.**

## 작업 흐름

```
Notion 논의
→ 확정된 것만 Manyfast 명세화 · 버전 저장
→ GitHub Issue 생성 (Manyfast ID · 버전 기록)
→ 에이전트/개발자가 Manyfast + Issue + 코드를 읽고 계획 보고
→ 팀 승인
→ 브랜치 · 구현 · 검증 · PR
→ 사람이 리뷰하고 main 에 병합
→ 동작·정책이 바뀌었으면 Manyfast 갱신 후 새 버전 저장
```

## 브랜치

`main`에 직접 커밋하지 않는다.

```
feat/12-handover-text-input
fix/27-ai-json-validation
docs/31-api-contract
refactor/34-card-state-model
chore/8-ci-setup
```

`<타입>/<이슈번호>-<짧은-영문-이름>` 형식이다.

## 커밋

```
feat(card): render structured handover card
fix(ai): reject missing evidence fields
docs(contract): define handover card response
chore(ci): add secret scan guard
```

`<타입>(<범위>): <무엇을 왜 바꿨는지>` — 파일명 나열이 아니라 **변경 목적**이 드러나게 쓴다.

타입: `feat` `fix` `docs` `refactor` `test` `chore`

## Issue

- **Issue 하나는 원칙적으로 하나의 검토 가능한 PR로 끝낸다.**
- 모든 구현 Issue에 Manyfast Requirement · Feature/Spec ID · **기준 버전**을 적는다.
  이 정보가 없으면 AI 에이전트는 구현하지 않고 보완을 요청한다.
- 현재 Issue의 완료 조건에 없는 개선점은 **즉시 구현하지 않는다.** Backlog Issue로 분리한다.
- MVP 범위를 늘리는 변경은 Manyfast PRD/Requirement 변경과 팀 승인을 거친다.

템플릿: `기능 구현` / `버그` / `인프라·문서·백로그`

## 라벨

| 영역 | 우선순위 |
|---|---|
| `frontend` `backend` `ai` `infra` `docs` `bug` | `P0` `P1` `P2` |

- `P0` — 데모 코어 플로우. 없으면 발표가 안 됨
- `P1` — 있으면 좋음
- `P2` — 이후

## 마일스톤

| 마일스톤 | 기한 | 기준 |
|---|---|---|
| **코어 플로우** | 2026-08-13 | 입력 → AI 구조화 → 어르신 카드가 동작 |
| **기능 완성** | 2026-08-17 | 담당자 배정, 미처리/완료 추적, 붙여넣기 텍스트 포함 |
| **배포 안정화** | 2026-08-19 | 배포 링크에서 코어 플로우가 실제로 작동 |

## PR

- 본문에 `Closes #<번호>`를 넣는다. 병합 시 Issue가 자동으로 닫힌다.
- Manyfast 참조 ID와 기준 버전을 적는다.
- **lint · test · build 결과와 남은 제한 사항을 적는다.**
- **CI가 실패하면 `main` 병합과 배포를 하지 않는다.**
- `main` 병합은 사람이 한다.

## 무엇을 어디에 반영하나

| 상황 | Manyfast | GitHub | Notion |
|---|---|---|---|
| 내부 리팩터링, 파일 이동, 스타일 수정 | 수정 안 함 | PR에 기록 | 수정 안 함 |
| 화면 흐름, 상태 정의, 담당자 규칙 변경 | 승인 후 갱신 | Issue·PR 갱신 | 결정 요약 기록 |
| AI 카드 필드 · API · JSON 구조 변경 | Feature/Spec 갱신 | 코드·docs 동시 갱신 | 필요 시 기록 |
| MVP 범위 축소·확장 | PRD 갱신 + 버전 저장 | Issue 재정렬 | 기획 결정 기록 |
| 구현 중 발견한 후속 개선 | 바꾸지 않음 | Backlog Issue 생성 | 필요 시 기록 |
| 버그가 명세/구현 중 어디 문제인지 불명확 | 구현 중단, 비교·판단 | Bug Issue 또는 댓글 | 필요 시 논의 |

## 체크리스트

**기능 시작 전**

- [ ] Notion 논의가 Manyfast에 반영됐는가?
- [ ] Manyfast에 구현 범위 · 완료 조건 · 범위 제외가 있는가?
- [ ] Manyfast 버전을 저장했는가?
- [ ] Issue가 해당 Manyfast 항목과 버전을 가리키는가?
- [ ] 한 PR로 검토 가능한 크기인가?

**PR 전**

- [ ] 구현이 Manyfast 명세를 충족하는가?
- [ ] lint · test · build를 통과했는가?
- [ ] 계약이 바뀌었다면 `docs/contracts/`도 갱신했는가?
- [ ] 동작·정책이 바뀌었다면 Manyfast도 갱신했는가?
- [ ] PR에 Manyfast ID · 버전 · `Closes #번호`를 적었는가?
- [ ] 비밀값이 포함되지 않았는가?
