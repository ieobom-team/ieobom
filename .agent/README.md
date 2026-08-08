# .agent

긴 작업의 **세션 앵커**를 두는 곳이다. 원본 명세가 아니다.

- 원본 명세는 **Manyfast**에 있다.
- 작업 지시는 **GitHub Issue**에 있다.
- 여기에는 현재 세션에 필요한 내용만 10~30줄로 압축한다.

## 규칙

- `current-task.md`는 **개인·세션 파일이라 Git에 추적하지 않는다.** (`.gitignore`)
- 한 Issue가 30~60분 안에 끝나면 만들지 않는다.
- 세션 중단, 에이전트 교체, 하루 이상 지속되는 작업일 때만 만들고 갱신한다.
- 다음 Issue를 시작하기 전에 기존 내용을 교체하거나 새 세션을 연다.

## 사용법

```bash
cp .agent/current-task.template.md .agent/current-task.md
```
