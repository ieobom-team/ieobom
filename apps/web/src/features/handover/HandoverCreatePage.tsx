import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, type ApiFieldError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import {
  structureHandover,
  type HandoverCardStructureResult,
} from '../handover-card/handoverCardApi'
import { HANDOVER_CARDS_KEY } from '../handover-card/useHandoverCards'
import { useSession } from '../session/sessionContext'
import { createHandover, fetchCareRecipients, type CareRecipient } from './handoverApi'
import { INFO_SOURCES, infoSourceLabel, type InfoSource } from './infoSource'
import { CHECK_ITEMS } from './checkItems'
import { INPUT_METHODS, type InputMethod } from './inputMethod'
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  type SpeechRecognizer,
} from './speechRecognition'
import {
  emptyDraft,
  fieldLabel,
  RAW_TEXT_MAX_LENGTH,
  toCreateRequest,
  validateDraft,
  type HandoverDraft,
} from './handoverForm'

/**
 * 유저플로우 n7~n16 — 현장 특이사항 입력.
 *
 *   n7 입력 화면 → n8 대리 입력 여부? → n9 정보 출처 → n11 입력 방식? → n12 음성 입력 / n13 텍스트 입력
 *   → n15 어르신·입력 시점 선택 → n16 저장 성공?
 *
 * 유저플로우는 n7 · n9 · n13 을 각각 page 노드로 그렸지만 **라우트는 하나**로 두고 단계만 넘긴다.
 * 큰 버튼 기준으로 주소를 다섯 개로 쪼개면 뒤로가기가 단계마다 걸려 한 손 입력이 되지 않는다.
 *
 * 텍스트(#6)·음성(#8)·체크(#7) 방식을 만들었다.
 * 저장 실패 시 임시 저장(n17)은 #9 범위다.
 *
 * 저장이 끝나면 이어서 구조화를 부른다(#11). 저장 안에서 하지 않는 이유는
 * `docs/contracts/handover-card-schema.md` 에 있다. 구조화가 실패해도 **저장은 이미 끝나 있고**,
 * 그 사실이 안내에서 흐려지면 안 된다.
 */

type Step = 'proxy' | 'source' | 'method' | 'text' | 'voice' | 'check' | 'target' | 'done'

export function HandoverCreatePage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const reporterName = session?.staff.name ?? ''

  const [step, setStep] = useState<Step>('proxy')
  const [draft, setDraft] = useState<HandoverDraft>(() => emptyDraft(new Date()))
  const [errors, setErrors] = useState<ApiFieldError[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string>('')

  const recipients = useQuery({ queryKey: ['care-recipients'], queryFn: fetchCareRecipients })
  const queryClient = useQueryClient()

  /** n16 저장 성공 → 인계 카드 정리. 결과는 안내에만 쓰고 입력 흐름을 막지 않는다. */
  const structure = useMutation({
    mutationFn: structureHandover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HANDOVER_CARDS_KEY }),
  })

  const save = useMutation({
    mutationFn: () => createHandover(toCreateRequest(draft, reporterName)),
    onSuccess: (handover) => {
      setSavedName(handover.careRecipientName)
      setErrors([])
      setNotice(null)
      setStep('done')
      structure.mutate(handover.id)
    },
    onError: (error: unknown) => {
      if (!(error instanceof ApiError)) {
        setErrors([])
        setNotice('저장하지 못했습니다. 입력한 내용은 그대로 있으니 다시 눌러 주세요.')
        return
      }
      if (error.fields.length > 0) {
        setErrors([...error.fields])
        setNotice(null)
        return
      }
      setErrors([])
      // 고른 어르신이 목록에서 사라진 경우. 다시 고르게 목록을 새로 받아 온다.
      if (error.code === 'CARE_RECIPIENT_NOT_FOUND') {
        setDraft((current) => ({ ...current, careRecipientId: null }))
        void recipients.refetch()
        setNotice('고르신 어르신을 목록에서 찾지 못했습니다. 목록에서 다시 골라 주세요.')
        return
      }
      setNotice(error.message)
    },
  })

  const update = (patch: Partial<HandoverDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setErrors([])
    setNotice(null)
  }

  const pickProxy = (proxyInput: boolean) => {
    // 직접 관찰로 되돌리면 앞서 고른 출처를 지운다. 남겨 두면 둘 중 어느 쪽이 사실인지 알 수 없다.
    update({ proxyInput, infoSource: proxyInput ? draft.infoSource : null })
    setStep(proxyInput ? 'source' : 'method')
  }

  const pickSource = (infoSource: InfoSource) => {
    update({ infoSource })
    setStep('method')
  }

  const pickMethod = (inputMethod: InputMethod) => {
    // 완료 조건 — 음성 인식 미지원 브라우저에서는 텍스트로 대체 안내한다.
    if (inputMethod === 'VOICE' && !isSpeechRecognitionSupported()) {
      setErrors([])
      setNotice('이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트로 남겨 주세요.')
      return
    }
    update({ inputMethod })
    setStep(inputMethod === 'VOICE' ? 'voice' : inputMethod === 'CHECK' ? 'check' : 'text')
  }

  const goBack = () => {
    setErrors([])
    setNotice(null)
    if (step === 'source' || step === 'proxy') {
      navigate('/field')
      return
    }
    if (step === 'method') {
      setStep(draft.proxyInput ? 'source' : 'proxy')
      return
    }
    if (step === 'text' || step === 'voice' || step === 'check') {
      setStep('method')
      return
    }
    if (step === 'target') {
      setStep(draft.inputMethod === 'VOICE' ? 'voice' : draft.inputMethod === 'CHECK' ? 'check' : 'text')
    }
  }

  const goToTarget = () => {
    if (draft.rawText.trim() === '') {
      setErrors([{ field: 'rawText', reason: '입력 내용을 남겨 주세요.' }])
      return
    }
    setErrors([])
    setStep('target')
  }

  const goToTargetFromCheck = () => {
    if (draft.checkedItems.length === 0) {
      setErrors([{ field: 'rawText', reason: '체크할 항목을 하나 이상 선택해 주세요.' }])
      return
    }
    setErrors([])
    setStep('target')
  }

  const submit = () => {
    const found = validateDraft(draft, reporterName)
    if (found.length > 0) {
      setErrors(found)
      setNotice(null)
      return
    }
    setErrors([])
    setNotice(null)
    save.mutate()
  }

  const startAnother = () => {
    setDraft(emptyDraft(new Date()))
    setErrors([])
    setNotice(null)
    setSavedName('')
    structure.reset()
    setStep('proxy')
  }

  if (step === 'done') {
    return (
      <SavedNotice
        careRecipientName={savedName}
        organizing={structure.isPending}
        organized={structure.data ?? null}
        organizeFailed={structure.isError}
        onAnother={startAnother}
      />
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-7 px-5 py-8">
      <header>
        <button
          type="button"
          onClick={goBack}
          className="rounded-xl px-2 py-2 text-xl font-semibold text-teal-800 underline underline-offset-4"
        >
          이전
        </button>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">특이사항 남기기</h1>
        <p className="mt-2 text-xl text-slate-600">
          입력자 <span className="font-semibold text-slate-900">{reporterName}</span>
        </p>
      </header>

      <Problems errors={errors} notice={notice} />

      {step === 'proxy' && <ProxyStep onPick={pickProxy} />}
      {step === 'source' && <SourceStep picked={draft.infoSource} onPick={pickSource} />}
      {step === 'method' && <MethodStep picked={draft.inputMethod} onPick={pickMethod} />}
      {step === 'text' && (
        <TextStep
          value={draft.rawText}
          onChange={(rawText) => update({ rawText })}
          onNext={goToTarget}
        />
      )}
      {step === 'voice' && (
        <VoiceStep
          value={draft.rawText}
          onChange={(rawText) => update({ rawText })}
          onNext={goToTarget}
        />
      )}
      {step === 'check' && (
        <CheckStep
          checkedItems={draft.checkedItems}
          onChange={(checkedItems) => update({ checkedItems })}
          onNext={goToTargetFromCheck}
        />
      )}
      {step === 'target' && (
        <TargetStep
          draft={draft}
          recipients={recipients.data ?? []}
          loading={recipients.isPending}
          loadFailed={recipients.isError}
          onRetryLoad={() => void recipients.refetch()}
          onChange={update}
          onSubmit={submit}
          saving={save.isPending}
        />
      )}
    </main>
  )
}

/** 보완할 항목을 한 번에 모아 보여 준다. (Manyfast F-YJJJUX exceptions) */
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
                <span className="font-semibold">{fieldLabel(error.field)}</span> — {error.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      {notice !== null && <p className={errors.length > 0 ? 'mt-3' : ''}>{notice}</p>}
    </section>
  )
}

/** n8 — 대리 입력 여부. */
function ProxyStep({ onPick }: { onPick: (proxyInput: boolean) => void }) {
  return (
    <section aria-labelledby="proxy-heading" className="flex flex-col gap-5">
      <h2 id="proxy-heading" className="text-2xl font-bold text-slate-900">
        어떻게 아신 내용인가요?
      </h2>
      <BigButton tone="plain" onClick={() => onPick(false)}>
        <span className="block">제가 직접 봤어요</span>
        <span className="mt-1 block text-lg font-normal text-slate-500">직접 관찰한 내용입니다</span>
      </BigButton>
      <BigButton tone="plain" onClick={() => onPick(true)}>
        <span className="block">다른 분께 들었어요</span>
        <span className="mt-1 block text-lg font-normal text-slate-500">
          대신 남깁니다. 들은 곳을 다음에 고릅니다
        </span>
      </BigButton>
    </section>
  )
}

/** n9 · n10 — 정보 출처. 대리 입력일 때만 지난다. */
function SourceStep({
  picked,
  onPick,
}: {
  picked: InfoSource | null
  onPick: (value: InfoSource) => void
}) {
  return (
    <section aria-labelledby="source-heading" className="flex flex-col gap-5">
      <h2 id="source-heading" className="text-2xl font-bold text-slate-900">
        어느 분께 들으셨나요?
      </h2>
      <p className="text-xl text-slate-600">
        남기는 사람과 들은 곳을 따로 적어 두면 나중에 누구에게 확인해야 할지 알 수 있습니다.
      </p>
      {INFO_SOURCES.map((source) => (
        <BigButton
          key={source.value}
          tone="plain"
          selected={picked === source.value}
          onClick={() => onPick(source.value)}
        >
          {source.label}
        </BigButton>
      ))}
    </section>
  )
}

/** n11 — 입력 방식. 아직 없는 방식도 자리를 지키되 고를 수 없게 둔다. */
function MethodStep({
  picked,
  onPick,
}: {
  picked: InputMethod | null
  onPick: (value: InputMethod) => void
}) {
  return (
    <section aria-labelledby="method-heading" className="flex flex-col gap-5">
      <h2 id="method-heading" className="text-2xl font-bold text-slate-900">
        어떻게 남기시겠어요?
      </h2>
      {INPUT_METHODS.map((method) =>
        method.ready ? (
          <BigButton
            key={method.value}
            selected={picked === method.value}
            onClick={() => onPick(method.value)}
          >
            <span className="block">{method.label}</span>
            <span className="mt-1 block text-lg font-normal opacity-90">{method.summary}</span>
          </BigButton>
        ) : (
          <button
            key={method.value}
            type="button"
            disabled
            className="w-full min-h-20 cursor-not-allowed rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100 px-6 py-5 text-left text-2xl font-semibold text-slate-400"
          >
            <span className="block">{method.label}</span>
            <span className="mt-1 block text-lg font-normal">준비 중입니다 ({method.plannedIn})</span>
          </button>
        ),
      )}
    </section>
  )
}

/** n13 — 텍스트 입력. */
function TextStep({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (value: string) => void
  onNext: () => void
}) {
  return (
    <section aria-labelledby="text-heading" className="flex flex-col gap-5">
      <h2 id="text-heading" className="text-2xl font-bold text-slate-900">
        무슨 일이 있었나요?
      </h2>
      <label htmlFor="rawText" className="text-xl text-slate-600">
        보신 그대로 짧게 남겨 주세요. 다듬지 않아도 됩니다.
      </label>
      <textarea
        id="rawText"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        maxLength={RAW_TEXT_MAX_LENGTH}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />
      <p className="text-lg text-slate-500">
        {value.length} / {RAW_TEXT_MAX_LENGTH}자
      </p>
      <BigButton onClick={onNext}>다음</BigButton>
    </section>
  )
}

/**
 * n12 — 음성 입력. 이 화면에 있는 동안만 듣는다.
 *
 * **상시 녹음 금지**(Manyfast F-YJJJUX rules)를 이 컴포넌트가 직접 지킨다 — 언마운트되면
 * (뒤로가기·다음 스텝 이동 어느 쪽이든) `useEffect` cleanup에서 반드시 `stop()`을 부른다.
 * 지원 여부는 `pickMethod`에서 이미 걸러 이 화면은 지원하는 브라우저에서만 뜬다.
 */
function VoiceStep({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (value: string) => void
  onNext: () => void
}) {
  const [listening, setListening] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const recognizerRef = useRef<SpeechRecognizer | null>(null)

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop()
    }
  }, [])

  const toggleListening = () => {
    if (listening) {
      recognizerRef.current?.stop()
      setListening(false)
      return
    }
    const recognizer = createSpeechRecognizer(
      (transcript) => onChange(transcript),
      () => setListening(false),
      (message) => {
        setNotice(message)
        setListening(false)
      },
    )
    recognizerRef.current = recognizer
    recognizer?.start()
    setListening(true)
    setNotice(null)
  }

  return (
    <section aria-labelledby="voice-heading" className="flex flex-col gap-5">
      <h2 id="voice-heading" className="text-2xl font-bold text-slate-900">
        말씀해 주세요
      </h2>
      <p className="text-xl text-slate-600">
        마이크를 누르고 말씀하시면 아래에 글로 남습니다. 다시 누르면 멈춥니다.
      </p>

      <BigButton tone={listening ? 'primary' : 'plain'} onClick={toggleListening}>
        {listening ? '듣고 있어요 · 눌러서 멈추기' : '눌러서 말하기'}
      </BigButton>

      {notice !== null && (
        <p className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
          {notice}
        </p>
      )}

      <label htmlFor="voiceText" className="text-xl text-slate-600">
        인식된 내용입니다. 다르면 고쳐 주세요.
      </label>
      <textarea
        id="voiceText"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        maxLength={RAW_TEXT_MAX_LENGTH}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />
      <p className="text-lg text-slate-500">
        {value.length} / {RAW_TEXT_MAX_LENGTH}자
      </p>
      <BigButton onClick={onNext}>다음</BigButton>
    </section>
  )
}

/** n15 — 어르신과 입력 시점. 저장은 여기서 한다. */
function TargetStep({
  draft,
  recipients,
  loading,
  loadFailed,
  onRetryLoad,
  onChange,
  onSubmit,
  saving,
}: {
  draft: HandoverDraft
  recipients: CareRecipient[]
  loading: boolean
  loadFailed: boolean
  onRetryLoad: () => void
  onChange: (patch: Partial<HandoverDraft>) => void
  onSubmit: () => void
  saving: boolean
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

  return (
    <section aria-labelledby="target-heading" className="flex flex-col gap-5">
      <h2 id="target-heading" className="text-2xl font-bold text-slate-900">
        어느 어르신이신가요?
      </h2>

      {draft.proxyInput && draft.infoSource !== null && (
        <p className="text-xl text-slate-600">
          정보 출처{' '}
          <span className="font-semibold text-slate-900">{infoSourceLabel(draft.infoSource)}</span>
        </p>
      )}

      <label htmlFor="recipientKeyword" className="text-xl text-slate-600">
        이름이나 식별번호로 찾기
      </label>
      <input
        id="recipientKeyword"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />

      {loading && <p className="text-xl text-slate-600">어르신 목록을 불러오는 중입니다…</p>}
      {loadFailed && (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4">
          <p className="text-xl text-amber-900">어르신 목록을 불러오지 못했습니다.</p>
          <BigButton tone="plain" onClick={onRetryLoad}>
            목록 다시 불러오기
          </BigButton>
        </div>
      )}
      {!loading && !loadFailed && shown.length === 0 && (
        <p className="text-xl text-slate-600">찾으시는 어르신이 목록에 없습니다.</p>
      )}

      <ul className="flex flex-col gap-4">
        {shown.map((recipient) => (
          <li key={recipient.id}>
            <BigButton
              tone="plain"
              selected={draft.careRecipientId === recipient.id}
              onClick={() => onChange({ careRecipientId: recipient.id })}
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span>{recipient.name}</span>
                <span className="text-lg font-normal text-slate-500">{recipient.code}</span>
              </span>
            </BigButton>
          </li>
        ))}
      </ul>

      <label htmlFor="occurredAt" className="text-2xl font-bold text-slate-900">
        언제 있었던 일인가요?
      </label>
      <p className="text-xl text-slate-600">지금 시각이 채워져 있습니다. 다르면 고쳐 주세요.</p>
      <input
        id="occurredAt"
        type="datetime-local"
        value={draft.occurredAt}
        onChange={(event) => onChange({ occurredAt: event.target.value })}
        className="w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-2xl text-slate-900 focus:border-teal-600 focus:outline-none"
      />

      <BigButton onClick={onSubmit}>{saving ? '저장하는 중…' : '저장하기'}</BigButton>
    </section>
  )
}

/**
 * n16 저장 성공 — 정리 단계로 넘어갔음을 알린다.
 *
 * 정리가 어떻게 됐는지는 저장 성공 안내 **아래에** 붙인다. 정리에 실패해도 남긴 내용은
 * 서버에 있고, 돌봄 중인 근무자가 그걸 오해해 같은 내용을 다시 남기게 만들면 안 된다.
 */
function SavedNotice({
  careRecipientName,
  organizing,
  organized,
  organizeFailed,
  onAnother,
}: {
  careRecipientName: string
  organizing: boolean
  organized: HandoverCardStructureResult | null
  organizeFailed: boolean
  onAnother: () => void
}) {
  const navigate = useNavigate()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-5 py-8">
      <section role="status" className="rounded-2xl border-2 border-teal-600 bg-teal-50 px-5 py-6">
        <h1 className="text-3xl font-bold text-teal-900">저장했습니다</h1>
        <p className="mt-3 text-2xl text-teal-900">
          {careRecipientName} 어르신 특이사항으로 남겼습니다.
        </p>

        {organizing && <p className="mt-2 text-xl text-teal-800">인계 카드로 정리하는 중입니다…</p>}

        {organized !== null && (
          <>
            <p className="mt-2 text-xl text-teal-800">
              인계 카드 {organized.createdCount}건으로 정리했습니다.
            </p>
            {/* 근거가 없어 빠진 항목이 있다는 사실을 감추지 않는다. 정상 동작의 결과다. */}
            {organized.discardedCount > 0 && (
              <p className="mt-1 text-lg text-teal-800">
                남긴 글에서 근거를 찾지 못한 {organized.discardedCount}건은 카드로 만들지
                않았습니다.
              </p>
            )}
          </>
        )}

        {organizeFailed && (
          <p className="mt-2 text-xl text-teal-800">
            지금은 자동 정리가 되지 않았습니다. 남기신 내용은 저장돼 있으니 다시 쓰지 않으셔도
            됩니다.
          </p>
        )}
      </section>

      <BigButton onClick={() => navigate('/handover-cards')}>인계 카드 보기</BigButton>
      <BigButton tone="plain" onClick={onAnother}>
        하나 더 남기기
      </BigButton>
      <BigButton tone="plain" onClick={() => navigate('/field')}>
        현장 홈으로
      </BigButton>
    </main>
  )
}

/**
 * n14 — 체크 입력. 항목은 Manyfast 와이어프레임 "체크 입력 화면" 그대로다(`checkItems.ts`).
 * 타이핑도 말하기도 없이 자주 쓰는 항목만 눌러서 남기는, 세 방식 중 가장 저부담 경로다.
 */
function CheckStep({
  checkedItems,
  onChange,
  onNext,
}: {
  checkedItems: readonly string[]
  onChange: (checkedItems: string[]) => void
  onNext: () => void
}) {
  const toggle = (value: string) => {
    onChange(
      checkedItems.includes(value)
        ? checkedItems.filter((item) => item !== value)
        : [...checkedItems, value],
    )
  }

  return (
    <section aria-labelledby="check-heading" className="flex flex-col gap-5">
      <h2 id="check-heading" className="text-2xl font-bold text-slate-900">
        해당하는 항목을 골라 주세요
      </h2>
      <p className="text-xl text-slate-600">여러 개를 고를 수 있습니다.</p>
      <ul className="flex flex-col gap-3">
        {CHECK_ITEMS.map((item) => (
          <li key={item.value}>
            <label className="flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-2xl font-semibold text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50">
              <input
                type="checkbox"
                checked={checkedItems.includes(item.value)}
                onChange={() => toggle(item.value)}
                className="h-6 w-6 accent-teal-700"
              />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
      <BigButton onClick={onNext}>다음</BigButton>
    </section>
  )
}
