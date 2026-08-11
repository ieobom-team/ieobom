# apps/web

React + TypeScript + Vite 프론트엔드가 들어올 자리다. **아직 생성 전이다.**

기획이 확정되기 전에 의존성을 고정하지 않기 위해 의도적으로 비워 두었다.
프론트엔드 첫 Issue를 시작하는 사람이 이 디렉터리에서 아래를 실행한다.

```bash
cd apps/web

# 1) Vite + React + TypeScript
npm create vite@latest . -- --template react-ts
npm install

# 2) Tailwind CSS (고령 친화 UI: 큰 버튼·큰 글씨)
npm install -D tailwindcss @tailwindcss/postcss postcss

# 3) 서버 상태 (카드 목록, 미처리 업무, 완료 상태 갱신)
npm install @tanstack/react-query
```

생성한 뒤 같은 PR에서 함께 처리할 것:

- [ ] `package.json`에 `lint` · `build` 스크립트 확인
- [ ] `.github/workflows/web.yml` 추가 (`.github/workflows/ci.yml` 상단 주석 참고)
- [ ] `scripts/verify-before-pr.*`의 web 블록이 SKIP 대신 실제로 돌게 되는지 확인
- [ ] `AGENTS.md`의 "검증 명령" 문단에 web 명령 추가
- [ ] API 주소는 `VITE_API_BASE_URL` 환경변수로 (`.env.example` 참고)

> `VITE_` 접두사가 붙은 값은 브라우저 번들에 그대로 들어간다. 여기에 비밀키를 두지 않는다.

## 미리 알아 둘 제약

현장 입력 화면은 **오프라인에서 유실되면 안 된다.** 구조를 잡을 때 미리 고려한다.

- 저장 실패 시 입력을 기기에 임시 저장하고, 연결이 회복되면 자동 재전송한다.
- 재전송 대기 중임을 화면에 표시한다.
- 돌봄 중인 근무자에게 재입력을 요구하지 않는다. 실패 토스트로 끝내는 설계는 안 된다.

진입 역할은 **현장 근무자 / 관리자·센터장 2종**이고, 업무 배정에 쓰는 **담당 직종 5종**은
이와 별개 개념이다. 라우팅은 진입 역할로, 업무 배정은 담당 직종으로 간다. 자세한 내용은
[`docs/architecture.md`](../../docs/architecture.md)를 본다.
