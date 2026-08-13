import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { ApiError, type ApiFieldError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import { CardsLoadFailed, CardsLoading } from '../handover-card/CardsLoadState'
import { findCard, jobRoleLabel, JOB_ROLE_LABELS } from '../handover-card/handoverCard'
import type { JobRole } from '../handover-card/handoverCardApi'
import { useHandoverCards } from '../handover-card/useHandoverCards'
import { createTask, type TaskResponse } from './taskApi'
import {
  draftFromCard,
  taskFieldLabel,
  toTaskCreateRequest,
  validateTaskDraft,
  type TaskDraft,
} from './taskForm'

const JOB_ROLES = Object.keys(JOB_ROLE_LABELS) as JobRole[]

/**
 * 유저플로우 "새 플로우 3" n26 → n27 · n28 · n29 · n30 — 후속 업무 배정.
 *
 * 빈 입력으로 열리지 않는다. 카드가 검토에서 확정한 다음 행동·제안 직종·제안 기한을 그대로 채운 뒤
 * 직원이 확정하거나 고친다. (Manyfast F-IVFNPC display)
 *
 * 업무 목록·완료 처리(n34~n37)는 이 화면의 범위가 아니다. (#15)
 */
export function TaskAssignPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const cards = useHandoverCards()

  const parsed = Number(cardId)
  const card =
    cards.data === undefined || !Number.isInteger(parsed) ? null : findCard(cards.data, parsed)

  const [draft, setDraft] = useState<TaskDraft | null>(null)
  const [errors, setErrors] = useState<ApiFieldError[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [created, setCreated] = useState<TaskResponse | null>(null)

  // 카드가 처음 로드될 때만 프리필을 만든다. 사용자가 고친 값을 재조회로 덮어쓰지 않는다.
  useEffect(() => {
    if (card !== null && draft === null) {
      setDraft(draftFromCard(card))
    }
  }, [card, draft])

  const assign = useMutation({
    mutationFn: (request: TaskDraft) => createTask(parsed, toTaskCreateRequest(request)),
    onSuccess: (task) => {
      setErrors([])
      setNotice(null)
      setCreated(task)
    },
    onError: (error: unknown) => {
      if (!(error instanceof ApiError)) {
        setErrors([])
        setNotice('업무를 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.')
        return
      }
      if (error.fields.length > 0) {
        setErrors([...error.fields])
        setNotice(null)
        return
      }
      setErrors([])
      setNotice(error.message)
    },
  })

  const update = (patch: Partial<TaskDraft>) => {
    setDraft((current) => (current === null ? current : { ...current, ...patch }))
    setErrors([])
    setNotice(null)
  }

  const submit = () => {
    if (draft === null) {
      return
    }
    const found = validateTaskDraft(draft)
    if (found.length > 0) {
      setErrors(found)
      setNotice(null)
      return
    }
    setErrors([])
    setNotice(null)
    assign.mutate(draft)
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-7 px-5 py-8">
      <header>
        <Link
          to={`/handover-cards/${cardId}`}
          className="rounded-xl px-2 py-2 text-xl font-semibold text-teal-800 underline underline-offset-4"
        >
          카드로 돌아가기
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">후속 업무 배정</h1>
      </header>

      {cards.isPending && <CardsLoading />}
      {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}

      {cards.isSuccess && card === null && (
        <p className="text-xl text-slate-600">
          그 인계 카드를 찾지 못했습니다. 오늘 목록에 없는 카드일 수 있습니다.
        </p>
      )}

      {card !== null && card.careRecipientId === null && (
        <p className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
          이 카드는 아직 대상 어르신을 가리지 못했습니다. 카드에서 어르신을 먼저 지정해 주세요.
        </p>
      )}

      {card !== null && card.careRecipientId !== null && card.nextAction === null && (
        <p className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
          이 카드에는 남은 다음 행동이 없어 후속 업무를 만들 수 없습니다.
        </p>
      )}

      {card !== null &&
        card.careRecipientId !== null &&
        card.nextAction !== null &&
        draft !== null &&
        created === null && (
          <TaskForm
            careRecipientName={card.careRecipientName ?? '대상 어르신'}
            draft={draft}
            errors={errors}
            notice={notice}
            saving={assign.isPending}
            onChange={update}
            onSubmit={submit}
          />
        )}

      {created !== null && (
        <TaskCreatedNotice
          task={created}
          onBackToCard={() => navigate(`/handover-cards/${cardId}`)}
          onBackToList={() => navigate('/handover-cards')}
        />
      )}
    </main>
  )
}

function Problems({ errors, notice }: { errors: ApiFieldError[]; notice: string | null }) {
  if (errors.length === 0 && notice === null) {
    return null
  }

  return (
    <section
      role="alert"
      className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900"
    >
      {errors.length > 0 && (
        <>
          <p className="text-2xl font-bold">보완할 항목이 있습니다</p>
          <ul className="mt-3 flex flex-col gap-2">
            {errors.map((error) => (
              <li key={`${error.field}-${error.reason}`}>
                <span className="font-semibold">{taskFieldLabel(error.field)}</span> —{' '}
                {error.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      {notice !== null && <p className={errors.length > 0 ? 'mt-3' : ''}>{notice}</p>}
    </section>
  )
}

/** n27 · n28 — AI 제안값이 채워진 배정 화면. */
function TaskForm({
  careRecipientName,
  draft,
  errors,
  notice,
  saving,
  onChange,
  onSubmit,
}: {
  careRecipientName: string
  draft: TaskDraft
  errors: ApiFieldError[]
  notice: string | null
  saving: boolean
  onChange: (patch: Partial<TaskDraft>) => void
  onSubmit: () => void
}) {
  return (
    <section className="flex flex-col gap-6">
      <p className="text-xl text-slate-600">
        입소자 <span className="font-semibold text-slate-900">{careRecipientName}</span>
      </p>

      <Problems errors={errors} notice={notice} />

      <p className="text-lg text-slate-500">
        아래 값은 카드에서 제안한 내용으로 미리 채워져 있습니다. 그대로 두거나 고쳐서 확정해 주세요.
      </p>

      <label htmlFor="content" className="text-2xl font-bold text-slate-900">
        다음 행동
      </label>
      <textarea
        id="content"
        value={draft.content}
        onChange={(event) => onChange({ content: event.target.value })}
        rows={3}
        maxLength={500}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-2xl font-bold text-slate-900">담당 직종</legend>
        <p className="text-lg text-slate-500">담당자를 특정하지 않고 직종으로만 배정할 수 있습니다.</p>
        <div className="flex flex-col gap-3">
          {JOB_ROLES.map((role) => (
            <BigButton
              key={role}
              tone="plain"
              selected={draft.assigneeJobRole === role}
              onClick={() =>
                onChange({ assigneeJobRole: draft.assigneeJobRole === role ? null : role })
              }
            >
              {jobRoleLabel(role)}
            </BigButton>
          ))}
        </div>
      </fieldset>

      <label htmlFor="assigneeName" className="text-2xl font-bold text-slate-900">
        담당자 이름 (선택)
      </label>
      <input
        id="assigneeName"
        value={draft.assigneeName}
        onChange={(event) => onChange({ assigneeName: event.target.value })}
        maxLength={50}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />

      <label htmlFor="dueTime" className="text-2xl font-bold text-slate-900">
        기한
      </label>
      <p className="text-lg text-slate-500">
        오늘 어르신이 하원하는 시각을 넘겨 지정할 수 없습니다.
      </p>
      <input
        id="dueTime"
        type="time"
        value={draft.dueTime}
        onChange={(event) => onChange({ dueTime: event.target.value })}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />

      <BigButton onClick={onSubmit}>{saving ? '배정하는 중…' : '업무로 배정하기'}</BigButton>
    </section>
  )
}

/** n29 · n30 — 배정 완료. */
function TaskCreatedNotice({
  task,
  onBackToCard,
  onBackToList,
}: {
  task: TaskResponse
  onBackToCard: () => void
  onBackToList: () => void
}) {
  return (
    <section role="status" className="flex flex-col gap-6">
      <div className="rounded-2xl border-2 border-teal-600 bg-teal-50 px-5 py-6">
        <h2 className="text-2xl font-bold text-teal-900">업무를 배정했습니다</h2>
        <p className="mt-3 text-xl text-teal-900">{task.content}</p>
        <p className="mt-2 text-lg text-teal-800">
          담당{' '}
          {task.assigneeName ?? (task.assigneeJobRoleLabel ?? '미정')}
          {task.assigneeName !== null && task.assigneeJobRoleLabel !== null
            ? ` (${task.assigneeJobRoleLabel})`
            : ''}{' '}
          · {task.dueTime}까지 · {task.statusLabel}
        </p>
      </div>

      <BigButton onClick={onBackToCard}>카드로 돌아가기</BigButton>
      <BigButton tone="plain" onClick={onBackToList}>
        인계 카드 목록으로
      </BigButton>
    </section>
  )
}
