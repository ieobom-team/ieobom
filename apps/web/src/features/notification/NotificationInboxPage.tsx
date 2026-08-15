import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { PageLayout } from '../../shared/ui/PageLayout'
import { claimTask } from '../task/taskApi'
import { useTaskCacheUpdate } from '../task/useTasks'
import { useSession } from '../session/sessionContext'
import type { NotificationResponse } from './notificationApi'
import { NotificationItem } from './NotificationItem'
import { useMarkNotificationRead, useNotifications } from './useNotifications'

/**
 * 알림함 화면 — 유저플로우 "새 플로우 5" 알림함 화면(n43) · 배정 알림 목록(n44) · 알림 항목 선택(n45).
 *
 * 동작 기준은 Manyfast F-JIEOJO 슬롯이다. 유저플로우는 참고 자료다.
 *
 * - 오늘 알림을 먼저 보여 주고 지난 알림은 접었다가 펼쳐 조회한다. (F-JIEOJO display)
 * - 정렬(안전 우선 → 최신순)과 오늘/지난 분리는 서버가 처리한다. 클라이언트에서 재정렬하지 않는다.
 * - 항목을 눌렀을 때만 읽음 처리되고 업무 상세로 이동한다. (F-JIEOJO display)
 * - 알림이 하나도 없을 때 빈 상태 문구를 표시한다. (완료 조건)
 */
export function NotificationInboxPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const staffCode = session?.staff.code ?? ''

  const notifications = useNotifications(staffCode || undefined)
  const markRead = useMarkNotificationRead(staffCode)
  const updateTaskCache = useTaskCacheUpdate()

  const [pastOpen, setPastOpen] = useState(false)
  const [claimingId, setClaimingId] = useState<number | null>(null)

  const claim = useMutation({
    mutationFn: ({ taskId }: { taskId: number }) =>
      claimTask(taskId, { staffCode }),
    onSuccess: (result) => {
      updateTaskCache(result.task)
    },
    onSettled: () => setClaimingId(null),
  })

  /** 항목 클릭 → 읽음 처리 후 업무 상세 이동. (F-JIEOJO display) */
  const handlePress = (n: NotificationResponse) => {
    // 이미 읽은 알림도 상세로 이동. 읽음 처리는 멱등이므로 다시 호출해도 무방.
    markRead.mutate(n.id)
    void navigate(`/tasks/${n.task.id}`)
  }

  const handleClaim = (n: NotificationResponse) => {
    setClaimingId(n.task.id)
    claim.mutate({ taskId: n.task.id })
  }

  const today = notifications.data?.today ?? []
  const past = notifications.data?.past ?? []
  const isEmpty = today.length === 0 && past.length === 0

  return (
    <PageLayout title="알림함" backTo="/" showBottomNav>
      {/* 로딩 */}
      {notifications.isPending && (
        <p className="text-xl text-slate-500">알림을 불러오는 중…</p>
      )}

      {/* 오류 — 다른 화면은 영향받지 않는다. (완료 조건) */}
      {notifications.isError && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-xl text-amber-900"
        >
          <p className="font-bold">알림을 불러오지 못했습니다</p>
          <p className="mt-1 text-lg">잠시 뒤 자동으로 다시 시도합니다.</p>
        </div>
      )}

      {/* 빈 상태 (완료 조건) */}
      {notifications.isSuccess && isEmpty && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-5xl">🔔</span>
          <p className="text-2xl font-bold text-slate-700">알림이 없습니다</p>
          <p className="text-lg text-slate-500">
            새 업무가 배정되면 여기에 표시됩니다.
          </p>
        </div>
      )}

      {/* 오늘 알림 */}
      {today.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold text-slate-900">오늘 알림</h2>
          <ul className="flex flex-col gap-4">
            {today.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  onPress={handlePress}
                  onClaim={handleClaim}
                  claimPending={claimingId === n.task.id && claim.isPending}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 지난 알림 — 접었다 펼치기. (F-JIEOJO display) */}
      {past.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setPastOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-xl font-bold text-slate-700"
            aria-expanded={pastOpen}
          >
            <span>지난 알림 ({past.length}건)</span>
            <span className="text-slate-400">{pastOpen ? '▲' : '▼'}</span>
          </button>

          {pastOpen && (
            <ul className="mt-4 flex flex-col gap-4">
              {past.map((n) => (
                <li key={n.id}>
                  <NotificationItem
                    notification={n}
                    onPress={handlePress}
                    onClaim={handleClaim}
                    claimPending={claimingId === n.task.id && claim.isPending}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </PageLayout>
  )
}
