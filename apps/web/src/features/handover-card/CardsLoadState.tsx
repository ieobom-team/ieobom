import { BigButton } from '../../shared/ui/BigButton'

/**
 * 카드를 아직 못 받았을 때의 화면.
 *
 * 자동 재시도는 꺼 두었다(`shared/api/queryClient.ts`). 실패는 바로 보여 주고 다시 받을지는
 * 사람이 버튼으로 고른다.
 */
export function CardsLoading() {
  return <p className="text-xl text-slate-600">인계 카드를 불러오는 중입니다…</p>
}

export function CardsLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4"
    >
      <p className="text-xl text-amber-900">인계 카드를 불러오지 못했습니다.</p>
      <BigButton tone="plain" onClick={onRetry}>
        다시 불러오기
      </BigButton>
    </div>
  )
}
