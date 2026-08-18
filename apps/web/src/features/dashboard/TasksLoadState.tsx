import { BigButton } from '../../shared/ui/BigButton'

/**
 * 업무 목록을 아직 못 받았을 때.
 *
 * 인계 쪽(`handover-card/CardsLoadState.tsx`)과 따로 두는 이유는 **영역별로 다르게 그려야 하기**
 * 때문이다. 인계는 받았는데 업무를 못 받은 상태가 실제로 있고, 그때 화면은 성공한 영역을 그대로 두고
 * 실패한 영역에만 안내를 붙인다. (Manyfast F-HQTFLK exceptions)
 */
export function TasksLoading() {
  return <p className="text-xl text-ink-muted">업무를 불러오는 중입니다…</p>
}

export function TasksLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-2xl border-2 border-primary bg-primary-soft px-5 py-4"
    >
      <p className="text-xl text-ink">업무를 불러오지 못했습니다.</p>
      <BigButton tone="plain" onClick={onRetry}>
        다시 불러오기
      </BigButton>
    </div>
  )
}
