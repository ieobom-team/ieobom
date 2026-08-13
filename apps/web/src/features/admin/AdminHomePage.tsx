import { Link } from 'react-router'
import { SessionHeader } from '../session/SessionHeader'

/**
 * 유저플로우 "새 플로우 3" n5 · "AI 인계 도구 내비게이션 맵" n42 — 관리자 홈.
 *
 * 이 Issue(#4)에서는 진입 결과를 확인하는 자리까지만 만들었고,
 * n58 어르신 명단 이동(#42)이 붙었다. 당일 운영 현황과 하원 미처리 브리핑(#16)이 여기에 들어온다.
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

        {/* n58 — 어르신 명단 화면(n49)으로 이동한다. */}
        <Link
          to="/admin/care-recipients"
          className="mt-8 flex min-h-20 w-full items-center rounded-2xl border-2 border-slate-300 bg-white px-6 py-5 text-2xl font-semibold text-slate-900 hover:border-teal-600 hover:bg-teal-50"
        >
          어르신 명단
        </Link>
      </main>
    </div>
  )
}
