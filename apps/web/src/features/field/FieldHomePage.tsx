import { SessionHeader } from '../session/SessionHeader'

/**
 * 유저플로우 n4 — 현장 근무자 홈. 이 Issue(#4)에서는 진입 결과를 확인하는 자리까지만 만든다.
 * 특이사항 남기기(#6), 인계 카드 목록(#11), 내 할 일(#15)이 여기에 붙는다.
 */
export function FieldHomePage() {
  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">현장 홈</h1>
        <p className="mt-4 text-xl text-slate-600">
          특이사항 남기기와 내 할 일 확인이 이 화면에 들어옵니다.
        </p>
      </main>
    </div>
  )
}
