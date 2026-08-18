import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { ApiError, type ApiFieldError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import { PageLayout } from '../../shared/ui/PageLayout'
import type { CareRecipient } from '../recipient/recipientApi'
import { useAllRecipients } from '../recipient/useRecipients'
import {
  cardDraftFrom,
  cardFieldLabel,
  toCardUpdateRequest,
  validateCardDraft,
  type CardEditDraft,
} from './cardEditForm'
import { CardsLoadFailed, CardsLoading } from './CardsLoadState'
import { chipTextsFor, findCard, jobRoleLabel, JOB_ROLE_LABELS, observedTimeLabel } from './handoverCard'
import {
  changeReviewStatus,
  markSafety,
  updateHandoverCard,
  type HandoverCard,
  type JobRole,
} from './handoverCardApi'
import { CardBadges, CardEvidence, CardUncertainNotes } from './HandoverCardBody'
import { useCardCacheUpdate, useHandoverCards } from './useHandoverCards'

const JOB_ROLES = Object.keys(JOB_ROLE_LABELS) as JobRole[]

/**
 * 유저플로우 "새 플로우 3" n25 — 카드 내용 수정·검토.
 *
 * 상세(n21)와 검토 필요 항목(n24) 양쪽에서 들어오고, 저장하면 n21 로 돌아간다.
 *
 * 항목 수정 · 안전 표시 · 검토 완료 전환을 **한 화면에** 둔다. 유저플로우 "새 플로우 3"가 이 셋을 "카드 내용
 * 수정·검토" 한 동작으로 묶어 두었고, 직원이 카드를 고친 다음 검토 완료를 누르는 것이 한 번의 일이기
 * 때문이다. 서버 API 는 셋이 따로다. (`docs/contracts/handover-card-schema.md`)
 *
 * 근거 원문과 관찰 시각은 고칠 수 없다. 원문에서 뽑아 원문과 대조해 통과시킨 값이라, 사람이 고칠 수
 * 있으면 그 카드가 원문의 어디서 나왔는지 더 이상 말할 수 없다.
 */
export function HandoverCardEditPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const cards = useHandoverCards()
  const applyCard = useCardCacheUpdate()
  // 이미 남은 카드가 가리키는 어르신을 고르는 자리라 이용 종료한 어르신까지 받는다.
  // 새 입력이 아니므로 목록에서 빼면 그 카드의 현재 대상이 선택지에서 사라진다.
  const recipients = useAllRecipients()

  const parsed = Number(cardId)
  const card =
    cards.data === undefined || !Number.isInteger(parsed) ? null : findCard(cards.data, parsed)

  const [draft, setDraft] = useState<CardEditDraft | null>(null)
  const [errors, setErrors] = useState<ApiFieldError[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  // 카드가 처음 로드될 때만 채운다. 저장 응답이 캐시에 반영돼도 편집 중인 값을 덮어쓰지 않는다.
  useEffect(() => {
    if (card !== null && draft === null) {
      setDraft(cardDraftFrom(card))
    }
  }, [card, draft])

  const fail = (error: unknown, fallback: string) => {
    if (!(error instanceof ApiError)) {
      setErrors([])
      setNotice(fallback)
      return
    }
    setErrors([...error.fields])
    setNotice(error.fields.length > 0 ? null : error.message)
  }

  /**
   * 저장, 그리고 이어서 검토 완료.
   *
   * 두 API 를 잇달아 부르므로 **앞은 됐는데 뒤가 실패하는 경우**가 있다. 어르신을 가리지 못한 카드는
   * 검토 완료가 되지 못하기 때문이다(`409`). 그때 "저장하지 못했습니다"라고 말하면 직원이 고친 내용을
   * 다시 쓰게 된다. 저장은 됐다는 사실과 검토 완료만 안 됐다는 사실을 나눠서 알린다.
   */
  const save = useMutation({
    mutationFn: async ({ edited, thenReview }: { edited: CardEditDraft; thenReview: boolean }) => {
      const saved = await updateHandoverCard(parsed, toCardUpdateRequest(edited))
      if (!thenReview) {
        return { card: saved, reviewFailure: null }
      }
      try {
        return { card: await changeReviewStatus(parsed, 'REVIEWED'), reviewFailure: null }
      } catch (error) {
        const reason = error instanceof ApiError ? error.message : '잠시 뒤 다시 눌러 주세요.'
        return { card: saved, reviewFailure: reason }
      }
    },
    onSuccess: ({ card: saved, reviewFailure }) => {
      applyCard(saved)
      setErrors([])
      if (reviewFailure !== null) {
        setNotice(`고친 내용은 저장했습니다. 검토 완료로는 바꾸지 못했습니다 — ${reviewFailure}`)
        return
      }
      setNotice(null)
      // replace: true — 뒤로가기를 누르면 방금 저장을 끝낸 이 수정 화면이 아니라
      // 수정하러 들어오기 전 화면으로 곧장 가야 한다. (#134)
      navigate(`/handover-cards/${parsed}`, { replace: true })
    },
    onError: (error: unknown) => fail(error, '저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.'),
  })

  /** 검토 완료를 되돌린다. 잘못 눌러 검토 완료가 된 카드에서 빠져나올 길은 있어야 한다. */
  const revertReview = useMutation({
    mutationFn: () => changeReviewStatus(parsed, 'NEEDS_REVIEW'),
    onSuccess: (reverted) => {
      applyCard(reverted)
      setErrors([])
      setNotice('검토 필요로 되돌렸습니다.')
    },
    onError: (error: unknown) => fail(error, '검토 상태를 바꾸지 못했습니다. 잠시 뒤 다시 눌러 주세요.'),
  })

  /** 안전 표시는 저장 버튼을 기다리지 않고 바로 반영한다. 별도 API 이고 되돌릴 수 있다. */
  const toggleSafety = useMutation({
    mutationFn: (safetyRelated: boolean) => markSafety(parsed, safetyRelated),
    onSuccess: (marked) => {
      applyCard(marked)
      setErrors([])
      setNotice(null)
    },
    onError: (error: unknown) => fail(error, '안전 표시를 바꾸지 못했습니다. 잠시 뒤 다시 눌러 주세요.'),
  })

  const update = (patch: Partial<CardEditDraft>) => {
    setDraft((current) => (current === null ? current : { ...current, ...patch }))
    setErrors([])
    setNotice(null)
  }

  const submit = (thenReview: boolean) => {
    if (draft === null) {
      return
    }
    const found = validateCardDraft(draft)
    if (found.length > 0) {
      setErrors(found)
      setNotice(null)
      return
    }
    setErrors([])
    setNotice(null)
    save.mutate({ edited: draft, thenReview })
  }

  return (
    <PageLayout
      title="카드 검토·수정"
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

      {card !== null && draft !== null && (
        <CardEditForm
          card={card}
          draft={draft}
          recipients={recipients.data ?? []}
          recipientsLoading={recipients.isPending}
          recipientsFailed={recipients.isError}
          onRetryRecipients={() => void recipients.refetch()}
          errors={errors}
          notice={notice}
          saving={save.isPending}
          reviewChanging={revertReview.isPending}
          safetyChanging={toggleSafety.isPending}
          onChange={update}
          onToggleSafety={() => toggleSafety.mutate(!card.safetyRelated)}
          onRevertReview={() => revertReview.mutate()}
          onSubmit={submit}
        />
      )}
    </PageLayout>
  )
}

/** 보완할 항목을 한 번에 모아 보여 준다. 같은 이유로 걸린 항목은 한 줄로 묶는다. */
function Problems({ errors, notice }: { errors: ApiFieldError[]; notice: string | null }) {
  if (errors.length === 0 && notice === null) {
    return null
  }

  const grouped = new Map<string, string[]>()
  for (const error of errors) {
    grouped.set(error.reason, [...(grouped.get(error.reason) ?? []), cardFieldLabel(error.field)])
  }

  return (
    <section
      role="alert"
      className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900"
    >
      {grouped.size > 0 && (
        <>
          <p className="text-2xl font-bold">보완할 항목이 있습니다</p>
          <ul className="mt-3 flex flex-col gap-2">
            {[...grouped].map(([reason, fields]) => (
              <li key={reason}>
                <span className="font-semibold">{fields.join(' · ')}</span> — {reason}
              </li>
            ))}
          </ul>
        </>
      )}
      {notice !== null && <p className={grouped.size > 0 ? 'mt-3' : ''}>{notice}</p>}
    </section>
  )
}

function CardEditForm({
  card,
  draft,
  recipients,
  recipientsLoading,
  recipientsFailed,
  onRetryRecipients,
  errors,
  notice,
  saving,
  reviewChanging,
  safetyChanging,
  onChange,
  onToggleSafety,
  onRevertReview,
  onSubmit,
}: {
  card: HandoverCard
  draft: CardEditDraft
  recipients: CareRecipient[]
  recipientsLoading: boolean
  recipientsFailed: boolean
  onRetryRecipients: () => void
  errors: ApiFieldError[]
  notice: string | null
  saving: boolean
  reviewChanging: boolean
  safetyChanging: boolean
  onChange: (patch: Partial<CardEditDraft>) => void
  onToggleSafety: () => void
  onRevertReview: () => void
  onSubmit: (thenReview: boolean) => void
}) {
  const observedTime = observedTimeLabel(card.observedAt)
  const hasNextAction = draft.nextAction.trim() !== ''

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <CardBadges card={card} />
        {observedTime !== null && <span className="text-lg text-ink-muted">관찰 {observedTime}</span>}
      </div>

      <CardUncertainNotes card={card} />
      <CardEvidence card={card} />
      <p className="text-lg text-ink-muted">
        근거 원문과 관찰 시각은 원문에서 읽은 값이라 고치지 않습니다. 원문이 잘못됐으면 카드가 아니라
        특이사항을 다시 남겨 주세요.
      </p>

      <Problems errors={errors} notice={notice} />

      <RecipientPicker
        selected={draft.careRecipientId}
        recipients={recipients}
        loading={recipientsLoading}
        failed={recipientsFailed}
        onRetry={onRetryRecipients}
        onSelect={(careRecipientId) => onChange({ careRecipientId })}
      />

      <label htmlFor="statusChange" className="text-2xl font-bold text-ink">
        상태 변화
      </label>
      <textarea
        id="statusChange"
        value={draft.statusChange}
        onChange={(event) => onChange({ statusChange: event.target.value })}
        rows={2}
        maxLength={500}
        className="w-full rounded-2xl border-2 border-border-card px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />

      <label htmlFor="actionTaken" className="text-2xl font-bold text-ink">
        조치
      </label>
      <textarea
        id="actionTaken"
        value={draft.actionTaken}
        onChange={(event) => onChange({ actionTaken: event.target.value })}
        rows={2}
        maxLength={500}
        className="w-full rounded-2xl border-2 border-border-card px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />
      <SuggestedActionChips
        texts={chipTextsFor(card, 'ACTION_TAKEN')}
        onSelect={(text) => onChange({ actionTaken: text })}
      />

      <label htmlFor="nextAction" className="text-2xl font-bold text-ink">
        다음 행동
      </label>
      <textarea
        id="nextAction"
        value={draft.nextAction}
        onChange={(event) => onChange({ nextAction: event.target.value })}
        rows={2}
        maxLength={500}
        className="w-full rounded-2xl border-2 border-border-card px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />
      <SuggestedActionChips
        texts={chipTextsFor(card, 'NEXT_ACTION')}
        onSelect={(text) => onChange({ nextAction: text })}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-2xl font-bold text-ink">제안 담당 직종</legend>
        <p className="text-lg text-ink-muted">
          {hasNextAction
            ? 'AI 제안입니다. 다시 눌러 해제할 수 있고, 배정 화면에서 또 고칠 수 있습니다.'
            : '다음 행동이 있어야 지정할 수 있습니다.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {JOB_ROLES.map((role) => (
            <JobRoleChip
              key={role}
              selected={draft.suggestedJobRole === role}
              onClick={() =>
                onChange({ suggestedJobRole: draft.suggestedJobRole === role ? null : role })
              }
            >
              {jobRoleLabel(role)}
            </JobRoleChip>
          ))}
        </div>
      </fieldset>

      <label htmlFor="suggestedDueTime" className="text-2xl font-bold text-ink">
        제안 기한
      </label>
      <input
        id="suggestedDueTime"
        type="time"
        value={draft.suggestedDueTime}
        onChange={(event) => onChange({ suggestedDueTime: event.target.value })}
        className="w-full rounded-2xl border-2 border-border-card px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-2xl font-bold text-ink">안전 관련 표시</legend>
        <p className="text-lg text-ink-muted">
          {card.safetyRelated
            ? '이 카드는 지금 목록 맨 위에 올라갑니다.'
            : '낙상 · 발열 · 식사 저하 · 투약 변경은 서버가 자동으로 잡습니다. 그 밖의 것은 직접 표시해 주세요.'}
        </p>
        <BigButton tone="plain" selected={card.safetyRelated} onClick={onToggleSafety}>
          {safetyChanging
            ? '바꾸는 중…'
            : card.safetyRelated
              ? '안전 관련 표시 해제하기'
              : '안전 관련으로 표시하기'}
        </BigButton>
      </fieldset>

      <BigButton tone="plain" onClick={() => onSubmit(false)}>
        {saving ? '저장하는 중…' : '저장하기'}
      </BigButton>

      {card.reviewStatus === 'NEEDS_REVIEW' ? (
        <BigButton onClick={() => onSubmit(true)}>
          {saving ? '저장하는 중…' : '저장하고 검토 완료'}
        </BigButton>
      ) : (
        <BigButton tone="plain" onClick={onRevertReview}>
          {reviewChanging ? '바꾸는 중…' : '검토 필요로 되돌리기'}
        </BigButton>
      )}
    </section>
  )
}

/**
 * AI 추천 액션 칩. (Manyfast F-SNBVHR action · display — RFC #62 방향 A)
 *
 * 탭하면 해당 칸을 칩의 문구로 **채운다.** 직접 입력을 지우는 것이 아니라, 지금까지 쓴 내용을
 * 대신할 출발점을 주는 것이고 탭한 뒤에도 textarea 에서 바로 고칠 수 있다. 추천할 내용이 없으면
 * 영역 자체를 그리지 않는다 — 빈 칩 줄은 "AI 가 아무것도 못 찾았다"는 신호를 주지 못한다.
 */
function SuggestedActionChips({
  texts,
  onSelect,
}: {
  texts: string[]
  onSelect: (text: string) => void
}) {
  if (texts.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {texts.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect(text)}
          className="min-h-12 rounded-full border-2 border-primary bg-primary-soft px-4 py-2 text-lg font-semibold text-primary hover:brightness-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** 담당 직종 단일 선택 칩. 짧은 고정 목록이라 세로 스택 대신 가로 알약형으로 배치한다(DESIGN.md §8.4·§2.1). */
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

/**
 * 대상 어르신 지정. (Manyfast F-SNBVHR exceptions)
 *
 * AI 가 가리지 못한 카드를 확정하는 **유일한 경로**다. 어르신 없이 검토 완료가 되면 그 카드로 만든
 * 문구가 누구의 기록인지 말할 수 없으므로, 서버도 어르신 없는 카드는 검토 완료로 올리지 않는다.
 *
 * 어르신이 늘어도 화면 자체 길이는 늘지 않도록 `HandoverCreatePage`의 `RecipientSection`과 같은
 * 패턴(선택 상태 배너 · 이름/식별번호 검색 · 목록 내부 스크롤)을 쓴다. (#143)
 */
function RecipientPicker({
  selected,
  recipients,
  loading,
  failed,
  onRetry,
  onSelect,
}: {
  selected: number | null
  recipients: CareRecipient[]
  loading: boolean
  failed: boolean
  onRetry: () => void
  onSelect: (careRecipientId: number | null) => void
}) {
  const [keyword, setKeyword] = useState('')
  const shown = useMemo(() => {
    const trimmed = keyword.trim()
    if (trimmed === '') {
      return recipients
    }
    return recipients.filter(
      (recipient) => recipient.name.includes(trimmed) || recipient.code.includes(trimmed),
    )
  }, [keyword, recipients])
  const selectedRecipient = recipients.find((recipient) => recipient.id === selected) ?? null

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-2xl font-bold text-ink">대상 어르신</legend>

      {selectedRecipient !== null && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-primary bg-primary-soft px-5 py-4">
          <span className="flex items-center gap-2 text-xl font-semibold text-ink">
            <Check className="size-6 shrink-0 text-primary" aria-hidden="true" />
            선택됨: {selectedRecipient.name} 어르신
            <span className="text-lg font-normal text-ink-muted">{selectedRecipient.code}</span>
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 text-lg font-semibold text-ink-muted underline hover:text-ink"
          >
            선택 해제
          </button>
        </div>
      )}

      <label htmlFor="cardRecipientKeyword" className="text-xl text-ink-muted">
        이름이나 식별번호로 찾기
      </label>
      <input
        id="cardRecipientKeyword"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        className="w-full rounded-2xl border-2 border-border-card px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />

      {loading && <p className="text-xl text-ink-muted">어르신 목록을 불러오는 중입니다…</p>}
      {failed && (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4">
          <p className="text-xl text-amber-900">어르신 목록을 불러오지 못했습니다.</p>
          <BigButton tone="plain" onClick={onRetry}>
            목록 다시 불러오기
          </BigButton>
        </div>
      )}
      {!loading && !failed && shown.length === 0 && (
        <p className="text-xl text-ink-muted">찾으시는 어르신이 목록에 없습니다.</p>
      )}

      <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
        {shown.map((recipient) => (
          <li key={recipient.id}>
            <BigButton
              tone="plain"
              selected={selected === recipient.id}
              onClick={() => onSelect(recipient.id)}
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span>{recipient.name}</span>
                <span className="text-lg font-normal text-ink-muted">{recipient.code}</span>
              </span>
            </BigButton>
          </li>
        ))}
      </ul>

      <BigButton tone="plain" selected={selected === null} onClick={() => onSelect(null)}>
        아직 가리지 못했습니다
      </BigButton>
    </fieldset>
  )
}
