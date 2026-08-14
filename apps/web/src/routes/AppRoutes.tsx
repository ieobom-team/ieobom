import { Navigate, Route, Routes } from 'react-router'
import { AdminHomePage } from '../features/admin/AdminHomePage'
import { OperationsDashboardPage } from '../features/dashboard/OperationsDashboardPage'
import { UnprocessedBriefingPage } from '../features/dashboard/UnprocessedBriefingPage'
import { FieldHomePage } from '../features/field/FieldHomePage'
import { HandoverCardDetailPage } from '../features/handover-card/HandoverCardDetailPage'
import { HandoverCardListPage } from '../features/handover-card/HandoverCardListPage'
import { UnresolvedCardsPage } from '../features/handover-card/UnresolvedCardsPage'
import { HandoverCreatePage } from '../features/handover/HandoverCreatePage'
import { OfflineQueueSync } from '../features/handover/OfflineQueueSync'
import { EntrySelectPage } from '../features/session/EntrySelectPage'
import { TaskAssignPage } from '../features/task/TaskAssignPage'
import { RequireSession } from './RequireSession'

/**
 * 유저플로우 "새 플로우 3" 진입 구간.
 *
 *   n1 앱 최초 실행 → n2 역할·본인 식별 선택(`/`)
 *   → n3 선택 역할? → n4 현장 근무자 홈(`/field`) / n5 관리자 홈(`/admin`)
 *   → n6 특이사항 남기기 → n7~n16 입력(`/field/handovers/new`)
 *   → n18 인계 카드 목록(`/handover-cards`) → n21 상세 / n24 검토 필요 항목
 *
 * 운영 현황 구간은 **"AI 인계 도구 내비게이션 맵" 기준 번호**다. (#16)
 *
 *   n5 → n42 관리자 대시보드(`/admin/dashboard`)
 *   → n48 브리핑 선택 → n44 하원 미처리 브리핑(`/admin/briefing`) → n45 미처리 건수·목록
 *
 * **두 플로우의 번호가 겹친다.** 위 구간의 n18 은 "새 플로우 3"의 인계 카드 **목록**이고, 아래 구간이
 * 가리키는 n18 은 내비게이션 맵의 인계 카드 **상세**다. 번호만 보고 화면을 찾지 말고 이름을 함께 읽는다.
 *
 * 인계 카드는 `/field` 밑에 두지 않는다. 현장 근무자 홈(n4 → n18 인계 카드 목록)에서도 들어오지만
 * 관리자 하원 미처리 브리핑(n46 인계 카드로 이동 → n18 인계 카드 상세 화면)에서도 같은 상세로
 * 들어오기 때문이다. 진입 선택은 요구하되 역할로 가르지 않는다. (Manyfast F-SNBVHR permissions)
 */
export function AppRoutes() {
  return (
    <>
      {/* 화면과 무관하게 한 번만 떠서 대기 중인 인계를 연결 회복 시 다시 보낸다. (#9) */}
      <OfflineQueueSync />
      <Routes>
        <Route path="/" element={<EntrySelectPage />} />

        <Route element={<RequireSession role="FIELD_WORKER" />}>
          <Route path="/field" element={<FieldHomePage />} />
          <Route path="/field/handovers/new" element={<HandoverCreatePage />} />
        </Route>

        {/*
          운영 현황과 하원 미처리 브리핑은 관리자 홈 밑에 둔다. 인계 카드와 달리 현장 근무자 홈에서
          들어오는 경로가 없고, Manyfast 도 사회복지사·센터장이 웹에서 보는 화면으로 적고 있다.
          (F-HQTFLK permissions) 권한 검사가 아니라 진입 선택에 따른 갈래다. (#16)
        */}
        <Route element={<RequireSession role="MANAGER" />}>
          <Route path="/admin" element={<AdminHomePage />} />
          <Route path="/admin/dashboard" element={<OperationsDashboardPage />} />
          <Route path="/admin/briefing" element={<UnprocessedBriefingPage />} />
        </Route>

        <Route element={<RequireSession />}>
          <Route path="/handover-cards" element={<HandoverCardListPage />} />
          <Route path="/handover-cards/unresolved" element={<UnresolvedCardsPage />} />
          <Route path="/handover-cards/:cardId" element={<HandoverCardDetailPage />} />
          <Route path="/handover-cards/:cardId/tasks/new" element={<TaskAssignPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
