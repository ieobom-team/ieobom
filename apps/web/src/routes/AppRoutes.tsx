import { Navigate, Route, Routes } from 'react-router'
import { AdminHomePage } from '../features/admin/AdminHomePage'
import { FieldHomePage } from '../features/field/FieldHomePage'
import { HandoverCreatePage } from '../features/handover/HandoverCreatePage'
import { EntrySelectPage } from '../features/session/EntrySelectPage'
import { RequireSession } from './RequireSession'

/**
 * 유저플로우 "새 플로우 3" 진입 구간.
 *
 *   n1 앱 최초 실행 → n2 역할·본인 식별 선택(`/`)
 *   → n3 선택 역할? → n4 현장 근무자 홈(`/field`) / n5 관리자 홈(`/admin`)
 *   → n6 특이사항 남기기 → n7~n16 입력(`/field/handovers/new`)
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EntrySelectPage />} />

      <Route element={<RequireSession role="FIELD_WORKER" />}>
        <Route path="/field" element={<FieldHomePage />} />
        <Route path="/field/handovers/new" element={<HandoverCreatePage />} />
      </Route>

      <Route element={<RequireSession role="MANAGER" />}>
        <Route path="/admin" element={<AdminHomePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
