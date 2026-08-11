import type { ReactNode } from 'react'

type BigButtonProps = {
  children: ReactNode
  onClick: () => void
  /** 화면에서 다음으로 눌러야 할 버튼인지 */
  tone?: 'primary' | 'plain'
  selected?: boolean
}

/**
 * 큰 글씨·큰 버튼. 장갑 낀 손이나 노안에서도 한 번에 눌리도록 세로 높이를 크게 잡는다.
 */
export function BigButton({ children, onClick, tone = 'primary', selected = false }: BigButtonProps) {
  const base =
    'w-full min-h-20 rounded-2xl px-6 py-5 text-left text-2xl font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300'
  const toneClass =
    tone === 'primary'
      ? 'bg-teal-700 text-white hover:bg-teal-800 active:bg-teal-900'
      : 'border-2 border-slate-300 bg-white text-slate-900 hover:border-teal-600 hover:bg-teal-50'
  const selectedClass = selected ? 'border-teal-700 bg-teal-50' : ''

  return (
    <button type="button" onClick={onClick} className={`${base} ${toneClass} ${selectedClass}`}>
      {children}
    </button>
  )
}
