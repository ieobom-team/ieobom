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

**RFC(Discussion) Issue**: 확정된 부분만 Manyfast Feature 슬롯에 반영하고 버전 저장한다. 미결정·가설은 Issue에 남기고 Manyfast에 넣지 않는다. MVP 범위를 넓히는 요소는 별도 팀 승인을 거친다.

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
- **RFC·제안 Issue**: 논의 중 확정된 단위만 Manyfast 갱신 후 새 구현 Issue(`[feat]`)로 분리해 구현하고, 미확정 안건은 기존 RFC 이슈에 남겨둔다.
- MVP 범위를 늘리는 변경은 Manyfast PRD/Requirement 변경과 팀 승인을 거친다.
- **디자인 리스킨 Issue 예외**: 화면의 색·타이포·컴포넌트 외형만 바꾸고 사용자 동작·데이터·API를
  건드리지 않는 Issue는 Manyfast Feature/Spec ID 대신 **`docs/DESIGN.md` 섹션 참조**로 갈음한다.
  다만 표시 항목이 늘거나 조작 방식이 바뀌면 리스킨이 아니므로 **Feature ID와 기준 버전을 적는다.**
  판단 기준은 `docs/DESIGN.md` §12.2 — "이 변경이 컴포넌트의 생김새만 바꾸는가?"

템플릿: `기능 구현` / `버그` / `인프라·문서·백로그`

## 라벨

| 영역 | 우선순위 | 착수 순서 |
|---|---|---|
| `frontend` `backend` `ai` `infra` `docs` `bug` | `P0` `P1` `P2` | `seq-0` ~ `seq-5` |

- `P0` — 데모 코어 플로우. 없으면 발표가 안 됨
- `P1` — 있으면 좋음
- `P2` — 이후

**`seq-N` — 착수 순서**

우선순위(`P`)가 *얼마나 중요한가*라면, `seq`는 *무엇을 먼저 하면 좋은가*다. 둘은 독립이다.

| 라벨 | 설명 |
|---|---|
| `seq-0` | 추천 0순위 — 선행 필수, 나머지 전부가 이 산출물 위에서 동작 (병행 대상 아님) |
| `seq-1` | 추천 1순위 — 지금 가장 먼저 착수 권장 (동일 seq 내 병행 가능) |
| `seq-2` | 추천 2순위 — 1순위 후속 연계 작업 (동일 seq 내 병행 가능) |
| `seq-3` | 추천 3순위 — 2순위 이후 진행 작업 (동일 seq 내 병행 가능) |
| `seq-4` | 추천 4순위 — 선행 작업 완료 후 착수 (동일 seq 내 병행 가능) |
| `seq-5` | 추천 5순위 — 최후순위 진행 / 논의·백로그 보류 대상 |

**"동일 seq 내 병행 가능"이 성립하려면** 같은 `seq`의 Issue끼리 아래 둘이 모두 없어야 한다.

1. **같은 파일을 고치지 않는다.** 여러 화면이 공유하는 컴포넌트는 **가장 이른 `seq`의 Issue가 소유**하고,
   나머지 Issue는 그 결과물을 쓰기만 한다. 소유 Issue 번호를 양쪽 본문에 적는다.
2. **한쪽의 완료 조건이 다른 쪽의 산출물을 요구하지 않는다.**
   요구하면 `seq`를 벌리거나 두 Issue를 합친다.

## 마일스톤

| 마일스톤 | 기한 | 기준 |
|---|---|---|
| **코어 플로우** | 2026-08-13 | 입력 → AI 구조화 → 어르신 카드가 동작 |
| **기능 완성** | 2026-08-17 | 담당자 배정, 미처리/완료 추적, 붙여넣기 텍스트 포함 |
| **배포 안정화** | 2026-08-19 | 배포 링크에서 코어 플로우가 실제로 작동 |
| **디자인 적용 — 코어 화면** | 2026-08-19 | 디자인 토큰·공용 컴포넌트와 P0 화면이 `docs/DESIGN.md` 톤으로 동작 |
| **디자인 적용 — 나머지 화면** | 2026-08-20 | 관리자·명단·모달 등 잔여 화면까지 톤 일치. 제출(08-21 09:59) 전 하루 여유 |

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
| RFC 이슈에서 확정된 UX·정책 변경 | 확정분만 Feature 슬롯 갱신 | 이슈에 반영 내역 댓글 | 필요 시 기록 |
| 버그가 명세/구현 중 어디 문제인지 불명확 | 구현 중단, 비교·판단 | Bug Issue 또는 댓글 | 필요 시 논의 |

## 표기 규칙

- **유저플로우 노드**: 코드 주석이나 문서에서 유저플로우 노드를 언급할 때는 반드시 어느 지도를 기준으로 하는지 이름을 함께 적는다. (예: `유저플로우 "새 플로우 3" n21`) 지도 이름 없이 번호만 적지 않는다.

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
