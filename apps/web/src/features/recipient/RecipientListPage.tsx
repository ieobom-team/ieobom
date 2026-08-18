import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '../../shared/api/client'
import { PageLayout } from '../../shared/ui/PageLayout'
import {
  activeFirst,
  duplicateNotice,
  duplicatesOf,
  normalizeName,
  recipientLabel,
} from './recipientForm'
import {
  createCareRecipient,
  dischargeCareRecipient,
  DUPLICATE_RECIPIENT_NAME,
  renameCareRecipient,
  type CareRecipient,
} from './recipientApi'
import { recipientsKey, useAllRecipients } from './useRecipients'

/**
 * 유저플로우 "AI 인계 도구 내비게이션 맵" n49 · n50 — 어르신 명단 화면과 등록 어르신 목록.
 *
 *   n42 관리자 대시보드 → n58 → n49 명단 화면 → n50 목록
 *   n50 → n51 등록 → n52 동명이인? → (있음) n53 확인 후 저장 → n49
 *   n50 → n54 이름 수정 → n49
 *   n50 → n55 이용 종료 표시 → n49
 *
 * 여기서 만드는 것은 **가명처리의 대조표**다. 등록되는 것은 어르신(데이터)이지 근무자(계정)가
 * 아니므로 로그인·비밀번호를 요구하지 않는다. (Manyfast F-LUDCWW permissions)
 *
 * 화면 제목은 `AppHeader` 2행에서 이미 노출되므로 본문에 따로 `<h1>`을 두지 않는다. (#88 코멘트)
 */
export function RecipientListPage() {
  const recipients = useAllRecipients()
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = filterRecipients(recipients.data ?? [], query)

  return (
    <PageLayout
      title="어르신 명단"
      showBottomNav
      backTo="/admin"
      backLabel="관리자 홈"
      maxWidth="4xl"
    >
      <header className="flex flex-col gap-2">
        <p className="text-lg text-ink-muted">
          여기에 등록한 어르신만 현장 입력에서 고를 수 있습니다. 이름과 내부 ID를 함께 보여 줍니다.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="recipient-search" className="sr-only">
          이름 또는 ID 검색
        </label>
        <input
          id="recipient-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 ID 검색"
          className="min-h-14 flex-1 rounded-md border border-border-card bg-white px-4 text-xl text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowRegisterModal(true)}
          className="min-h-14 rounded-md bg-primary px-6 text-xl font-semibold text-white hover:brightness-95"
        >
          + 어르신 추가
        </button>
      </div>

      {recipients.isPending && <p className="text-xl text-ink-muted">명단을 불러오는 중입니다.</p>}
      {recipients.isError && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-xl text-ink">명단을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => void recipients.refetch()}
            className="rounded-md border border-border-card bg-white px-5 py-3 text-xl font-semibold text-ink"
          >
            다시 시도
          </button>
        </div>
      )}

      {recipients.isSuccess && recipients.data.length === 0 && (
        <p className="text-xl text-ink-muted">아직 등록된 어르신이 없습니다.</p>
      )}

      {recipients.isSuccess && recipients.data.length > 0 && filtered.length === 0 && (
        <p className="text-xl text-ink-muted">검색 결과가 없습니다.</p>
      )}

      {recipients.isSuccess && filtered.length > 0 && (
        <ul className="flex flex-col gap-3">
          {activeFirst(filtered).map((recipient) => (
            <li key={recipient.id}>
              <RecipientRow recipient={recipient} />
            </li>
          ))}
        </ul>
      )}

      {recipients.isSuccess && (
        <p className="text-lg text-ink-muted">총 {recipients.data.length}명 등록됨</p>
      )}

      {showRegisterModal && (
        <RecipientRegisterModal
          recipients={recipients.data ?? []}
          onClose={() => setShowRegisterModal(false)}
        />
      )}
    </PageLayout>
  )
}

/** 검색창의 키워드로 이름·내부 ID 를 클라이언트에서 실시간 필터링한다. (서버 검색 없음, Issue #102) */
function filterRecipients(recipients: readonly CareRecipient[], query: string): CareRecipient[] {
  const keyword = query.trim().toLowerCase()
  if (keyword === '') {
    return [...recipients]
  }
  return recipients.filter(
    (recipient) =>
      recipient.name.toLowerCase().includes(keyword) ||
      recipient.code.toLowerCase().includes(keyword),
  )
}

/** 목록을 다시 받아 온다. 이용 중 목록과 전체 목록을 함께 비운다 — 등록·종료가 양쪽을 다 바꾼다. */
function useRecipientListRefresh() {
  const queryClient = useQueryClient()

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: recipientsKey(true) }),
      queryClient.invalidateQueries({ queryKey: recipientsKey(false) }),
    ])
  }
}

/**
 * n51 → n52 → n53 — 어르신 등록과 동명이인 확인. "+ 어르신 추가" 로 여는 모달.
 *
 * 동명이인이 있어도 **저장을 막지 않는다.** 막으면 관리자가 "김말순2" 같은 가짜 이름을 만들어
 * 넣게 되고, 그 이름이 그대로 기록에 남는다. 대신 한 번 확인시키고 서로 다른 내부 ID로 구분한다.
 * (Manyfast F-LUDCWW exceptions)
 */
function RecipientRegisterModal({
  recipients,
  onClose,
}: {
  recipients: readonly CareRecipient[]
  onClose: () => void
}) {
  const refresh = useRecipientListRefresh()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<CareRecipient[]>([])
  const [saving, setSaving] = useState(false)

  const 확인_대기 = notice !== null

  async function save(confirmDuplicateName: boolean) {
    const normalized = normalizeName(name)
    if (normalized.error !== null) {
      setError(normalized.error)
      setNotice(null)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createCareRecipient(normalized.name, confirmDuplicateName)
      setName('')
      setNotice(null)
      await refresh()
      onClose()
    } catch (caught) {
      // 409 는 저장 실패가 아니라 확인 요청이다. 같은 이름 그대로 한 번 더 누르면 저장된다.
      if (caught instanceof ApiError && caught.code === DUPLICATE_RECIPIENT_NAME) {
        const found = duplicatesOf(normalized.name, recipients)
        setDuplicates(found)
        setNotice(duplicateNotice(found))
      } else {
        setError(
          caught instanceof ApiError ? caught.message : '등록하지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipient-register-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-surface-modal p-6 shadow-2xl">
        <h2 id="recipient-register-title" className="text-2xl font-bold text-ink">
          {확인_대기 ? '동명이인이 있어요' : '어르신 등록'}
        </h2>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save(확인_대기)
          }}
        >
          {확인_대기 ? (
            <>
              <p className="text-lg text-ink-muted">
                &apos;{normalizeName(name).name}&apos; 이름으로 이미 등록된 어르신이 있습니다. 다른
                분이 맞는지 확인해주세요.
              </p>
              <div className="flex flex-col gap-2">
                {duplicates.map((duplicate) => (
                  <div
                    key={duplicate.id}
                    className="rounded-md border border-border-card bg-surface-card px-4 py-3"
                  >
                    <p className="text-lg font-semibold text-ink">
                      {duplicate.name}{' '}
                      <span className="font-normal text-ink-muted">({duplicate.code})</span>
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="recipient-name" className="block text-xl font-semibold text-ink">
                  어르신 이름
                </label>
                <input
                  id="recipient-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError(null)
                  }}
                  placeholder="이름을 입력해 주세요"
                  className="mt-1.5 min-h-14 w-full rounded-md border border-border-card px-4 text-xl text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="recipient-code-preview" className="block text-xl font-semibold text-ink">
                  이용자 ID
                </label>
                <input
                  id="recipient-code-preview"
                  disabled
                  value="자동으로 생성됩니다 (예: E-007)"
                  className="mt-1.5 min-h-14 w-full rounded-md border border-border-card bg-btn-neutral px-4 text-xl text-ink-tertiary"
                />
              </div>
            </div>
          )}

          {error !== null && (
            <p role="alert" className="text-lg text-amber-900">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-14 rounded-md bg-btn-neutral px-6 text-xl font-semibold text-ink"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-14 rounded-md bg-primary px-6 text-xl font-semibold text-white disabled:bg-ink-tertiary"
            >
              {확인_대기 ? '계속 등록' : '등록 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** n50 의 한 줄. 이름 옆에 내부 ID를 붙여, 동명이인을 눈으로 구분할 수 있게 한다. */
function RecipientRow({ recipient }: { recipient: CareRecipient }) {
  const refresh = useRecipientListRefresh()
  const [editing, setEditing] = useState(false)
  const [confirmingDischarge, setConfirmingDischarge] = useState(false)
  const discharged = recipient.dischargedAt !== null

  async function discharge() {
    await dischargeCareRecipient(recipient.id)
    setConfirmingDischarge(false)
    await refresh()
  }

  if (editing) {
    return (
      <RecipientRenameForm
        recipient={recipient}
        onDone={async () => {
          setEditing(false)
          await refresh()
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-card bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-semibold text-ink">{recipientLabel(recipient)}</span>
        {discharged && (
          <span className="rounded-full bg-btn-neutral px-3 py-1 text-lg font-semibold text-ink-muted">
            이용 종료
          </span>
        )}
      </div>

      {confirmingDischarge ? (
        <div className="flex flex-col items-end gap-2">
          <p role="alert" className="text-lg text-ink-muted">
            새 입력의 대상 목록에서 빠집니다. 기존 기록은 그대로 남습니다.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void discharge()}
              className="min-h-14 rounded-md bg-surface-dark px-5 text-xl font-semibold text-white"
            >
              이용 종료로 표시
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDischarge(false)}
              className="min-h-14 rounded-md bg-btn-neutral px-5 text-xl font-semibold text-ink"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-14 rounded-md border border-border-card px-5 text-xl font-semibold text-ink"
          >
            이름 수정
          </button>
          {!discharged && (
            <button
              type="button"
              onClick={() => setConfirmingDischarge(true)}
              className="min-h-14 rounded-md border border-border-card px-5 text-xl font-semibold text-ink"
            >
              이용 종료
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** n54 — 이름 수정. 내부 ID는 바꾸지 않는다. 기존 인계 기록이 그 값으로 어르신을 가리킨다. */
function RecipientRenameForm({
  recipient,
  onDone,
  onCancel,
}: {
  recipient: CareRecipient
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(recipient.name)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const normalized = normalizeName(name)
    if (normalized.error !== null) {
      setError(normalized.error)
      return
    }

    try {
      await renameCareRecipient(recipient.id, normalized.name)
      await onDone()
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : '수정하지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
      )
    }
  }

  return (
    <form
      className="flex flex-wrap items-center gap-3 rounded-md border border-primary bg-white px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label htmlFor={`rename-${recipient.id}`} className="text-xl font-semibold text-ink">
        {recipient.code}
      </label>
      <input
        id={`rename-${recipient.id}`}
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setError(null)
        }}
        className="min-h-14 flex-1 rounded-md border border-border-card px-4 text-xl text-ink"
      />
      <button
        type="submit"
        className="min-h-14 rounded-md bg-primary px-5 text-xl font-semibold text-white"
      >
        저장
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-14 rounded-md bg-btn-neutral px-5 text-xl font-semibold text-ink"
      >
        취소
      </button>
      {error !== null && (
        <p role="alert" className="w-full text-xl text-amber-900">
          {error}
        </p>
      )}
    </form>
  )
}
