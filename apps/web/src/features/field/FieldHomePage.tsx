import { useNavigate } from 'react-router'
import { BigButton } from '../../shared/ui/BigButton'
import { useOfflineQueue } from '../handover/useOfflineQueue'
import { SessionHeader } from '../session/SessionHeader'

/**
 * 유저플로우 "새 플로우 3" n4 — 현장 근무자 홈.
 *
 * n6 특이사항 남기기(#6), n18 인계 카드 목록(#11), n61 → n31 업무 목록(#15)이 붙어 있다.
 */
export function FieldHomePage() {
  const navigate = useNavigate()
  const offlineQueue = useOfflineQueue()
  const queuedCount = offlineQueue.data?.length ?? 0

  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">현장 홈</h1>

        {/* n17 — 재전송 대기 중임을 다른 화면에서도 잊히지 않게 보여 준다. (Manyfast F-YJJJUX exceptions) */}
        {queuedCount > 0 && (
          <p className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
            연결을 기다리는 인계 {queuedCount}건이 있습니다. 연결되면 자동으로 보냅니다.
          </p>
        )}

        <BigButton onClick={() => navigate('/field/handovers/new')}>
          <span className="block">특이사항 남기기</span>
          <span className="mt-1 block text-lg font-normal opacity-90">
            돌봄 중 있었던 일을 한 번만 남기면 됩니다
          </span>
        </BigButton>

        <BigButton tone="plain" onClick={() => navigate('/handover-cards')}>
          <span className="block">인계 카드 보기</span>
          <span className="mt-1 block text-lg font-normal text-slate-500">
            오늘 정리된 어르신별 인계 내용을 봅니다
          </span>
        </BigButton>

        <BigButton tone="plain" onClick={() => navigate('/tasks')}>
          <span className="block">내 할 일 확인</span>
          <span className="mt-1 block text-lg font-normal text-slate-500">
            오늘 배정된 업무의 미처리·완료를 확인합니다
          </span>
        </BigButton>
      </main>
    </div>
  )
}
