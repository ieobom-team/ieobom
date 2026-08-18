import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, NETWORK_UNAVAILABLE, type ApiFieldError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import { PageLayout } from '../../shared/ui/PageLayout'
import {
  structureHandover,
  type HandoverCardStructureResult,
} from '../handover-card/handoverCardApi'
import { HANDOVER_CARDS_KEY } from '../handover-card/useHandoverCards'
import type { CareRecipient } from '../recipient/recipientApi'
import { useActiveRecipients } from '../recipient/useRecipients'
import { useSession } from '../session/sessionContext'
import { createHandover } from './handoverApi'
import { INFO_SOURCES, infoSourceLabel, type InfoSource } from './infoSource'
import { CHECK_ITEMS } from './checkItems'
import { findInputMethod, INPUT_METHODS, type InputMethod } from './inputMethod'
import { enqueue, OFFLINE_QUEUE_KEY } from './offlineQueue'
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
 * 유저플로우 "새 플로우 3" n7~n16 — 현장 특이사항 입력.
 *
 *   n7 입력 화면 → n8 대리 입력 여부? → n9 정보 출처 → n11 입력 방식? → n12 음성 입력 / n13 텍스트 입력
 *   → n15 어르신·입력 시점 선택 → n16 저장 성공?
 *
 * 유저플로우 "새 플로우 3"는 n7 · n9 · n13 을 각각 page 노드로 그렸지만 **라우트는 하나**로 두고 단계만 넘긴다.
 * 큰 버튼 기준으로 주소를 다섯 개로 쪼개면 뒤로가기가 단계마다 걸려 한 손 입력이 되지 않는다.
 *
 * 텍스트(#6)·음성(#8)·체크(#7) 방식을 만들었다. 저장 중 연결이 끊기면 대기열에 넣고
 * 연결이 회복되면 자동으로 다시 보낸다(n17, #9) — `offlineQueue.ts` · `OfflineQueueSync.tsx`.
 *
 * 저장이 끝나면 이어서 구조화를 부른다(#11). 저장 안에서 하지 않는 이유는
 * `docs/contracts/handover-card-schema.md` 에 있다. 구조화가 실패해도 **저장은 이미 끝나 있고**,
 * 그 사실이 안내에서 흐려지면 안 된다.
 */

type Step = 'proxy' | 'source' | 'method' | 'text' | 'voice' | 'check' | 'target' | 'done' | 'queued'

export function HandoverCreatePage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const reporterName = session?.staff.name ?? ''

  const [step, setStep] = useState<Step>('proxy')
  const [draft, setDraft] = useState<HandoverDraft>(() => emptyDraft(new Date()))
  const [errors, setErrors] = useState<ApiFieldError[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string>('')
  /** 연결이 끊겨 대기열에 넣으면서 원본 음성을 빼야 했는지. */
  const [queuedAudioDropped, setQueuedAudioDropped] = useState(false)
  /**
   * 임시 저장 안내 카드에 보여줄 값. 서버가 안 닿아 응답이 없으므로 화면이 들고 있던
   * `draft`·`recipients`에서 그대로 뽑는다 — 새 API를 부르지 않는다.
   */
  const [queuedInfo, setQueuedInfo] = useState<{
    occurredAt: string
    careRecipientName: string
    inputMethod: InputMethod
  } | null>(null)

  // 새 입력의 대상 목록이므로 이용 종료한 어르신은 빠진다. (Manyfast F-LUDCWW rules)
  const recipients = useActiveRecipients()
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
      // 연결이 끊긴 것뿐이면 실패로 끝내지 않는다. 대기열에 넣고 회복되면 자동으로 다시 보낸다.
      // (Manyfast F-YJJJUX exceptions — 재입력을 요구하지 않는다)
      if (error.code === NETWORK_UNAVAILABLE) {
        // 대기열은 기기 저장소(localStorage)에 남는다. 원본 음성까지 넣으면 한 건이 저장
        // 한도를 채워 **대기열 전체가 조용히 저장되지 않는다**(offlineQueue.ts 의 writeRaw).
        // 그래서 음성은 빼고 텍스트만 다시 보낸다. 뺐다는 사실은 화면에 그대로 알린다.
        const { audioData, ...queued } = toCreateRequest(draft, reporterName)
        enqueue(queued)
        queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_KEY })
        setErrors([])
        setNotice(null)
        setQueuedAudioDropped(audioData !== undefined)
        setQueuedInfo({
          occurredAt: draft.occurredAt,
          careRecipientName:
            recipients.data?.find((r) => r.id === draft.careRecipientId)?.name ?? '대상 어르신',
          inputMethod: draft.inputMethod ?? 'TEXT',
        })
        setStep('queued')
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
    setQueuedInfo(null)
    structure.reset()
    setStep('proxy')
  }

  if (step === 'done') {
    return (
      <SavedNotice
        careRecipientName={savedName}
        occurredAt={draft.occurredAt}
        reporterName={reporterName}
        organizing={structure.isPending}
        organized={structure.data ?? null}
        organizeFailed={structure.isError}
        onAnother={startAnother}
      />
    )
  }

  if (step === 'queued' && queuedInfo !== null) {
    return (
      <QueuedNotice
        audioDropped={queuedAudioDropped}
        occurredAt={queuedInfo.occurredAt}
        careRecipientName={queuedInfo.careRecipientName}
        inputMethod={queuedInfo.inputMethod}
        onAnother={startAnother}
      />
    )
  }

  return (
    <PageLayout
      title="특이사항 남기기"
      showBack={true}
      onBack={goBack}
      backLabel="이전"
    >
      <header>
        <p className="text-xl text-ink-muted">
          입력자 <span className="font-semibold text-ink">{reporterName}</span>
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
          draft={draft}
          onChange={update}
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
    </PageLayout>
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
      className="rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900"
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
      <h2 id="proxy-heading" className="text-2xl font-bold text-ink">
        어떻게 아신 내용인가요?
      </h2>
      <BigButton tone="plain" onClick={() => onPick(false)}>
        <span className="block">제가 직접 봤어요</span>
        <span className="mt-1 block text-lg font-normal text-ink-muted">직접 관찰한 내용입니다</span>
      </BigButton>
      <BigButton tone="plain" onClick={() => onPick(true)}>
        <span className="block">다른 분께 들었어요</span>
        <span className="mt-1 block text-lg font-normal text-ink-muted">
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
      <h2 id="source-heading" className="text-2xl font-bold text-ink">
        어느 분께 들으셨나요?
      </h2>
      <p className="text-xl text-ink-muted">
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
      <h2 id="method-heading" className="text-2xl font-bold text-ink">
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
            className="w-full min-h-20 cursor-not-allowed rounded-lg border-2 border-dashed border-border-card bg-surface-card px-6 py-5 text-left text-2xl font-semibold text-ink-tertiary"
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
      <h2 id="text-heading" className="text-2xl font-bold text-ink">
        무슨 일이 있었나요?
      </h2>
      <label htmlFor="rawText" className="text-xl text-ink-muted">
        보신 그대로 짧게 남겨 주세요. 다듬지 않아도 됩니다.
      </label>
      <textarea
        id="rawText"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        maxLength={RAW_TEXT_MAX_LENGTH}
        className="w-full rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />
      <p className="text-lg text-ink-muted">
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
  draft,
  onChange,
  onNext,
}: {
  draft: HandoverDraft
  onChange: (patch: Partial<HandoverDraft>) => void
  onNext: () => void
}) {
  const [listening, setListening] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  /** 녹음을 마무리하는 중. 이때 화면을 넘기면 방금 말한 음성이 draft 에 닿기 전에 저장된다. */
  const [finishing, setFinishing] = useState(false)
  const recognizerRef = useRef<SpeechRecognizer | null>(null)
  /** 마무리를 기다렸다가 다음 화면으로 넘어가야 하는지. */
  const goingNextRef = useRef(false)
  /**
   * 인식기는 마이크를 누른 시점의 `onNext` 를 붙들고 있다. 그 시점의 `onNext` 는 아직 빈
   * 원문을 보고 있어서 그대로 부르면 "입력 내용을 남겨 주세요"에 막힌다. 지금 것을 부른다.
   */
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext

  useEffect(() => {
    return () => {
      goingNextRef.current = false
      recognizerRef.current?.stop()
    }
  }, [])

  /** 인식·녹음이 모두 끝났을 때. 음성을 얻었으면 draft 에 붙인다. */
  const handleEnd = (audioBase64: string | null) => {
    setListening(false)
    setFinishing(false)
    if (audioBase64 !== null) {
      onChange({ audioData: audioBase64 })
    }
    if (goingNextRef.current) {
      goingNextRef.current = false
      onNextRef.current()
    }
  }

  const toggleListening = () => {
    if (listening) {
      setFinishing(true)
      recognizerRef.current?.stop()
      return
    }
    const recognizer = createSpeechRecognizer(
      (transcript) => onChange({ rawText: transcript }),
      handleEnd,
      (message) => {
        setNotice(message)
      },
    )
    recognizerRef.current = recognizer
    // 새로 말하면 앞서 녹음한 음성은 더 이상 지금 글의 원본이 아니다.
    onChange({ audioData: undefined })
    recognizer?.start()
    setListening(true)
    setNotice(null)
  }

  /**
   * 듣는 중에 눌렀으면 먼저 멈추고, 음성이 draft 에 닿은 뒤에 넘어간다.
   *
   * 녹음을 Data URL 로 바꾸는 일이 비동기라, 그냥 넘어가면 다음 화면에서 저장을 눌렀을 때
   * 음성만 빠진 채 저장될 수 있다.
   */
  const handleNext = () => {
    if (listening || finishing) {
      goingNextRef.current = true
      setFinishing(true)
      recognizerRef.current?.stop()
      return
    }
    onNext()
  }

  return (
    <section aria-labelledby="voice-heading" className="flex flex-col gap-5">
      <h2 id="voice-heading" className="text-2xl font-bold text-ink">
        말씀해 주세요
      </h2>
      <p className="text-xl text-ink-muted">
        마이크를 누르고 말씀하시면 아래에 글로 남습니다. 다시 누르면 멈춥니다.
      </p>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-border-card bg-surface-card px-5 py-8">
        <button
          type="button"
          onClick={toggleListening}
          aria-label={listening ? '듣고 있어요 · 눌러서 멈추기' : '눌러서 말하기'}
          className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl text-white transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
            listening ? 'animate-pulse bg-primary' : 'bg-surface-dark hover:brightness-110'
          }`}
        >
          🎙️
        </button>
        <p className="text-xl font-semibold text-ink">
          {listening ? '듣고 있어요 · 눌러서 멈추기' : '눌러서 말하기'}
        </p>
      </div>

      {!listening && !finishing && draft.audioData !== undefined && (
        <p role="status" className="text-xl text-ink-muted">
          말씀하신 원본 음성도 함께 저장됩니다. 카드에서 다시 들으실 수 있습니다.
        </p>
      )}

      {notice !== null && (
        <p className="rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
          {notice}
        </p>
      )}

      <label htmlFor="voiceText" className="text-xl text-ink-muted">
        인식된 내용입니다. 다르면 고쳐 주세요.
      </label>
      <textarea
        id="voiceText"
        value={draft.rawText}
        onChange={(event) => onChange({ rawText: event.target.value })}
        rows={6}
        maxLength={RAW_TEXT_MAX_LENGTH}
        className="w-full rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />
      <p className="text-lg text-ink-muted">
        {draft.rawText.length} / {RAW_TEXT_MAX_LENGTH}자
      </p>
      <BigButton onClick={handleNext}>{finishing ? '음성 저장 중…' : '다음'}</BigButton>
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
      <h2 id="target-heading" className="text-2xl font-bold text-ink">
        어느 어르신이신가요?
      </h2>

      {draft.proxyInput && draft.infoSource !== null && (
        <p className="text-xl text-ink-muted">
          정보 출처{' '}
          <span className="font-semibold text-ink">{infoSourceLabel(draft.infoSource)}</span>
        </p>
      )}

      <label htmlFor="recipientKeyword" className="text-xl text-ink-muted">
        이름이나 식별번호로 찾기
      </label>
      <input
        id="recipientKeyword"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        className="w-full rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />

      {loading && <p className="text-xl text-ink-muted">어르신 목록을 불러오는 중입니다…</p>}
      {loadFailed && (
        <div className="flex flex-col gap-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-4">
          <p className="text-xl text-amber-900">어르신 목록을 불러오지 못했습니다.</p>
          <BigButton tone="plain" onClick={onRetryLoad}>
            목록 다시 불러오기
          </BigButton>
        </div>
      )}
      {!loading && !loadFailed && shown.length === 0 && (
        <p className="text-xl text-ink-muted">찾으시는 어르신이 목록에 없습니다.</p>
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
                <span className="text-lg font-normal text-ink-muted">{recipient.code}</span>
              </span>
            </BigButton>
          </li>
        ))}
      </ul>

      <label htmlFor="occurredAt" className="text-2xl font-bold text-ink">
        언제 있었던 일인가요?
      </label>
      <p className="text-xl text-ink-muted">지금 시각이 채워져 있습니다. 다르면 고쳐 주세요.</p>
      <input
        id="occurredAt"
        type="datetime-local"
        value={draft.occurredAt}
        onChange={(event) => onChange({ occurredAt: event.target.value })}
        className="w-full rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
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
  occurredAt,
  reporterName,
  organizing,
  organized,
  organizeFailed,
  onAnother,
}: {
  careRecipientName: string
  occurredAt: string
  reporterName: string
  organizing: boolean
  organized: HandoverCardStructureResult | null
  organizeFailed: boolean
  onAnother: () => void
}) {
  const navigate = useNavigate()

  return (
    <PageLayout title="제출 완료">
      <section role="status" className="rounded-lg border-2 border-primary bg-primary-soft px-5 py-6">
        <h1 className="text-3xl font-bold text-ink">제출 완료</h1>
        <p className="mt-3 text-2xl text-ink">
          {careRecipientName} 어르신 특이사항이 저장되었습니다.
        </p>

        <dl className="mt-4 flex flex-col gap-1 text-xl text-ink-muted">
          <div className="flex gap-2">
            <dt className="font-semibold text-ink">입력 시간</dt>
            <dd>{formatOccurredAt(occurredAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-ink">입력자</dt>
            <dd>{reporterName}</dd>
          </div>
        </dl>

        {organizing && <p className="mt-3 text-xl text-ink-muted">인계 카드로 정리하는 중입니다…</p>}

        {organized !== null && (
          <>
            <p className="mt-3 text-xl text-ink-muted">
              인계 카드 {organized.createdCount}건으로 정리했습니다.
            </p>
            {/* 근거가 없어 빠진 항목이 있다는 사실을 감추지 않는다. 정상 동작의 결과다. */}
            {organized.discardedCount > 0 && (
              <p className="mt-1 text-lg text-ink-muted">
                남긴 글에서 근거를 찾지 못한 {organized.discardedCount}건은 카드로 만들지
                않았습니다.
              </p>
            )}
          </>
        )}

        {organizeFailed && (
          <p className="mt-3 text-xl text-ink-muted">
            지금은 자동 정리가 되지 않았습니다. 남기신 내용은 저장돼 있으니 다시 쓰지 않으셔도
            됩니다.
          </p>
        )}
      </section>

      {/* 좌 보조(회색) / 우 주요(오렌지) — DESIGN.md §8.5 */}
      <div className="grid grid-cols-2 gap-4">
        <BigButton tone="plain" onClick={onAnother}>
          하나 더 남기기
        </BigButton>
        {/* replace: true — 뒤로가기를 누르면 방금 제출을 끝낸 이 "제출 완료" 화면이 아니라
            남기러 들어오기 전 화면으로 곧장 가야 한다. (#134) */}
        <BigButton onClick={() => navigate('/field', { replace: true })}>확인</BigButton>
      </div>
    </PageLayout>
  )
}

/** `HandoverDraft.occurredAt`(`datetime-local` 값)에서 시:분만 뽑는다. */
function formatOccurredAt(occurredAt: string): string {
  const [, time] = occurredAt.split('T')
  return time ?? occurredAt
}

/**
 * n17 — 저장 실패가 아니라 임시 저장 안내다. (Manyfast F-YJJJUX exceptions)
 *
 * **재입력을 요구하지 않는다.** 그래서 "다시 시도" 버튼을 두지 않는다 — 이미 대기열에
 * 들어갔고, 연결이 회복되면 `OfflineQueueSync`가 알아서 다시 보낸다. 여기서 할 일은
 * 그 사실을 안심시키고 다음으로 넘어가게 하는 것뿐이다.
 */
function QueuedNotice({
  audioDropped,
  occurredAt,
  careRecipientName,
  inputMethod,
  onAnother,
}: {
  audioDropped: boolean
  occurredAt: string
  careRecipientName: string
  inputMethod: InputMethod
  onAnother: () => void
}) {
  const navigate = useNavigate()

  return (
    <PageLayout title="임시 저장">
      <section role="status" className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border-card bg-white px-5 py-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
          <Check size={40} strokeWidth={3} className="text-primary" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-bold text-ink">임시 저장 완료</h1>
        <p className="text-xl text-ink-muted">입력하신 특이사항이 안전하게 저장되었습니다</p>
      </section>

      <dl className="flex flex-col gap-3 rounded-2xl border-2 border-border-card bg-white px-5 py-5">
        <div className="flex items-center justify-between gap-3 text-xl">
          <dt className="font-semibold text-ink-muted">저장 시간</dt>
          <dd className="text-ink">{formatOccurredAt(occurredAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-xl">
          <dt className="font-semibold text-ink-muted">어르신</dt>
          <dd className="text-ink">{careRecipientName} 어르신</dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-xl">
          <dt className="font-semibold text-ink-muted">입력 방식</dt>
          <dd className="text-ink">{findInputMethod(inputMethod).label}</dd>
        </div>
      </dl>

      <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4">
        <p className="text-xl text-amber-900">
          지금은 연결이 안 돼 보내지 못했지만, 입력하신 내용은 안전하게 남아 있습니다. 연결이
          회복되면 자동으로 다시 보내 드립니다. 다시 입력하지 않으셔도 됩니다.
        </p>
        {audioDropped && (
          <p className="mt-2 text-xl text-amber-900">
            다만 녹음한 원본 음성은 함께 보관하지 못했습니다. 인식된 글은 그대로 보내집니다.
          </p>
        )}
      </section>

      {/* 좌 보조(회색) / 우 주요(오렌지) — #90 SavedNotice와 같은 구성(DESIGN.md §8.5) */}
      <div className="grid grid-cols-2 gap-4">
        <BigButton tone="plain" onClick={onAnother}>
          하나 더 남기기
        </BigButton>
        {/* replace: true — 뒤로가기를 누르면 방금 임시 저장을 끝낸 이 화면이 아니라
            남기러 들어오기 전 화면으로 곧장 가야 한다. (#134) */}
        <BigButton onClick={() => navigate('/field', { replace: true })}>현장 홈으로</BigButton>
      </div>
    </PageLayout>
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
      <h2 id="check-heading" className="text-2xl font-bold text-ink">
        해당하는 항목을 골라 주세요
      </h2>
      <p className="text-xl text-ink-muted">여러 개를 고를 수 있습니다.</p>
      <ul className="flex flex-col gap-3">
        {CHECK_ITEMS.map((item) => (
          <li key={item.value}>
            <label className="flex min-h-16 cursor-pointer items-center gap-4 rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl font-semibold text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input
                type="checkbox"
                checked={checkedItems.includes(item.value)}
                onChange={() => toggle(item.value)}
                className="h-6 w-6 accent-primary"
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
