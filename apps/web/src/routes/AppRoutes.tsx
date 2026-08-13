import { Navigate, Route, Routes } from 'react-router'
import { AdminHomePage } from '../features/admin/AdminHomePage'
import { ExportPage } from '../features/export/ExportPage'
import { FieldHomePage } from '../features/field/FieldHomePage'
import { HandoverCardDetailPage } from '../features/handover-card/HandoverCardDetailPage'
import { HandoverCardEditPage } from '../features/handover-card/HandoverCardEditPage'
import { HandoverCardListPage } from '../features/handover-card/HandoverCardListPage'
import { UnresolvedCardsPage } from '../features/handover-card/UnresolvedCardsPage'
import { HandoverCreatePage } from '../features/handover/HandoverCreatePage'
import { OfflineQueueSync } from '../features/handover/OfflineQueueSync'
import { EntrySelectPage } from '../features/session/EntrySelectPage'
import { TaskAssignPage } from '../features/task/TaskAssignPage'
import { TaskDetailPage } from '../features/task/TaskDetailPage'
import { TaskListPage } from '../features/task/TaskListPage'
import { RequireSession } from './RequireSession'

/**
 * 유저플로우 "새 플로우 3" 진입 구간.
 *
 *   n1 앱 최초 실행 → n2 역할·본인 식별 선택(`/`)
 *   → n3 선택 역할? → n4 현장 근무자 홈(`/field`) / n5 관리자 홈(`/admin`)
 *   → n6 특이사항 남기기 → n7~n16 입력(`/field/handovers/new`)
 *   → n18 인계 카드 목록(`/handover-cards`) → n21 상세 / n24 검토 필요 항목
 *   → n25 카드 내용 수정·검토(`/handover-cards/:cardId/edit`) → n21 로 복귀
 *
 * 인계 카드는 `/field` 밑에 두지 않는다. 현장 근무자 홈(n4 → n18)에서도 들어오지만
 * 관리자 하원 미처리 브리핑(n49 → n21)에서도 같은 상세로 들어오기 때문이다.
 * 진입 선택은 요구하되 역할로 가르지 않는다. (Manyfast F-SNBVHR permissions)
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

        <Route element={<RequireSession role="MANAGER" />}>
          <Route path="/admin" element={<AdminHomePage />} />
        </Route>

        <Route element={<RequireSession />}>
          <Route path="/handover-cards" element={<HandoverCardListPage />} />
          <Route path="/handover-cards/unresolved" element={<UnresolvedCardsPage />} />
          <Route path="/handover-cards/:cardId" element={<HandoverCardDetailPage />} />
          <Route path="/handover-cards/:cardId/edit" element={<HandoverCardEditPage />} />
          <Route path="/handover-cards/:cardId/tasks/new" element={<TaskAssignPage />} />
          <Route path="/handover-cards/:cardId/export" element={<ExportPage />} />
          <Route path="/tasks" element={<TaskListPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
