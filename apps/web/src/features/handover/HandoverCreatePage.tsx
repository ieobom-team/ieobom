import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
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
import { readLastInputMethod, resolveDefaultInputMethod, writeLastInputMethod } from './lastInputMethod'
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
 * #135(Manyfast `F-YJJJUX` v45 — §2.3 인라인 확장 + §2.4 스마트 기본값, #116 현장 실측 검토)부터는
 * 화면 전환형 단계 대신 **한 화면 안에서** 어르신 → 입력 방식(+내용) → 추가 설정(관찰 구분 ·
 * 정보 출처 · 입력 시점) 순으로 인라인 확장한다. 관찰 구분·입력 방식·입력 시점은 기본값이 채워진
 * 채로 뜨고, 사용자는 필요할 때만 바꾼다.
 *
 * 음성 인식기는 이 컴포넌트(부모)가 쥐고 있다 — 저장 버튼이 "듣는 중이면 멈추고 정리가 끝나면
 * 이어서 저장"을 하려면 녹음기를 손에 쥐고 있어야 한다. **상시 녹음 금지**(Manyfast rules)는
 * 방식이 바뀌거나(`useEffect` — `draft.inputMethod`) 화면을 완전히 벗어날 때(언마운트) 둘 다
 * `stop()`을 부르는 것으로 지킨다.
 *
 * 텍스트(#6)·음성(#8)·체크(#7) 방식을 만들었다. 저장 중 연결이 끊기면 대기열에 넣고
 * 연결이 회복되면 자동으로 다시 보낸다(n17, #9) — `offlineQueue.ts` · `OfflineQueueSync.tsx`.
 *
 * 저장이 끝나면 이어서 구조화를 부른다(#11). 저장 안에서 하지 않는 이유는
 * `docs/contracts/handover-card-schema.md` 에 있다. 구조화가 실패해도 **저장은 이미 끝나 있고**,
 * 그 사실이 안내에서 흐려지면 안 된다.
 */

type Outcome = 'form' | 'done' | 'queued'

/** 이 필드들의 보완 안내가 뜨면 "추가 설정" 아코디언을 강제로 펼친다 — 접힌 채로는 고칠 수 없다. */
const SETTINGS_FIELDS = new Set(['proxyInput', 'infoSource', 'occurredAt'])

function defaultInputMethod(): InputMethod {
  return resolveDefaultInputMethod(readLastInputMethod(), isSpeechRecognitionSupported())
}

export function HandoverCreatePage() {
  const { session } = useSession()
  const reporterName = session?.staff.name ?? ''

  const [outcome, setOutcome] = useState<Outcome>('form')
  const [draft, setDraft] = useState<HandoverDraft>(() => emptyDraft(new Date(), defaultInputMethod()))
  const [errors, setErrors] = useState<ApiFieldError[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /**
   * 음성 인식·녹음 상태. 이 화면(부모)이 직접 들고 있는 이유는, 저장 버튼이 "듣는 중에 저장을
   * 누르면 먼저 멈추고 정리가 끝나면 이어서 저장한다"를 하려면 녹음기를 손에 쥐고 있어야 하기
   * 때문이다 — 예전 단계형 화면의 "다음"이 하던 자동 멈춤·이어가기를 저장 버튼이 이어받는다.
   */
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceFinishing, setVoiceFinishing] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const voiceRecognizerRef = useRef<SpeechRecognizer | null>(null)
  /**
   * 듣는 중에 저장을 눌렀는지. 마이크가 멈추고 정리가 끝나면(effect가 감지) 이어서 실제 저장으로
   * 넘어간다. 인식기 콜백(`handleVoiceEnd`)에서 바로 저장을 부르지 않는 이유는, 그 콜백이 마이크를
   * 누른 시점의 오래된 `draft`(이후 고른 어르신·입력 방식이 반영되지 않은 값)를 들고 있기 때문이다.
   */
  const [pendingSave, setPendingSave] = useState(false)
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

  /** 저장 성공 → 인계 카드 정리. 결과는 안내에만 쓰고 입력 흐름을 막지 않는다. */
  const structure = useMutation({
    mutationFn: structureHandover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HANDOVER_CARDS_KEY }),
  })

  const save = useMutation({
    mutationFn: () => createHandover(toCreateRequest(draft, reporterName)),
    onSuccess: (handover) => {
      // 실제로 저장까지 마친 방식만 "이 기기에서 마지막으로 쓴 방식"으로 기억한다.
      // (Manyfast F-YJJJUX rules)
      if (draft.inputMethod !== null) {
        writeLastInputMethod(draft.inputMethod)
      }
      setSavedName(handover.careRecipientName)
      setErrors([])
      setNotice(null)
      setOutcome('done')
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
        setOutcome('queued')
        return
      }
      if (error.fields.length > 0) {
        setErrors([...error.fields])
        setNotice(null)
        if (error.fields.some((field) => SETTINGS_FIELDS.has(field.field))) {
          setSettingsOpen(true)
        }
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

  // 방식을 바꾸면(언마운트 없이도) 듣던 마이크를 놓는다. (Manyfast F-YJJJUX rules — 상시 녹음 금지)
  useEffect(() => {
    if (draft.inputMethod !== 'VOICE') {
      voiceRecognizerRef.current?.stop()
      setVoiceListening(false)
      setVoiceFinishing(false)
    }
  }, [draft.inputMethod])

  // 화면을 완전히 벗어날 때도 놓는다.
  useEffect(() => {
    return () => {
      voiceRecognizerRef.current?.stop()
    }
  }, [])

  /** 인식·녹음이 모두 끝났을 때. 음성을 얻었으면 draft 에 붙인다. 저장 재개는 아래 effect가 한다. */
  const handleVoiceEnd = (audioBase64: string | null) => {
    setVoiceListening(false)
    setVoiceFinishing(false)
    if (audioBase64 !== null) {
      update({ audioData: audioBase64 })
    }
  }

  const toggleVoiceListening = () => {
    if (voiceListening) {
      setVoiceFinishing(true)
      voiceRecognizerRef.current?.stop()
      return
    }
    const recognizer = createSpeechRecognizer(
      (transcript) => update({ rawText: transcript }),
      handleVoiceEnd,
      (message) => setVoiceNotice(message),
    )
    voiceRecognizerRef.current = recognizer
    // 새로 말하면 앞서 녹음한 음성은 더 이상 지금 글의 원본이 아니다.
    update({ audioData: undefined })
    recognizer?.start()
    setVoiceListening(true)
    setVoiceNotice(null)
  }

  const pickMethod = (inputMethod: InputMethod) => {
    // 완료 조건 — 음성 인식 미지원 브라우저에서는 텍스트로 대체 안내한다.
    if (inputMethod === 'VOICE' && !isSpeechRecognitionSupported()) {
      setErrors([])
      setNotice('이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트로 남겨 주세요.')
      return
    }
    update({ inputMethod })
  }

  const pickProxy = (proxyInput: boolean) => {
    // 직접 관찰로 되돌리면 앞서 고른 출처를 지운다. 남겨 두면 둘 중 어느 쪽이 사실인지 알 수 없다.
    update({ proxyInput, infoSource: proxyInput ? draft.infoSource : null })
  }

  const doSubmit = () => {
    const found = validateDraft(draft, reporterName)
    if (found.length > 0) {
      setErrors(found)
      setNotice(null)
      if (found.some((field) => SETTINGS_FIELDS.has(field.field))) {
        setSettingsOpen(true)
      }
      return
    }
    setErrors([])
    setNotice(null)
    save.mutate()
  }

  // 마이크가 멈추고 정리가 끝나길 기다리던 저장을 이어간다. 여기서(effect) 재개해야 그 시점의
  // 최신 draft(어르신 선택 등)를 보고 검증한다 — 인식기 콜백은 마이크를 켠 시점의 낡은 값을 든다.
  useEffect(() => {
    if (pendingSave && !voiceListening && !voiceFinishing) {
      setPendingSave(false)
      doSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSave, voiceListening, voiceFinishing])

  /**
   * 아직 듣고 있거나 방금 멈춘 결과를 정리하는 중이면, 먼저 멈추고 정리가 끝나면(위 effect) 이어서
   * 저장한다 — 예전 단계형 화면에서 "다음"을 누르면 듣기를 자동으로 멈추고 넘어가던 것과 같은
   * 동작이다. 저장을 한 번 더 눌러야 하는 마찰을 만들지 않는다.
   */
  const submit = () => {
    if (draft.inputMethod === 'VOICE' && (voiceListening || voiceFinishing)) {
      setPendingSave(true)
      if (voiceListening) {
        setVoiceFinishing(true)
        voiceRecognizerRef.current?.stop()
      }
      return
    }
    doSubmit()
  }

  const startAnother = () => {
    setDraft(emptyDraft(new Date(), defaultInputMethod()))
    setErrors([])
    setNotice(null)
    setSettingsOpen(false)
    setVoiceNotice(null)
    setPendingSave(false)
    setSavedName('')
    setQueuedInfo(null)
    structure.reset()
    setOutcome('form')
  }

  if (outcome === 'done') {
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

  if (outcome === 'queued' && queuedInfo !== null) {
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
    <PageLayout title="특이사항 남기기" showBack={true} backTo="/field" backLabel="이전">
      <header>
        <p className="text-xl text-ink-muted">
          입력자 <span className="font-semibold text-ink">{reporterName}</span>
        </p>
      </header>

      <Problems errors={errors} notice={notice} />

      <RecipientSection
        draft={draft}
        recipients={recipients.data ?? []}
        loading={recipients.isPending}
        loadFailed={recipients.isError}
        onRetryLoad={() => void recipients.refetch()}
        onPick={(careRecipientId) => update({ careRecipientId })}
      />

      <MethodSection
        draft={draft}
        onPickMethod={pickMethod}
        onChangeRawText={(rawText) => update({ rawText })}
        onChangeChecked={(checkedItems) => update({ checkedItems })}
        voiceListening={voiceListening}
        voiceFinishing={voiceFinishing}
        voiceNotice={voiceNotice}
        onToggleVoiceListening={toggleVoiceListening}
      />

      <SettingsSection
        draft={draft}
        open={settingsOpen}
        onToggle={() => setSettingsOpen((current) => !current)}
        onPickProxy={pickProxy}
        onPickSource={(infoSource) => update({ infoSource })}
        onChangeOccurredAt={(occurredAt) => update({ occurredAt })}
      />

      <BigButton onClick={submit}>
        {save.isPending ? '저장하는 중…' : voiceFinishing ? '정리하는 중…' : '저장하기'}
      </BigButton>
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

/** 작게 선택하는 알약 모양 버튼 — 관찰 구분·정보 출처처럼 짧은 선택지에 쓴다. */
function Pill({
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
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-12 flex-1 rounded-full border-2 px-4 py-2.5 text-lg font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
        selected
          ? 'border-primary bg-primary text-white'
          : 'border-border-card bg-white text-ink hover:border-primary hover:bg-primary-soft'
      }`}
    >
      {children}
    </button>
  )
}

/** 어르신 선택 — 화면 최상단에 두고 항상 보이게 한다. (Manyfast F-YJJJUX display) */
function RecipientSection({
  draft,
  recipients,
  loading,
  loadFailed,
  onRetryLoad,
  onPick,
}: {
  draft: HandoverDraft
  recipients: CareRecipient[]
  loading: boolean
  loadFailed: boolean
  onRetryLoad: () => void
  onPick: (id: number) => void
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
    <section aria-labelledby="target-heading" className="flex flex-col gap-4">
      <h2 id="target-heading" className="text-2xl font-bold text-ink">
        어느 어르신이신가요?
      </h2>

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

      {/* 어르신 수가 늘어도 화면 자체 길이는 늘지 않도록 목록 안에서만 스크롤한다. (§2.2) */}
      <ul className="flex max-h-72 flex-col gap-4 overflow-y-auto pr-1">
        {shown.map((recipient) => (
          <li key={recipient.id}>
            <BigButton
              tone="plain"
              selected={draft.careRecipientId === recipient.id}
              onClick={() => onPick(recipient.id)}
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span>{recipient.name}</span>
                <span className="text-lg font-normal text-ink-muted">{recipient.code}</span>
              </span>
            </BigButton>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 입력 방식 세그먼트 — 아직 없는 방식도 자리를 지키되 고를 수 없게 둔다. */
function MethodTabs({
  picked,
  onPick,
}: {
  picked: InputMethod | null
  onPick: (value: InputMethod) => void
}) {
  return (
    <div role="group" aria-label="입력 방식" className="flex flex-wrap gap-3">
      {INPUT_METHODS.map((method) =>
        method.ready ? (
          <button
            key={method.value}
            type="button"
            onClick={() => onPick(method.value)}
            aria-pressed={picked === method.value}
            className={`min-h-14 flex-1 rounded-full border-2 px-4 py-3 text-center text-xl font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
              picked === method.value
                ? 'border-primary bg-primary text-white'
                : 'border-border-card bg-white text-ink hover:border-primary hover:bg-primary-soft'
            }`}
          >
            {method.label}
          </button>
        ) : (
          <button
            key={method.value}
            type="button"
            disabled
            className="min-h-14 flex-1 cursor-not-allowed rounded-full border-2 border-dashed border-border-card bg-surface-card px-4 py-3 text-center text-lg font-semibold text-ink-tertiary"
          >
            <span className="block">{method.label}</span>
            <span className="block text-sm font-normal">준비 중 ({method.plannedIn})</span>
          </button>
        ),
      )}
    </div>
  )
}

/** 텍스트 입력 내용. */
function TextContent({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="rawText" className="text-xl text-ink-muted">
        보신 그대로 짧게 남겨 주세요. 다듬지 않아도 됩니다.
      </label>
      <textarea
        id="rawText"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        maxLength={RAW_TEXT_MAX_LENGTH}
        className="w-full rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />
      <p className="text-lg text-ink-muted">
        {value.length} / {RAW_TEXT_MAX_LENGTH}자
      </p>
    </div>
  )
}

/**
 * 음성 입력 내용. 순수하게 보여 주기만 한다 — 인식기·상시 녹음 금지는 부모(`HandoverCreatePage`)가
 * 쥐고 있다. 저장 버튼이 "듣는 중이면 멈추고 이어서 저장"을 하려면 녹음기가 부모 쪽에 있어야
 * 하기 때문이다.
 */
function VoiceContent({
  rawText,
  audioData,
  listening,
  finishing,
  notice,
  onToggleListening,
  onChangeRawText,
}: {
  rawText: string
  audioData: string | undefined
  listening: boolean
  finishing: boolean
  notice: string | null
  onToggleListening: () => void
  onChangeRawText: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xl text-ink-muted">
        마이크를 누르고 말씀하시면 아래에 글로 남습니다. 다시 누르면 멈춥니다.
      </p>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-border-card bg-surface-card px-5 py-8">
        <button
          type="button"
          onClick={onToggleListening}
          aria-label={listening ? '듣고 있어요 · 눌러서 멈추기' : '눌러서 말하기'}
          className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl text-white transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
            listening ? 'animate-pulse bg-primary' : 'bg-surface-dark hover:brightness-110'
          }`}
        >
          🎙️
        </button>
        <p className="text-xl font-semibold text-ink">
          {finishing ? '정리하는 중…' : listening ? '듣고 있어요 · 눌러서 멈추기' : '눌러서 말하기'}
        </p>
      </div>

      {!listening && !finishing && audioData !== undefined && (
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
        value={rawText}
        onChange={(event) => onChangeRawText(event.target.value)}
        rows={5}
        maxLength={RAW_TEXT_MAX_LENGTH}
        className="w-full rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
      />
      <p className="text-lg text-ink-muted">
        {rawText.length} / {RAW_TEXT_MAX_LENGTH}자
      </p>
    </div>
  )
}

/** 체크 입력 내용. 항목은 Manyfast 와이어프레임 "체크 입력 화면" 그대로다(`checkItems.ts`). */
function CheckContent({
  checkedItems,
  onChange,
}: {
  checkedItems: readonly string[]
  onChange: (checkedItems: string[]) => void
}) {
  const toggle = (value: string) => {
    onChange(
      checkedItems.includes(value)
        ? checkedItems.filter((item) => item !== value)
        : [...checkedItems, value],
    )
  }

  return (
    <div className="flex flex-col gap-3">
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
    </div>
  )
}

/** 입력 방식 선택 + 고른 방식의 입력 내용. 화면 전환 없이 방식 아래로 바로 인라인 확장한다. */
function MethodSection({
  draft,
  onPickMethod,
  onChangeRawText,
  onChangeChecked,
  voiceListening,
  voiceFinishing,
  voiceNotice,
  onToggleVoiceListening,
}: {
  draft: HandoverDraft
  onPickMethod: (value: InputMethod) => void
  onChangeRawText: (value: string) => void
  onChangeChecked: (value: string[]) => void
  voiceListening: boolean
  voiceFinishing: boolean
  voiceNotice: string | null
  onToggleVoiceListening: () => void
}) {
  return (
    <section aria-labelledby="method-heading" className="flex flex-col gap-4">
      <h2 id="method-heading" className="text-2xl font-bold text-ink">
        어떻게 남기시겠어요?
      </h2>
      <MethodTabs picked={draft.inputMethod} onPick={onPickMethod} />

      {draft.inputMethod === 'TEXT' && (
        <TextContent value={draft.rawText} onChange={onChangeRawText} />
      )}
      {draft.inputMethod === 'VOICE' && (
        <VoiceContent
          rawText={draft.rawText}
          audioData={draft.audioData}
          listening={voiceListening}
          finishing={voiceFinishing}
          notice={voiceNotice}
          onToggleListening={onToggleVoiceListening}
          onChangeRawText={onChangeRawText}
        />
      )}
      {draft.inputMethod === 'CHECK' && (
        <CheckContent checkedItems={draft.checkedItems} onChange={onChangeChecked} />
      )}
    </section>
  )
}

/**
 * 추가 설정(관찰 구분 · 정보 출처 · 입력 시점) — 기본값이 이미 채워져 있어 자주 바꾸지 않는
 * 항목들이라 접어 둔다. 접힌 채로도 지금 값을 요약해 보여 주고(§2.4 "항상 눈에 보여야 한다"),
 * 펼치면 바로 바꿀 수 있다.
 */
function SettingsSection({
  draft,
  open,
  onToggle,
  onPickProxy,
  onPickSource,
  onChangeOccurredAt,
}: {
  draft: HandoverDraft
  open: boolean
  onToggle: () => void
  onPickProxy: (proxyInput: boolean) => void
  onPickSource: (value: InfoSource) => void
  onChangeOccurredAt: (value: string) => void
}) {
  const summary = [
    draft.proxyInput
      ? `대리 입력${draft.infoSource !== null ? ` · ${infoSourceLabel(draft.infoSource)}` : ''}`
      : '직접 관찰',
    formatOccurredAt(draft.occurredAt),
  ].join(' · ')

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-border-card bg-white px-5 py-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="settings-panel"
        className="flex w-full items-center justify-between gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <span>
          <span className="block text-2xl font-bold text-ink">추가 설정</span>
          <span className="mt-1 block text-lg text-ink-muted">{summary} · 필요할 때만 바꾸세요</span>
        </span>
        {open ? (
          <ChevronUp size={24} aria-hidden="true" className="shrink-0 text-ink-muted" />
        ) : (
          <ChevronDown size={24} aria-hidden="true" className="shrink-0 text-ink-muted" />
        )}
      </button>

      {open && (
        <div id="settings-panel" className="flex flex-col gap-5 border-t border-border-divider pt-4">
          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-bold text-ink">어떻게 아신 내용인가요?</h3>
            <div className="flex gap-3">
              <Pill selected={!draft.proxyInput} onClick={() => onPickProxy(false)}>
                제가 직접 봤어요
              </Pill>
              <Pill selected={draft.proxyInput === true} onClick={() => onPickProxy(true)}>
                다른 분께 들었어요
              </Pill>
            </div>
          </div>

          {draft.proxyInput === true && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-bold text-ink">어느 분께 들으셨나요?</h3>
              <div className="flex flex-wrap gap-3">
                {INFO_SOURCES.map((source) => (
                  <Pill
                    key={source.value}
                    selected={draft.infoSource === source.value}
                    onClick={() => onPickSource(source.value)}
                  >
                    {source.label}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <label htmlFor="occurredAt" className="text-xl font-bold text-ink">
              언제 있었던 일인가요?
            </label>
            <p className="text-lg text-ink-muted">지금 시각이 채워져 있습니다. 다르면 고쳐 주세요.</p>
            <input
              id="occurredAt"
              type="datetime-local"
              value={draft.occurredAt}
              onChange={(event) => onChangeOccurredAt(event.target.value)}
              className="w-full rounded-lg border-2 border-border-card bg-white px-5 py-4 text-2xl text-ink focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * 저장 성공 — 정리 단계로 넘어갔음을 알린다.
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
        <BigButton onClick={() => navigate('/field')}>확인</BigButton>
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
 * 저장 실패가 아니라 임시 저장 안내다. (Manyfast F-YJJJUX exceptions)
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
        <BigButton onClick={() => navigate('/field')}>현장 홈으로</BigButton>
      </div>
    </PageLayout>
  )
}
