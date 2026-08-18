import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { ApiError, type ApiFieldError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import { PageLayout } from '../../shared/ui/PageLayout'
import { CardsLoadFailed, CardsLoading } from '../handover-card/CardsLoadState'
import { findCard, highlightSummary, jobRoleLabel, JOB_ROLE_LABELS } from '../handover-card/handoverCard'
import type { HandoverCard, JobRole } from '../handover-card/handoverCardApi'
import { useHandoverCards } from '../handover-card/useHandoverCards'
import type { Staff } from '../session/staffDirectory'
import { useSession } from '../session/sessionContext'
import { useStaffDirectory } from '../session/useStaffDirectory'
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
  const { session } = useSession()
  const cards = useHandoverCards()
  const directory = useStaffDirectory()
  const staffList = directory.data ?? []

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
    mutationFn: (request: TaskDraft) =>
      // assignedByStaffCode: 배정한 사람 사번을 세션에서 주입. 알림 actorName + 자기제외 판정에 사용.
      // (#70 댓글, #71)
      createTask(parsed, toTaskCreateRequest(request, session?.staff.code)),
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
    <PageLayout
      title="후속 업무 배정"
      backTo={`/handover-cards/${cardId}`}
      backLabel="카드로 돌아가기"
    >
      {cards.isPending && <CardsLoading />}
      {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}

      {cards.isSuccess && card === null && (
        <p className="text-xl text-ink-muted">
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
            card={card}
            draft={draft}
            staffList={staffList}
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
    </PageLayout>
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
  card,
  draft,
  staffList,
  errors,
  notice,
  saving,
  onChange,
  onSubmit,
}: {
  card: HandoverCard
  draft: TaskDraft
  staffList: Staff[]
  errors: ApiFieldError[]
  notice: string | null
  saving: boolean
  onChange: (patch: Partial<TaskDraft>) => void
  onSubmit: () => void
}) {
  return (
    <section className="flex flex-col gap-6">
      <HandoverCardSummary card={card} />

      <Problems errors={errors} notice={notice} />

      <p className="text-lg text-ink-muted">AI 제안 - 검토 후 수정해주세요.</p>

      <label htmlFor="content" className="text-2xl font-bold text-ink">
        후속 업무
      </label>
      <textarea
        id="content"
        value={draft.content}
        onChange={(event) => onChange({ content: event.target.value })}
        rows={3}
        maxLength={500}
        className="w-full rounded-2xl border-2 border-border-card px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-2xl font-bold text-ink">담당 직종</legend>
        <p className="text-lg text-ink-muted">담당자를 특정하지 않고 직종으로만 배정할 수 있습니다.</p>
        <div className="flex flex-wrap gap-2">
          {JOB_ROLES.map((role) => (
            <JobRoleChip
              key={role}
              selected={draft.assigneeJobRole === role}
              onClick={() =>
                onChange({
                  assigneeJobRole: draft.assigneeJobRole === role ? null : role,
                  assigneeName: '',
                  assigneeStaffCode: '',
                })
              }
            >
              {jobRoleLabel(role)}
            </JobRoleChip>
          ))}
        </div>
      </fieldset>

      {(() => {
        const filteredStaff = draft.assigneeJobRole
          ? staffList.filter((s) => s.jobRole === draft.assigneeJobRole)
          : staffList

        return (
          <div className="flex flex-col gap-2">
            <label htmlFor="assigneeName" className="text-2xl font-bold text-ink">
              담당자 (선택)
            </label>
            <p className="text-lg text-ink-muted">
              {draft.assigneeJobRole
                ? `${jobRoleLabel(draft.assigneeJobRole)} 직종 직원만 표시됩니다.`
                : '특정 담당자를 지정하지 않으면 선택한 직종으로만 배정됩니다.'}
            </p>
            <select
              id="assigneeName"
              value={draft.assigneeStaffCode}
              onChange={(event) => {
                const code = event.target.value
                const found = filteredStaff.find((s) => s.code === code)
                // code 가 있으면 이름·사번을 함께 저장. 빈 선택이면 둘 다 초기화.
                // assigneeStaffCode 는 알림 생성의 자기제외 판정과 actorName 에 사용. (#70 댓글)
                onChange({
                  assigneeName: found?.name ?? '',
                  assigneeStaffCode: code,
                })
              }}
              className="w-full rounded-2xl border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
            >
              <option value="">직종만 배정 (특정인 미지정)</option>
              {/* 현재 선택값이 목록에 없으면(예: 카드 프리필로 이름만 있는 경우) fallback 옵션 추가 */}
              {draft.assigneeName !== '' &&
                !filteredStaff.some((s) => s.name === draft.assigneeName) && (
                  <option value={draft.assigneeStaffCode}>{draft.assigneeName}</option>
                )}
              {filteredStaff.map((staff) => (
                <option key={staff.code} value={staff.code}>
                  {staff.name} ({staff.code})
                </option>
              ))}
            </select>
          </div>
        )
      })()}

      <label htmlFor="dueTime" className="text-2xl font-bold text-ink">
        기한
      </label>
      <p className="text-lg text-ink-muted">
        오늘 어르신이 하원하는 시각을 넘겨 지정할 수 없습니다.
      </p>
      <input
        id="dueTime"
        type="time"
        value={draft.dueTime}
        onChange={(event) => onChange({ dueTime: event.target.value })}
        className="w-full rounded-2xl border-2 border-border-card px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />

      <BigButton onClick={onSubmit}>{saving ? '배정하는 중…' : '업무 배정 완료'}</BigButton>
    </section>
  )
}

/**
 * "인계 카드 요약" 박스. (완료 조건 — 어르신 이름·카드 요약·원문 근거 링크)
 *
 * 새 API를 부르지 않는다. 이미 로드된 `card`(카드 목록 응답)의 값을 그대로 재사용한다 —
 * `highlightSummary`는 상태 변화 → 조치 → 다음 행동 → 근거 원문 순으로 첫 값을 골라 같은 방식으로
 * 요약하는, 현장 홈에서도 쓰는 대표 문구 함수다. (Manyfast F-SNBVHR — 이 카드는 #92가 확정한 데이터다)
 */
function HandoverCardSummary({ card }: { card: HandoverCard }) {
  return (
    <div className="rounded-2xl border-2 border-border-card bg-white px-5 py-5">
      <p className="text-lg font-semibold text-ink-muted">인계 카드 요약</p>
      <p className="mt-1 text-2xl font-bold text-ink">
        {card.careRecipientName ?? '대상 어르신'}
        {card.careRecipientName && <span className="ml-1 text-xl font-normal text-ink-muted">어르신</span>}
      </p>
      <p className="mt-2 text-xl text-ink-muted">{highlightSummary(card)}</p>
      <Link
        to={`/handover-cards/${card.id}`}
        className="mt-3 inline-flex items-center gap-1 text-lg font-semibold text-primary hover:underline"
      >
        원문 근거 확인 가능 <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
      </Link>
    </div>
  )
}

/** 담당 직종 단일 선택 칩. 짧은 고정 목록이라 드롭다운 대신 아웃라인 pill을 쓴다(DESIGN.md §8.4·§2.1). */
function JobRoleChip({
  children,
  selected,
  onClick,
}: {
  children: ReactNode
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-10 rounded-full px-5 py-2.5 text-lg font-semibold transition-colors ${
        selected
          ? 'bg-primary text-white'
          : 'border border-border-card bg-white text-ink hover:bg-primary-soft'
      }`}
    >
      {children}
    </button>
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
      <div className="rounded-2xl border-2 border-success/40 bg-success/10 px-5 py-6">
        <h2 className="text-2xl font-bold text-success">업무를 배정했습니다</h2>
        <p className="mt-3 text-xl text-ink">{task.content}</p>
        <p className="mt-2 text-lg text-ink-muted">
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
