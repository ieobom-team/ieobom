import type { ReactNode } from 'react'
import { AppHeader, type AppHeaderProps } from './AppHeader'
import { BottomNav } from './BottomNav'

export type PageLayoutProps = AppHeaderProps & {
  children: ReactNode
  /** 하단 네비게이션 바 표시 여부 (기본값: false, 주요 목록/홈 화면에서 켬) */
  showBottomNav?: boolean
  /** 본문 최대 너비 (기본값: '2xl') */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full'
  className?: string
  mainClassName?: string
}

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full',
}

/**
 * 전 화면 공통 반응형 레이아웃 래퍼.
 *
 * - 상단: 일관된 `AppHeader` (뒤로가기/홈 링크 + 화면 제목 + 본인 식별 정보)
 * - 중앙: 반응형 컨테이너 및 본문 영역
 * - 하단: 선택적 `BottomNav` (모바일 하단 빠른 이동)
 */
export function PageLayout({
  children,
  showBottomNav = false,
  maxWidth = '2xl',
  title,
  backTo,
  backLabel,
  showBack,
  onBack,
  showSession = true,
  className = '',
  mainClassName = '',
}: PageLayoutProps) {
  const widthClass = MAX_WIDTH_CLASSES[maxWidth]

  return (
    <div className={`min-h-svh bg-slate-50 text-slate-900 ${className}`}>
      <AppHeader
        title={title}
        backTo={backTo}
        backLabel={backLabel}
        showBack={showBack}
        onBack={onBack}
        showSession={showSession}
      />

      <main
        className={`mx-auto flex w-full ${widthClass} flex-col gap-6 px-4 pt-6 sm:px-6 sm:pt-8 ${
          showBottomNav ? 'pb-40' : 'pb-20 sm:pb-24'
        } ${mainClassName}`}
      >
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  )
}
