import { useNavigate } from 'react-router'
import { BigButton } from '../../shared/ui/BigButton'
import { SessionHeader } from '../session/SessionHeader'

/**
 * 유저플로우 n4 — 현장 근무자 홈.
 *
 * n6 특이사항 남기기(#6)와 n18 인계 카드 목록(#11)이 붙어 있다. 내 할 일(#15)이 여기에 더 붙는다.
 */
export function FieldHomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">현장 홈</h1>

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

        <p className="text-xl text-slate-600">내 할 일 확인이 이 화면에 들어옵니다.</p>
      </main>
    </div>
  )
}
