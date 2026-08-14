import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import { CardsLoadFailed, CardsLoading } from '../handover-card/CardsLoadState'
import { findCard } from '../handover-card/handoverCard'
import type { HandoverCard } from '../handover-card/handoverCardApi'
import { useHandoverCards } from '../handover-card/useHandoverCards'
import { PageLayout } from '../../shared/ui/PageLayout'
import { writeToClipboard } from './clipboard'
import { saveFile } from './download'
import {
  copyExportBundle,
  copyExportPhrase,
  downloadBundleFile,
  downloadPhraseFile,
  downloadSheetFile,
  fetchExportBundles,
  generateExportPhrases,
  updateExportPhrase,
  EXPORT_FILE_FORMATS,
  EXPORT_SHEET_FORMATS,
  type ExportBundle,
  type ExportBundleList,
  type ExportPhrase,
  type ExportPhraseGroup,
  type PhraseType,
} from './exportApi'
import type { DownloadedFile } from '../../shared/api/client'

/** Manyfast `F-GUSOFG` display — 전산 기록 문구는 300자, 보호자 전달 문구는 200자를 상한으로 한다. */
const MAX_LENGTH: Record<PhraseType, number> = { RECORD: 300, GUARDIAN: 200 }

/**
 * 유저플로우 "새 플로우 3" n36~n41 — 기록·보호자 전달 문구 화면.
 *
 * 카드 상세(n21)에서 `exportAllowed`가 참일 때만 들어온다. 판정은 화면이 다시 하지 않고
 * `HandoverCardDetailPage`의 `ExportEntry`와 같은 서버 값을 그대로 믿는다.
 *
 * "카드 한 장의 문구"(n37 · n38)와 "어르신 당일 묶음"(n62)을 탭으로 가르지 않고 세로로 함께 둔다.
 * 유저플로우 "새 플로우 3"에서 셋이 n36의 나란한 자식 노드이기 때문이다. 파일 다운로드(n41)는 #45 로 분리했다.
 */
export function ExportPage() {
  const { cardId } = useParams()
  const cards = useHandoverCards()

  const parsed = Number(cardId)
  const card =
    cards.data === undefined || !Number.isInteger(parsed) ? null : findCard(cards.data, parsed)

  return (
    <PageLayout
      title="기록·보호자 전달 문구"
      backTo={`/handover-cards/${cardId}`}
      backLabel="카드로 돌아가기"
    >
      <h1 className="text-3xl font-bold text-slate-900">기록·보호자 전달 문구</h1>

      {cards.isPending && <CardsLoading />}
      {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}

      {cards.isSuccess && card === null && (
        <p className="text-xl text-slate-600">
          그 인계 카드를 찾지 못했습니다. 오늘 목록에 없는 카드일 수 있습니다.
        </p>
      )}

      {card !== null && !card.exportAllowed && (
        <p className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
          {card.exportBlockedReason ?? '아직 문구를 만들 수 없습니다.'}
        </p>
      )}

      {/* exportAllowed 인 카드에는 언제나 어르신이 있다. (docs/contracts/export-api.md) */}
      {card !== null && card.exportAllowed && card.careRecipientId !== null && (
        <ExportContent card={card} careRecipientId={card.careRecipientId} />
      )}
    </PageLayout>
  )
}

function ExportLoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError ? error.message : '문구를 불러오지 못했습니다.'
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4"
    >
      <p className="text-xl text-amber-900">{message}</p>
      <BigButton tone="plain" onClick={onRetry}>
        다시 시도하기
      </BigButton>
    </div>
  )
}

function ExportContent({
  card,
  careRecipientId,
}: {
  card: HandoverCard
  careRecipientId: number
}) {
  const queryClient = useQueryClient()
  const phrasesKey = ['export-phrases', card.id] as const
  const bundlesKey = ['export-bundles', careRecipientId] as const

  const phrasesQuery = useQuery({
    queryKey: phrasesKey,
    queryFn: () => generateExportPhrases(card.id),
  })
  const bundlesQuery = useQuery({
    queryKey: bundlesKey,
    queryFn: () => fetchExportBundles(careRecipientId),
  })

  /** 문구 하나가 바뀌면 목록 캐시에 되꽂고, 최상위 needsReview 도 같은 규칙으로 다시 센다. */
  const applyPhrase = (updated: ExportPhrase) => {
    queryClient.setQueryData<ExportPhraseGroup>(phrasesKey, (group) => {
      if (group === undefined) {
        return group
      }
      const phrases = group.phrases.map((phrase) => (phrase.id === updated.id ? updated : phrase))
      return { ...group, phrases, needsReview: phrases.some((phrase) => phrase.needsReview) }
    })
    // 묶음 텍스트는 카드 문구를 이어 붙인 것이다. 문구가 바뀌면 묶음을 다시 읽어야 맞는다.
    void queryClient.invalidateQueries({ queryKey: bundlesKey })
  }

  const applyBundle = (updated: ExportBundle) => {
    queryClient.setQueryData<ExportBundleList>(bundlesKey, (list) => {
      if (list === undefined) {
        return list
      }
      return {
        ...list,
        bundles: list.bundles.map((bundle) =>
          bundle.phraseType === updated.phraseType ? updated : bundle,
        ),
      }
    })
  }

  return (
    <>
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-slate-900">이 카드의 문구</h2>

        {phrasesQuery.isPending && <p className="text-xl text-slate-600">문구를 만드는 중입니다…</p>}
        {phrasesQuery.isError && (
          <ExportLoadFailed
            error={phrasesQuery.error}
            onRetry={() => void phrasesQuery.refetch()}
          />
        )}
        {phrasesQuery.isSuccess &&
          phrasesQuery.data.phrases.map((phrase) => (
            <PhraseCard key={phrase.id} phrase={phrase} onSaved={applyPhrase} />
          ))}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-slate-900">어르신 당일 묶음</h2>
        <p className="text-lg text-slate-500">
          오늘 검토 완료된 카드의 문구를 유형별로 이어 붙입니다. 여러 카드를 한 번에 옮길 때 씁니다.
        </p>

        {/*
          표는 문구가 아니라 카드와 후속 업무를 담는다. 유형별 묶음 안에 두면 "전산 기록 문구의 표"처럼
          읽히므로, 두 묶음 위 어르신 당일 자리에 한 번만 둔다.
        */}
        <DownloadRow
          formats={EXPORT_SHEET_FORMATS}
          request={() => downloadSheetFile(careRecipientId)}
          blocked={null}
          caption="오늘 인계 항목을 담당·기한·처리 상태까지 표로 내려받기"
        />

        {bundlesQuery.isPending && <p className="text-xl text-slate-600">묶음을 만드는 중입니다…</p>}
        {bundlesQuery.isError && (
          <ExportLoadFailed
            error={bundlesQuery.error}
            onRetry={() => void bundlesQuery.refetch()}
          />
        )}
        {bundlesQuery.isSuccess &&
          bundlesQuery.data.bundles.map((bundle) => (
            <BundleCard
              key={bundle.phraseType}
              careRecipientId={careRecipientId}
              bundle={bundle}
              onCopied={applyBundle}
            />
          ))}
      </section>
    </>
  )
}

/**
 * 복사 옆에 붙는 파일 내려받기. (Manyfast `F-GUSOFG` display)
 *
 * **복사가 기본 동작으로 남는다.** 여기 있는 것은 같은 내용을 다른 형식으로 받는 길이고, 새 기능이 아니다.
 * 그래서 큰 버튼(`BigButton`)을 쓰지 않고 복사 버튼 아래 한 줄로 둔다.
 *
 * `blocked`가 있으면 그 이유를 그대로 보여 주고 누르지 못하게 한다. 저장하지 않은 편집을 서버는 알 수 없으므로
 * 복사와 똑같이 화면이 막는다 — 막지 않으면 화면에 보이는 글자와 파일 속 글자가 갈린다.
 */
function DownloadRow<F extends string>({
  formats,
  request,
  blocked,
  caption = '파일로 내려받기',
}: {
  formats: readonly { format: F; label: string }[]
  request: (format: F) => Promise<DownloadedFile>
  blocked: string | null
  caption?: string
}) {
  const [pending, setPending] = useState<F | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const handleDownload = async (format: F) => {
    if (blocked !== null) {
      return
    }
    setPending(format)
    setFailed(null)
    try {
      const file = await request(format)
      const saved = saveFile(file.blob, file.fileName ?? `이어봄.${format}`)
      if (!saved) {
        setFailed('파일을 저장하지 못했습니다. 브라우저에서 다운로드를 허용한 뒤 다시 눌러 주세요.')
      }
    } catch (error) {
      setFailed(error instanceof ApiError ? error.message : '파일을 내려받지 못했습니다.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="mt-4">
      <p className="text-lg font-semibold text-slate-500">{blocked ?? caption}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {formats.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            disabled={blocked !== null}
            onClick={() => void handleDownload(format)}
            className="rounded-2xl border-2 border-slate-300 bg-white px-5 py-3 text-xl font-semibold text-slate-900 hover:border-teal-600 hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 disabled:border-slate-200 disabled:text-slate-400"
          >
            {pending === format ? '내려받는 중…' : `${label}(.${format})`}
          </button>
        ))}
      </div>
      {failed !== null && (
        <p role="alert" className="mt-3 text-lg text-amber-900">
          {failed}
        </p>
      )}
    </div>
  )
}

/**
 * 카드 한 장의 문구 하나. 검토 안내는 복사를 막지 않는다 — 계약대로 "확인하고 쓰라"는 말이지
 * "쓰지 말라"는 말이 아니다. 막는 것은 만들지 못한 문구(`text: null`)와 저장하지 않은 편집뿐이다.
 */
function PhraseCard({
  phrase,
  onSaved,
}: {
  phrase: ExportPhrase
  onSaved: (phrase: ExportPhrase) => void
}) {
  const [draft, setDraft] = useState(phrase.text ?? '')
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

  // 저장·복사 응답이 캐시에 반영되면 그 값으로 다시 맞춘다.
  useEffect(() => {
    setDraft(phrase.text ?? '')
  }, [phrase.text])

  const dirty = draft !== (phrase.text ?? '')

  const save = useMutation({
    mutationFn: (text: string) => updateExportPhrase(phrase.id, text),
    onSuccess: (updated) => {
      onSaved(updated)
      setCopyNotice(null)
      setCopyFailed(false)
    },
  })

  const copy = useMutation({
    mutationFn: () => copyExportPhrase(phrase.id),
    onSuccess: (updated) => {
      onSaved(updated)
      setCopyNotice('복사했습니다.')
      setCopyFailed(false)
    },
  })

  /** 실제로 클립보드에 쓰였을 때만 복사 기록 API 를 부른다. */
  const handleCopy = async () => {
    if (phrase.text === null || dirty) {
      return
    }
    const wrote = await writeToClipboard(phrase.text)
    if (!wrote) {
      setCopyFailed(true)
      setCopyNotice(null)
      return
    }
    copy.mutate()
  }

  return (
    <article className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-2xl font-bold text-slate-900">{phrase.phraseTypeLabel}</h3>
        {phrase.copiedAt !== null && !dirty && (
          <span className="rounded-full bg-teal-100 px-3 py-1 text-lg font-bold text-teal-900">
            복사됨
          </span>
        )}
      </div>

      <figure className="mt-4 rounded-xl border-l-4 border-slate-300 bg-slate-50 px-4 py-3">
        <figcaption className="text-lg font-semibold text-slate-500">근거 원문</figcaption>
        <blockquote className="mt-1 text-xl text-slate-800">“{phrase.evidenceText}”</blockquote>
      </figure>

      {phrase.needsReview && phrase.reviewNotice !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-lg text-amber-900"
        >
          복사 전에 확인해 주세요 — {phrase.reviewNotice}
        </p>
      )}

      {phrase.text === null ? (
        <p className="mt-4 text-xl text-slate-500">
          이 문구는 만들지 못했습니다. 카드 내용을 검토한 뒤 다시 열어 주세요.
        </p>
      ) : (
        <>
          <label
            htmlFor={`phrase-${phrase.id}`}
            className="mt-4 block text-lg font-semibold text-slate-500"
          >
            문구 ({draft.length}/{MAX_LENGTH[phrase.phraseType]}자)
          </label>
          <textarea
            id={`phrase-${phrase.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            maxLength={MAX_LENGTH[phrase.phraseType]}
            className="mt-1 w-full rounded-2xl border-2 border-slate-300 px-5 py-4 text-xl text-slate-900 focus:border-teal-600 focus:outline-none"
          />

          <div className="mt-4 flex flex-col gap-3">
            {dirty && (
              <BigButton tone="plain" onClick={() => save.mutate(draft)}>
                {save.isPending ? '저장하는 중…' : '고친 내용 저장하기'}
              </BigButton>
            )}
            <BigButton onClick={() => void handleCopy()}>
              {dirty
                ? '저장한 뒤 복사할 수 있습니다'
                : copy.isPending
                  ? '복사하는 중…'
                  : '복사하기'}
            </BigButton>
          </div>

          <DownloadRow
            formats={EXPORT_FILE_FORMATS}
            request={(format) => downloadPhraseFile(phrase.id, format)}
            blocked={dirty ? '저장한 뒤 내려받을 수 있습니다' : null}
          />

          {copyNotice !== null && (
            <p role="status" className="mt-3 text-lg text-teal-800">
              {copyNotice}
            </p>
          )}
          {copyFailed && (
            <p role="alert" className="mt-3 text-lg text-amber-900">
              복사하지 못했습니다. 문구를 길게 눌러 직접 복사해 주세요.
            </p>
          )}
          {save.isError && (
            <p role="alert" className="mt-3 text-lg text-amber-900">
              {save.error instanceof ApiError
                ? save.error.message
                : '저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.'}
            </p>
          )}
          {copy.isError && (
            <p role="alert" className="mt-3 text-lg text-amber-900">
              {copy.error instanceof ApiError ? copy.error.message : '복사 기록을 남기지 못했습니다.'}
            </p>
          )}
        </>
      )}
    </article>
  )
}

/**
 * 어르신 당일 묶음 하나. 저장 대상이 아니라 조회 시점에 만들어진다.
 *
 * 수정은 하지 못한다. 이어 붙인 텍스트는 여러 카드에 걸쳐 있어 고칠 수 있는 API 가 없다 — 고치려면
 * 근거를 눌러 해당 카드로 가야 한다. (`docs/contracts/export-api.md`)
 */
function BundleCard({
  careRecipientId,
  bundle,
  onCopied,
}: {
  careRecipientId: number
  bundle: ExportBundle
  onCopied: (bundle: ExportBundle) => void
}) {
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

  const copy = useMutation({
    mutationFn: () => copyExportBundle(careRecipientId, bundle.phraseType),
    onSuccess: (updated) => {
      onCopied(updated)
      setCopyNotice('묶음을 복사했습니다.')
      setCopyFailed(false)
    },
  })

  const handleCopy = async () => {
    if (bundle.empty) {
      return
    }
    const wrote = await writeToClipboard(bundle.text)
    if (!wrote) {
      setCopyFailed(true)
      setCopyNotice(null)
      return
    }
    copy.mutate()
  }

  return (
    <article className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-2xl font-bold text-slate-900">{bundle.phraseTypeLabel} 묶음</h3>
        <span className="text-lg text-slate-500">{bundle.phraseCount}건</span>
      </div>

      {bundle.notice !== null && (
        <p
          role={bundle.needsReview ? 'alert' : 'status'}
          className={`mt-4 rounded-xl border-l-4 px-4 py-3 text-lg ${
            bundle.needsReview
              ? 'border-amber-400 bg-amber-50 text-amber-900'
              : 'border-slate-300 bg-slate-50 text-slate-700'
          }`}
        >
          {bundle.notice}
        </p>
      )}

      {!bundle.empty && (
        <>
          <p className="mt-4 whitespace-pre-wrap text-xl text-slate-900">{bundle.text}</p>

          <div className="mt-4">
            <BigButton onClick={() => void handleCopy()}>
              {copy.isPending ? '복사하는 중…' : '묶음 복사하기'}
            </BigButton>
          </div>

          <DownloadRow
            formats={EXPORT_FILE_FORMATS}
            request={(format) => downloadBundleFile(careRecipientId, bundle.phraseType, format)}
            blocked={null}
          />

          {copyNotice !== null && (
            <p role="status" className="mt-3 text-lg text-teal-800">
              {copyNotice}
            </p>
          )}
          {copyFailed && (
            <p role="alert" className="mt-3 text-lg text-amber-900">
              복사하지 못했습니다. 문구를 길게 눌러 직접 복사해 주세요.
            </p>
          )}
          {copy.isError && (
            <p role="alert" className="mt-3 text-lg text-amber-900">
              {copy.error instanceof ApiError ? copy.error.message : '복사 기록을 남기지 못했습니다.'}
            </p>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-lg font-semibold text-slate-500">
              포함된 카드 근거 보기
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {bundle.phrases.map((phrase) => (
                <li
                  key={phrase.id}
                  className="rounded-xl border-l-4 border-slate-300 bg-slate-50 px-4 py-3"
                >
                  <blockquote className="text-lg text-slate-800">“{phrase.evidenceText}”</blockquote>
                  <Link
                    to={`/handover-cards/${phrase.cardId}/export`}
                    className="mt-2 inline-block text-lg font-semibold text-teal-800 underline underline-offset-4"
                  >
                    이 카드에서 근거·수정 보기
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </article>
  )
}
