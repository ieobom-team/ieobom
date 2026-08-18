import type { NotificationResponse, NotificationType } from './notificationApi'

/** 알림 유형 레이블 매핑. (F-JIEOJO display) */
const TYPE_LABEL: Record<NotificationType, string> = {
  TASK_ASSIGNED: '새 업무 배정',
  TASK_REASSIGNED: '담당 변경',
  TASK_DELEGATED_COMPLETE: '대리 완료',
}

/** 알림 유형별 배경색 클래스 */
const TYPE_BG: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'bg-primary-soft text-primary',
  TASK_REASSIGNED: 'bg-amber-50 text-amber-800',
  TASK_DELEGATED_COMPLETE: 'bg-btn-neutral text-ink',
}

/**
 * HH:MM 형식 시각 문자열을 "HH시 MM분" 으로 변환한다.
 * 서버가 ISO 날짜 문자열을 보내는 경우 Date 로 파싱 후 로컬 시간 포맷.
 */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  } catch {
    return iso
  }
}

/**
 * 단일 알림 항목.
 *
 * 알림 항목에는 어르신 이름·업무 내용·배정한 사람·기한 시각·받은 시각을 표시한다.
 * (F-JIEOJO display)
 *
 * - 읽음/안읽음 구분을 배경색으로 표시한다.
 * - 직종 배정 알림에서 `task.claimable === true` 이면 '내가 처리할게요' 를 표시하고,
 *   다른 사람이 이미 맡았으면 담당자·맡은 시각을 표시한다. (F-JIEOJO display)
 * - 안전 관련 알림(`safetyRelated`)은 테두리를 붉게 강조한다. (F-JIEOJO display)
 * - **항목을 눌렀을 때만** 읽음 처리 + 업무 상세 이동이 발생한다. (F-JIEOJO display)
 */
export function NotificationItem({
  notification,
  onPress,
  onClaim,
  claimPending,
}: {
  notification: NotificationResponse
  /** 항목을 눌렀을 때 호출. 읽음 처리 + 업무 상세 이동. */
  onPress: (notification: NotificationResponse) => void
  /** '내가 처리할게요' 를 눌렀을 때 호출. */
  onClaim: (notification: NotificationResponse) => void
  claimPending: boolean
}) {
  const { task } = notification
  const isUnread = !notification.read

  const borderClass = notification.safetyRelated || isUnread ? 'border-primary' : 'border-border-card'

  const bgClass = isUnread ? 'bg-white' : 'bg-canvas'

  return (
    <article
      className={`rounded-2xl border-2 ${borderClass} ${bgClass} p-5 transition-colors`}
    >
      {/* 알림 유형 배지 + 읽음 상태 */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${TYPE_BG[notification.type]}`}
        >
          {TYPE_LABEL[notification.type]}
        </span>
        {isUnread && (
          <span className="h-2 w-2 rounded-full bg-primary" aria-label="미읽음" />
        )}
        {notification.safetyRelated && (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
            안전
          </span>
        )}
      </div>

      {/* 메인 클릭 영역 — 읽음 처리 + 업무 상세 이동 */}
      <button
        type="button"
        onClick={() => onPress(notification)}
        className="w-full text-left"
        aria-label={`${task.careRecipientName} — ${task.content}`}
      >
        {/* 어르신 이름 */}
        <p className="text-xl font-bold text-ink">{task.careRecipientName}</p>

        {/* 업무 내용 */}
        <p className="mt-1 text-lg text-ink">{task.content}</p>

        {/* 배정한 사람 · 기한 시각 · 받은 시각 */}
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-base text-ink-muted">
          <dt className="font-semibold">배정</dt>
          <dd>{notification.actorName}</dd>

          <dt className="font-semibold">기한</dt>
          <dd>{task.dueTime}</dd>

          <dt className="font-semibold">받은 시각</dt>
          <dd>{formatTime(notification.createdAt)}</dd>

          {notification.readAt && (
            <>
              <dt className="font-semibold">읽은 시각</dt>
              <dd>{formatTime(notification.readAt)}</dd>
            </>
          )}
        </dl>
      </button>

      {/*
        직종 배정 알림 — '내가 처리할게요' 또는 담당자·맡은 시각.
        (F-JIEOJO display)
        - task.claimable === true  → 버튼 표시
        - claimedAt 이 있으면 담당자 + 맡은 시각 표시
      */}
      {notification.type === 'TASK_ASSIGNED' && (
        <div className="mt-4 border-t border-border-divider pt-3">
          {task.claimable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClaim(notification)
              }}
              disabled={claimPending}
              className="w-full rounded-xl border-2 border-primary bg-primary-soft px-4 py-3 text-lg font-bold text-primary disabled:opacity-50"
            >
              {claimPending ? '처리 중…' : '내가 처리할게요'}
            </button>
          ) : task.assigneeName !== null ? (
            <p className="text-base text-ink-muted">
              <span className="font-semibold">{task.assigneeName}</span>
              {task.claimedAt && ` · ${formatTime(task.claimedAt)} 맡음`}
            </p>
          ) : null}
        </div>
      )}
    </article>
  )
}
