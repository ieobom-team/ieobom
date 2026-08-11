# 이어봄 에이전트 규칙

이 저장소에서 작업하는 모든 AI 에이전트(Claude Code, Gemini/Antigravity 등)는 이 문서를 먼저 읽는다.
`CLAUDE.md`와 `GEMINI.md`는 이 파일을 참조하기만 한다.

---

## 행동 원칙
- 요구를 수행하기 전에, 관련 context(git log, tree, npm list 등)나 관련 파일을 먼저 파악한 후 진행해.
- **관련 context가 부족하거나 불확실하거나 추가 정보가 필요하면 임의판단하지 마. 작업 시작 전 무조건 사용자에게 의도나 방향성을 확인해.**
- 작업 도중 일부만 파악했거나 확실하지 않은 부분이 남아 있으면, 불확실하다고 솔직히 명시하고 그에 맞게 진행해.
- **오류가 나거나 예상대로 안 될 땐, 바로 고치려 들지 말고 디버깅 로그부터 남겨서 원인을 확인한 뒤 수정해.**
- **작업을 "완료"라고 말하기 전에, 관련 테스트/린트/타입체크가 있으면 반드시 실행해서 실제로 통과하는지 확인해.** 실행 방법을 모르면 어떻게 확인하는지 먼저 물어봐.
- 복잡한 작업은 subtask로 쪼개서 계획한 후 진행하고, 완료 후 빠뜨린 게 없는지 점검해.
- 내가 요청한 것만 하고 끝내. 네 멋대로 다른 작업 계속 하려고 하지 말고.
- 한국어로 답변해.

## 참고사항
- `.env` 파일은 존재해도 인지하거나 접근 못 할 수 있음을 유의하고, 이 부분 관련 tasks는 사용자가 하도록 안내해.

---

## 개발 명세 우선순위

| 순위 | 위치 | 역할 |
|---|---|---|
| 1 | **Manyfast** | 개발 명세의 유일한 진실 공급원(SSOT). PRD · Requirement · Feature · Spec |
| 2 | **GitHub Issue** | Manyfast 명세를 하나의 검토 가능한 구현 단위로 배정한 작업 지시 |
| 3 | **코드 · PR · `docs/`** | 실제 구현과 기술 계약(API · JSON · DB) |
| 4 | **Notion** | 회의·인터뷰·일정·결정 배경. **개발 요구사항으로 직접 사용하지 않는다** |

- Notion 회의에서 나온 내용은 **Manyfast에 반영·버전 저장되기 전까지 개발 요구사항이 아니다.**
- Manyfast와 Issue가 충돌하거나 스펙이 부족하면, 구현하지 말고 변경안을 먼저 제안한다.
- Issue에 Manyfast 참조 · 기준 버전 · 완료 조건 · 범위 제외가 없으면 **구현하지 않는다.**
  누락 항목과 보완 방법을 보고하고 팀의 결정을 기다린다.

### Manyfast 취급

- Manyfast MCP로 쓸 수 있는 것은 **PRD · Requirement · Feature · Spec뿐이다.**
- **유저플로우와 와이어프레임은 읽기 전용이다.** 수정은 사람이 Manyfast 웹에서 한다.
  에이전트는 불일치를 발견하면 노드·페이지 ID와 고칠 방향을 보고만 하고, 직접 고치려 하지 않는다.
- 읽을 때는 **메타 → 필요한 항목** 순으로 좁힌다. 프로젝트 전문을 통째로 읽지 않는다.
- 다만 **메타의 집계값(항목 수, 최신 버전, 와이어프레임 유무)은 갱신이 늦어 틀릴 수 있다.**
  개수나 버전을 근거로 판단할 때는 메타를 믿지 말고 해당 항목을 실제로 읽어 확인한다.
- 유저플로우는 부분 로딩이 안 되어 한 번에 전체가 온다. 화면 전이를 설계할 때만 읽는다.
- 항목 ID는 Manyfast에 표시된 값을 그대로 쓴다. (`R-LIEATL` 형식) 임의로 번호를 붙이지 않는다.

## 작업 규칙

1. GitHub Issue를 읽는다.
2. Issue가 가리키는 Manyfast Requirement · Feature · Spec과 **기준 버전**을 읽는다.
3. 관련 코드와 `docs/` 계약을 읽는다.
4. **요구사항 요약 · 변경 파일 · 구현 순서 · 테스트 계획 · 위험/미결정**을 한 번에 보고한다.
5. **승인 전에는 코드 · GitHub · Manyfast를 수정하지 않는다.**
6. 승인 후 `feat/<issue-번호>-<짧은-이름>` 브랜치를 만들고 승인된 범위 안에서만 구현한다.
7. 포맷 · 린트 · 테스트 · 빌드를 실행한다. 실패하면 원인을 분석하고 최대 2회 수정·재검증한다.
8. 사용자 동작 · 상태 규칙 · API/JSON 계약이 바뀌면 **Manyfast 갱신이 필요한지 먼저 판단**하고 변경안을 제시한다.
9. 범위 밖 개선점은 구현하지 말고 Backlog Issue 초안으로 분리한다.
10. 검증 통과 후에만 커밋 · push · PR 초안을 만든다.

긴 작업(세션 중단, 에이전트 교체, 하루 이상)에서만 `.agent/current-task.md`를 만든다.
30~60분 안에 끝나는 Issue에는 만들지 않는다.

## 승인 경계

| 등급 | 작업 | 처리 |
|---|---|---|
| **A** | 코드 탐색, Manyfast·Issue 읽기, 계획 작성, 포맷·린트·테스트 실행 | 즉시 수행 |
| **B** | 브랜치 생성, 구현, `docs/` 갱신, 커밋, push, PR 초안 | **계획 승인 후** 수행 |
| **C** | Manyfast Feature/Spec 갱신, Issue 완료 조건 변경, MVP 범위 변경 | **변경안 승인 후** 수행 |
| **D** | `main` 병합, 배포, Secrets 변경, 결제·외부 권한 변경 | **사람만** 수행 |

## 검증 명령

PR을 만들기 전에 반드시 실행한다.

```bash
# 한 번에
./scripts/verify-before-pr.sh        # macOS / Linux
pwsh ./scripts/verify-before-pr.ps1  # Windows

# 백엔드만
cd apps/api && ./gradlew build
```

`apps/web`은 아직 생성 전이라 검증 명령이 없다.
Vite 프로젝트를 만드는 PR에서 `lint` · `build` 명령을 이 문단과 `scripts/`, `.github/workflows/ci.yml`에 함께 추가한다.

## 금지

- API 키 · 토큰 · `.env` · 인증 파일을 커밋하지 않는다. **Public 저장소다.**
- `main` 병합, 배포, 비밀값 변경을 수행하지 않는다.
- Notion 회의록·아이디어만 근거로 구현하지 않는다.
- Manyfast에 없는 사용자 동작·정책을 추측해 추가하지 않는다.
- 검증(린트·테스트·빌드)이 실패한 상태에서 PR을 만들지 않는다.
- 승인 없이 Manyfast의 확정 명세, MVP 범위, 기존 Issue 완료 조건을 바꾸지 않는다.

## MVP 범위

**Out of Scope**

로그인·계정·권한 모델 / 기존 ERP 연동·대체 / 보호자 앱·자동 발송 / 다시설 법인 대시보드 /
방문요양 / 자동 의료 판단 / 상시 녹음 / 센서·IoT 연동 /
**지연 재알림** / **다음 교대 자동 승계**

> **보호자 전달 "문구 생성"은 범위 안이다.** 범위 밖인 것은 자동 발송과 보호자용 계정·앱이다.
> 출력은 전산 기록 문구와 보호자 전달 문구 두 가지이고, 둘 다 직원이 검토한 뒤 직접 복사한다.

## 스킬

반복 작업의 순서와 승인 경계는 `.claude/skills/` 에 고정돼 있다.
Claude Code가 아닌 에이전트도 이 파일들을 절차서로 읽고 같은 순서를 따른다.

| 스킬 | 언제 |
|---|---|
| [`plan-feature`](.claude/skills/plan-feature/SKILL.md) | Manyfast 항목을 GitHub Issue 초안으로 분해할 때 |
| [`implement-issue`](.claude/skills/implement-issue/SKILL.md) | Issue 하나를 분석·구현할 때 (`#12 구현 준비해`) |
| [`propose-change`](.claude/skills/propose-change/SKILL.md) | 구현 중 명세와 현실이 충돌할 때 |
| [`sync-manyfast`](.claude/skills/sync-manyfast/SKILL.md) | Notion 논의나 구현 결과를 Manyfast에 반영할 때 |

## 관련 문서

- [docs/development.md](docs/development.md) — 로컬 실행, 앱 생성 명령, 환경변수
- [docs/architecture.md](docs/architecture.md) — 디렉터리 구조, 패키지·엔티티 설계
- [docs/conventions.md](docs/conventions.md) — 브랜치 · 커밋 · PR · 라벨 규칙
- [docs/contracts/](docs/contracts) — API · JSON · DB 계약
