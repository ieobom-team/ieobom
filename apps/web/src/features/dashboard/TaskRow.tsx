import { Link } from 'react-router'
import type { TaskResponse } from '../task/taskApi'

/**
 * 목록에 뜨는 업무 한 줄.
 *
 * 담당(직종 또는 이름) · 기한 · 상태를 **언제나 같이** 보여 준다. 셋 중 하나만 빠져도 "누가 언제까지
 * 무엇을" 이 안 닫힌다. (Manyfast F-IVFNPC display)
 *
 * 이동은 **인계 카드 상세 하나뿐이다.** 업무 상세(유저플로우 n34)와 기록 문구 화면(n39)은 아직 화면이
 * 없다. 각각 #15 · #18 이 만들고, 그 뒤에 여기서 링크를 연결한다. 없는 경로로 링크를 미리 걸면 눌렀을 때
 * 진입 선택 화면으로 튕긴다.
 */
export function TaskRow({ task }: { task: TaskResponse }) {
  return (
    <li className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xl font-bold text-slate-900">{task.careRecipientName}</span>
        <span className="text-lg text-slate-500">{task.dueTime}까지</span>
      </div>

      <p className="mt-2 text-xl text-slate-900">{task.content}</p>

      <p className="mt-2 text-lg text-slate-600">
        {assigneeLabel(task)} · {task.statusLabel}
      </p>

      {task.status === 'DONE' && task.completedByName !== null && (
        <p className="mt-1 text-lg text-slate-600">
          {task.completedByName} 확인
          {/*
            대리 완료는 저장된 값이 아니라 담당자와 확인자를 비교한 판정이다. 직종만 배정된 업무는
            사람 단위로 정해진 적이 없어 거짓이고, 그때는 확인자 이름만 그대로 보여 준다.
          */}
          {task.delegated && (
            <span className="ml-2 rounded-full bg-slate-100 px-3 py-1 text-base font-semibold text-slate-700">
              대리 완료
            </span>
          )}
        </p>
      )}

      <Link
        to={`/handover-cards/${task.handoverCardId}`}
        className="mt-3 inline-block text-lg font-semibold text-teal-800 underline underline-offset-4"
      >
        인계 카드 보기
      </Link>
    </li>
  )
}

/**
 * 담당을 한 줄로.
 *
 * 직종과 이름 중 하나만 있어도 되고, 둘 다 있을 수도 있다. 수행자가 앱을 쓰지 않는 직종이면 사람을
 * 특정하지 않고 직종으로만 배정하는 것이 현장의 기본 경로다.
 */
export function assigneeLabel(task: TaskResponse): string {
  const parts = [task.assigneeName, task.assigneeJobRoleLabel].filter(
    (part): part is string => part !== null,
  )
  return parts.length === 0 ? '담당 미정' : parts.join(' · ')
}
