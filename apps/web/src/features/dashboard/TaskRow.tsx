import { Link } from 'react-router'
import type { TaskResponse } from '../task/taskApi'

function formatAssignee(task: TaskResponse): string {
  const parts = [task.assigneeName, task.assigneeJobRoleLabel].filter(
    (part): part is string => part !== null,
  )
  return parts.length === 0 ? '담당 미정' : parts.join(' · ')
}

/**
 * 목록에 뜨는 업무 한 줄.
 *
 * 담당(직종 또는 이름) · 기한 · 상태를 **언제나 같이** 보여 준다. 셋 중 하나만 빠져도 "누가 언제까지
 * 무엇을" 이 안 닫힌다. (Manyfast F-IVFNPC display)
 *
 * 이동:
 * - 업무 상세: 유저플로우 "AI 인계 도구 내비게이션 맵" n42/n44 → n35 업무 상세 화면
 * - 인계 카드: 유저플로우 n46 인계 카드로 이동 → n18 인계 카드 상세 화면
 * - 기록 문구 출력: 유저플로우 n47 기록 출력으로 이동 → n36 기록 문구 출력 화면
 */
export function TaskRow({ task }: { task: TaskResponse }) {
  return (
    <li className="rounded-2xl border-2 border-border-card bg-white px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xl font-bold text-ink">{task.careRecipientName}</span>
        <span className="text-lg text-ink-muted">{task.dueTime}까지</span>
      </div>

      <p className="mt-2 text-xl text-ink">{task.content}</p>

      <p className="mt-2 text-lg text-ink-muted">
        {formatAssignee(task)} · {task.statusLabel}
      </p>

      {task.status === 'DONE' && task.completedByName !== null && (
        <p className="mt-1 text-lg text-ink-muted">
          {task.completedByName} 확인
          {/*
            대리 완료는 저장된 값이 아니라 담당자와 확인자를 비교한 판정이다. 직종만 배정된 업무는
            사람 단위로 정해진 적이 없어 거짓이고, 그때는 확인자 이름만 그대로 보여 준다.
          */}
          {task.delegated && (
            <span className="ml-2 rounded-full bg-btn-neutral px-3 py-1 text-base font-semibold text-ink-muted">
              대리 완료
            </span>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-lg font-semibold">
        <Link
          to={`/tasks/${task.id}`}
          className="text-primary underline underline-offset-4"
        >
          업무 상세
        </Link>
        <Link
          to={`/handover-cards/${task.handoverCardId}`}
          className="text-primary underline underline-offset-4"
        >
          인계 카드 보기
        </Link>
        <Link
          to={`/handover-cards/${task.handoverCardId}/export`}
          className="text-primary underline underline-offset-4"
        >
          기록 문구 출력
        </Link>
      </div>
    </li>
  )
}
