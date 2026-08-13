import { SessionHeader } from '../session/SessionHeader'

/**
 * 유저플로우 "새 플로우 3" n5 — 관리자 홈. 이 Issue(#4)에서는 진입 결과를 확인하는 자리까지만 만든다.
 * 당일 운영 현황과 하원 미처리 브리핑(#16)이 여기에 붙는다.
 */
export function AdminHomePage() {
  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">관리자 홈</h1>
        <p className="mt-4 text-xl text-slate-600">
          당일 운영 현황과 하원 미처리 브리핑이 이 화면에 들어옵니다.
        </p>
      </main>
    </div>
  )
}
