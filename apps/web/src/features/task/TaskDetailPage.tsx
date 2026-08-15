import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import { PageLayout } from '../../shared/ui/PageLayout'
import { useSession } from '../session/sessionContext'
import { assigneeLabel, claimedAgoLabel, claimStatusLabel, completionLabel, dueTimeLabel } from './task'
import { TasksLoadFailed, TasksLoading } from './TaskLoadState'
import {
  claimTask,
  completeTask,
  type TaskClaimResponse,
  type TaskCompleteResponse,
  type TaskResponse,
} from './taskApi'
import { useTask, useTaskCacheUpdate } from './useTasks'

type Stage = 'idle' | 'confirming' | 'delegating'

type ClaimNotice = { tone: 'success' | 'warn'; text: string }

/**
 * 담당 확정 결과 한 줄. 세 결과(맡음 · 이미 맡음 · 이미 완료)마다 다른 안내를 만든다.
 *
 * 서버 `notice` 는 "이미 OO님이 맡은 업무입니다."처럼 상대 시각이 없는 고정 문구라, 이미 맡은
 * 경우에는 `claimedAt` 으로 "OO님이 N분 전에 맡았습니다"를 화면에서 직접 만든다.
 */
function buildClaimNotice(response: TaskClaimResponse): ClaimNotice {
  if (response.claimed) {
    return { tone: 'success', text: '담당자로 확정되었습니다.' }
  }
  if (response.alreadyClaimed && response.task.assigneeName !== null && response.task.claimedAt !== null) {
    return {
      tone: 'warn',
      text: `${response.task.assigneeName}님이 ${claimedAgoLabel(response.task.claimedAt)} 맡았습니다.`,
    }
  }
  return { tone: 'warn', text: response.notice ?? '지금은 맡을 수 없습니다.' }
}

/**
 * 유저플로우 "새 플로우 3" n34 → n35 업무 상세 → n59 수행 확인됨? → n60 대리 완료 확인 모달 → n33 대리 완료 처리.
 *
 * **완료 처리 버튼은 이미 완료된 업무에서도 눌린다.** 다시 누르면 아무것도 바뀌지 않고
 * 중복 완료 안내가 뜬다(`alreadyCompleted`, Manyfast F-IVFNPC exceptions) — 업무를 다시 확인하러 온
 * 사람에게 "실패했다"가 아니라 "누가 언제 이미 확인했는지"를 보여 주기 위해서다.
 */
export function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()
  const task = useTask(Number(taskId))
  const updateCache = useTaskCacheUpdate()

  const [stage, setStage] = useState<Stage>('idle')
  const [confirmedByName, setConfirmedByName] = useState(session?.staff.name ?? '')
  const [result, setResult] = useState<TaskCompleteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [claimNotice, setClaimNotice] = useState<ClaimNotice | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  const complete = useMutation({
    mutationFn: (completedByName: string) =>
      completeTask(Number(taskId), { completedByName }),
    onSuccess: (response) => {
      updateCache(response.task)
      setResult(response)
      setStage('idle')
      setError(null)
    },
    onError: (caught: unknown) => {
      setError(
        caught instanceof ApiError
          ? caught.message
          : '완료 처리하지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
      )
    },
  })

  /**
   * '내가 처리할게요'. (Manyfast F-IVFNPC action, "새 플로우 5" n40 → `'내가 처리할게요' 선택`)
   *
   * 응답의 `claimable` 이 그대로 캐시에 반영되므로, 맡았든 경합에서 밀렸든 이후에는 버튼이 다시
   * 그려지지 않는다 — 세 결과 모두 서버가 돌려준 지금 상태로 담당 표시가 갱신되기 때문이다.
   */
  const claim = useMutation({
    mutationFn: (staffCode: string) => claimTask(Number(taskId), { staffCode }),
    onSuccess: (response) => {
      updateCache(response.task)
      setClaimNotice(buildClaimNotice(response))
      setClaimError(null)
    },
    onError: (caught: unknown) => {
      setClaimError(
        caught instanceof ApiError
          ? caught.message
          : '지금 맡지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
      )
    },
  })

  const startConfirm = () => {
    setResult(null)
    setError(null)
    setStage('confirming')
  }

  const declineConfirm = () => {
    // n59 부정 분기 — 아무것도 바꾸지 않고 목록으로 되돌아간다.
    navigate('/tasks')
  }

  const openDelegateModal = () => setStage('delegating')

  const submitCompletion = () => {
    if (confirmedByName.trim() === '') {
      setError('확인자 이름을 입력해 주세요.')
      return
    }
    complete.mutate(confirmedByName.trim())
  }

  return (
    <PageLayout title="업무 상세" backTo="/tasks" backLabel="업무 목록으로">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">업무 상세</h1>
      </header>

      {task.isPending && <TasksLoading />}
      {task.isError && <TasksLoadFailed onRetry={() => void task.refetch()} />}

      {task.isSuccess && (
        <>
          <TaskDetail task={task.data} />

          {claimNotice !== null && <ClaimResult notice={claimNotice} />}

          {task.data.claimable && session !== null && (
            <BigButton
              onClick={() => {
                setClaimNotice(null)
                setClaimError(null)
                claim.mutate(session.staff.code)
              }}
            >
              {claim.isPending ? '맡는 중…' : '내가 처리할게요'}
            </BigButton>
          )}

          {claimError !== null && (
            <p role="alert" className="text-lg text-amber-900">
              {claimError}
            </p>
          )}

          {result !== null && <CompletionResult result={result} onBackToList={() => navigate('/tasks')} />}

          {result === null && stage === 'idle' && (
            <BigButton onClick={startConfirm}>완료 처리</BigButton>
          )}

          {result === null && stage === 'confirming' && (
            <ConfirmPerformed onYes={openDelegateModal} onNo={declineConfirm} />
          )}

          {result === null && stage === 'delegating' && (
            <DelegateModal
              confirmedByName={confirmedByName}
              onChangeName={setConfirmedByName}
              saving={complete.isPending}
              error={error}
              onSubmit={submitCompletion}
              onCancel={() => setStage('idle')}
            />
          )}
        </>
      )}
    </PageLayout>
  )
}

function TaskDetail({ task }: { task: TaskResponse }) {
  const completed = completionLabel(task)

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 bg-white px-5 py-6">
      <p className="text-lg text-slate-500">{task.careRecipientName}</p>
      <p className="text-2xl font-semibold text-slate-900">{task.content}</p>
      <p className="text-xl text-slate-700">
        담당 {assigneeLabel(task)} · 기한 {dueTimeLabel(task)}
      </p>
      <p className="flex flex-wrap gap-2">
        <span
          className={`rounded-full px-4 py-2 text-lg font-semibold ${
            task.status === 'DONE'
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          {task.statusLabel}
        </span>
        {/* 담당 표시는 직종만 배정 · 담당자 확정 두 가지를 구분한다. (Manyfast F-IVFNPC display) */}
        <span
          className={`rounded-full px-4 py-2 text-lg font-semibold ${
            task.assigneeName === null
              ? 'bg-slate-100 text-slate-700'
              : 'bg-teal-100 text-teal-900'
          }`}
        >
          {claimStatusLabel(task)}
        </span>
      </p>
      {completed !== null && <p className="text-lg text-slate-600">{completed}</p>}
    </section>
  )
}

/** '내가 처리할게요' 결과 안내. */
function ClaimResult({ notice }: { notice: ClaimNotice }) {
  return (
    <section
      role="status"
      className={`flex flex-col gap-2 rounded-2xl border-2 px-5 py-6 ${
        notice.tone === 'success' ? 'border-teal-600 bg-teal-50' : 'border-amber-400 bg-amber-50'
      }`}
    >
      <p
        className={`text-xl font-semibold ${
          notice.tone === 'success' ? 'text-teal-900' : 'text-amber-900'
        }`}
      >
        {notice.text}
      </p>
    </section>
  )
}

/** n59 — 수행 확인됨? */
function ConfirmPerformed({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-teal-600 bg-teal-50 px-5 py-6">
      <p className="text-xl font-semibold text-teal-900">
        수행자가 이 업무를 처리했다고 확인하셨나요?
      </p>
      <BigButton onClick={onYes}>예, 확인했습니다</BigButton>
      <BigButton tone="plain" onClick={onNo}>
        아니오
      </BigButton>
    </section>
  )
}

/** n60 — 대리 완료 확인 모달. 확인자가 담당자와 다르면 대리 완료로 기록된다. */
function DelegateModal({
  confirmedByName,
  onChangeName,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  confirmedByName: string
  onChangeName: (value: string) => void
  saving: boolean
  error: string | null
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <section
      role="dialog"
      aria-label="완료 확인"
      className="flex flex-col gap-4 rounded-2xl border-2 border-teal-600 bg-white px-5 py-6"
    >
      <p className="text-xl font-semibold text-slate-900">확인한 사람의 이름을 남겨 주세요</p>
      <p className="text-lg text-slate-600">
        담당자와 다른 이름이면 대리 완료로 기록됩니다.
      </p>

      {error !== null && (
        <p role="alert" className="text-lg text-amber-900">
          {error}
        </p>
      )}

      <label htmlFor="confirmedByName" className="text-xl font-semibold text-slate-900">
        확인자 이름
      </label>
      <input
        id="confirmedByName"
        value={confirmedByName}
        onChange={(event) => onChangeName(event.target.value)}
        maxLength={50}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />

      <BigButton onClick={onSubmit}>{saving ? '처리하는 중…' : '완료 처리'}</BigButton>
      <BigButton tone="plain" onClick={onCancel}>
        취소
      </BigButton>
    </section>
  )
}

/** n33 결과. 새로 닫았는지, 이미 완료된 업무였는지에 따라 다른 안내를 보여 준다. */
function CompletionResult({
  result,
  onBackToList,
}: {
  result: TaskCompleteResponse
  onBackToList: () => void
}) {
  const completed = completionLabel(result.task)

  return (
    <section
      role="status"
      className={`flex flex-col gap-4 rounded-2xl border-2 px-5 py-6 ${
        result.alreadyCompleted
          ? 'border-amber-400 bg-amber-50'
          : 'border-teal-600 bg-teal-50'
      }`}
    >
      <h2
        className={`text-2xl font-bold ${
          result.alreadyCompleted ? 'text-amber-900' : 'text-teal-900'
        }`}
      >
        {result.alreadyCompleted ? '이미 완료 처리된 업무입니다' : '완료 처리했습니다'}
      </h2>
      {result.notice !== null && (
        <p className={result.alreadyCompleted ? 'text-lg text-amber-900' : 'text-lg text-teal-900'}>
          {result.notice}
        </p>
      )}
      {completed !== null && <p className="text-lg text-slate-700">{completed}</p>}

      <BigButton onClick={onBackToList}>업무 목록으로</BigButton>
    </section>
  )
}
