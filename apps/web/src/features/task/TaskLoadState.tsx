import { BigButton } from '../../shared/ui/BigButton'

/** 업무를 아직 못 받았을 때의 화면. 자동 재시도는 꺼 두었다(`shared/api/queryClient.ts`). */
export function TasksLoading() {
  return <p className="text-xl text-slate-600">업무를 불러오는 중입니다…</p>
}

export function TasksLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4"
    >
      <p className="text-xl text-amber-900">업무를 불러오지 못했습니다.</p>
      <BigButton tone="plain" onClick={onRetry}>
        다시 불러오기
      </BigButton>
    </div>
  )
}
