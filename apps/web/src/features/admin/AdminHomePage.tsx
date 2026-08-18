import { Link } from 'react-router'
import { PageLayout } from '../../shared/ui/PageLayout'
import { AdminStaffPinResetSection } from './AdminStaffPinResetSection'

/**
 * 유저플로우 "새 플로우 3" n5 · "AI 인계 도구 내비게이션 맵" n42 — 관리자 홈.
 *
 * 관리자 홈에서 당일 운영 현황 대시보드(/admin/dashboard)와 어르신 명단 관리(/admin/care-recipients)로 이동한다.
 * PIN을 분실한 직원을 위해 원클릭 PIN 초기화 섹션을 함께 제공한다. (#83, #84)
 */
export function AdminHomePage() {
  return (
    <PageLayout title="관리자 홈" showBottomNav maxWidth="4xl">
      <p className="text-xl text-ink-muted">
        오늘 등록된 인계와 아직 닫히지 않은 업무를 한 화면에서 확인합니다.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <Link
          to="/admin/dashboard"
          className="flex min-h-20 w-full items-center rounded-2xl bg-primary px-6 py-5 text-2xl font-semibold text-white hover:brightness-95"
        >
          당일 운영 현황 보기
        </Link>

        {/* n58 — 어르신 명단 화면(n49)으로 이동한다. */}
        <Link
          to="/admin/care-recipients"
          className="flex min-h-20 w-full items-center rounded-2xl border-2 border-border-card bg-white px-6 py-5 text-2xl font-semibold text-ink hover:border-primary hover:bg-primary-soft"
        >
          어르신 명단
        </Link>
      </div>

      {/* 관리자 1-Click PIN 초기화 섹션 (#84) */}
      <AdminStaffPinResetSection />
    </PageLayout>
  )
}
