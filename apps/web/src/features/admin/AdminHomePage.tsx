import { Link } from 'react-router'
import { SessionHeader } from '../session/SessionHeader'

/**
 * 유저플로우 n5 — 관리자 홈. 여기서 n44 운영 현황으로 들어간다.
 *
 * 홈이 현황을 직접 그리지 않고 한 겹 두는 이유는 유저플로우가 그렇게 갈라져 있기 때문이다. 관리자 홈은
 * 진입 결과를 확인하는 자리이고, 당일 현황과 하원 미처리 브리핑은 각자 화면을 갖는다.
 */
export function AdminHomePage() {
  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">관리자 홈</h1>
        <p className="mt-4 text-xl text-slate-600">
          오늘 등록된 인계와 아직 닫히지 않은 업무를 한 화면에서 확인합니다.
        </p>
        <Link
          to="/admin/dashboard"
          className="mt-6 inline-block rounded-2xl bg-teal-700 px-6 py-4 text-xl font-semibold text-white"
        >
          당일 운영 현황 보기
        </Link>
      </main>
    </div>
  )
}
