import { apiDownload, apiFetch, type DownloadedFile } from '../../shared/api/client'

/** 계약은 `docs/contracts/export-api.md` 에 있다. */

export type PhraseType = 'RECORD' | 'GUARDIAN'

export const PHRASE_TYPES: readonly PhraseType[] = ['RECORD', 'GUARDIAN']

/**
 * 문구 하나.
 *
 * 카드 단위 응답(`phrases[]`)과 묶음 안의 `phrases[]`가 같은 모양을 쓴다. `cardId` · `handoverId` ·
 * `evidenceText`를 자기 안에 들고 있어, 문구 하나만 떼어 봐도 근거로 돌아갈 수 있다.
 * (Manyfast `R-TUBGKD` 수락기준 3)
 *
 * `text`가 `null`이면 만들지 못했다는 뜻이다. 자리는 남는다 — phrases는 언제나 두 개다.
 */
export type ExportPhrase = {
  id: number
  cardId: number
  handoverId: number
  careRecipientId: number
  careRecipientName: string
  phraseType: PhraseType
  phraseTypeLabel: string
  text: string | null
  generatedText: string | null
  edited: boolean
  needsReview: boolean
  reviewNotice: string | null
  evidenceText: string
  copiedAt: string | null
  createdAt: string
}

export type ExportPhraseGroup = {
  cardId: number
  needsReview: boolean
  phrases: ExportPhrase[]
}

/**
 * 카드 한 장의 두 문구를 만들거나, 이미 있으면 그대로 받는다.
 *
 * 모델을 다시 부르지 않는다. 화면을 다시 열어도 직원이 고쳐 둔 문구를 덮어쓰지 않는다.
 */
export function generateExportPhrases(cardId: number): Promise<ExportPhraseGroup> {
  return apiFetch<ExportPhraseGroup>(`/api/handover-cards/${cardId}/exports`, {
    method: 'POST',
  })
}

/** 직원이 검토하며 고친 문구를 저장한다. 고칠 수 있는 것은 본문 하나뿐이다. */
export function updateExportPhrase(phraseId: number, text: string): Promise<ExportPhrase> {
  return apiFetch<ExportPhrase>(`/api/exports/${phraseId}`, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  })
}

/** 문구를 어디로도 보내지 않는다. 실제 복사는 화면이 하고, 이 요청은 그 사실만 남긴다. */
export function copyExportPhrase(phraseId: number): Promise<ExportPhrase> {
  return apiFetch<ExportPhrase>(`/api/exports/${phraseId}/copy`, {
    method: 'POST',
  })
}

/**
 * 어르신 한 명의 당일 검토 완료 문구를 유형별로 이어 붙인 묶음.
 *
 * 저장하지 않고 읽을 때 만들어서, 식별자가 없다. `phrases[]`는 카드 단위 응답과 같은 모양이라
 * 항목마다 근거로 돌아갈 수 있다.
 */
export type ExportBundle = {
  phraseType: PhraseType
  phraseTypeLabel: string
  text: string
  empty: boolean
  phraseCount: number
  needsReview: boolean
  notice: string | null
  phrases: ExportPhrase[]
}

export type ExportBundleList = {
  careRecipientId: number
  careRecipientName: string
  date: string
  bundles: ExportBundle[]
}

/** `date`를 생략하면 서버가 오늘로 본다. */
export function fetchExportBundles(
  careRecipientId: number,
  date?: string,
): Promise<ExportBundleList> {
  return apiFetch<ExportBundleList>(
    date
      ? `/api/care-recipients/${careRecipientId}/export-bundles?date=${date}`
      : `/api/care-recipients/${careRecipientId}/export-bundles`,
  )
}

/**
 * 묶음을 복사했다는 사실을 남긴다.
 *
 * 복사할 문구의 식별자를 보내지 않는다. 서버가 조회와 같은 규칙으로 묶음을 다시 만들어 그 안의
 * 문구에 기록을 남긴다 — 화면이 보여 준 묶음과 복사 기록이 갈리지 않게 하기 위해서다.
 */
export function copyExportBundle(
  careRecipientId: number,
  phraseType: PhraseType,
  date?: string,
): Promise<ExportBundle> {
  return apiFetch<ExportBundle>(`/api/care-recipients/${careRecipientId}/export-bundles/copy`, {
    method: 'POST',
    body: JSON.stringify(date ? { phraseType, date } : { phraseType }),
  })
}

/**
 * 내려받을 수 있는 파일 형식. (Manyfast `F-GUSOFG` action)
 *
 * **같은 내용의 다른 렌더링이다.** 형식이 늘어도 담기는 사실은 늘지 않는다.
 * 목록의 순서가 화면에 놓이는 순서다.
 */
export const EXPORT_FILE_FORMATS = [
  { format: 'txt', label: '텍스트' },
  { format: 'md', label: '마크다운' },
] as const

export type ExportFileFormat = (typeof EXPORT_FILE_FORMATS)[number]['format']

/** 카드 한 장의 문구 하나를 파일로 받는다. 내려받는 글자는 복사되는 것과 같다. */
export function downloadPhraseFile(
  phraseId: number,
  format: ExportFileFormat,
): Promise<DownloadedFile> {
  return apiDownload(`/api/exports/${phraseId}/file?format=${format}`)
}

/** 어르신 당일 묶음을 파일로 받는다. 무엇이 들어가는지는 묶음 조회와 같은 규칙이다. */
export function downloadBundleFile(
  careRecipientId: number,
  phraseType: PhraseType,
  format: ExportFileFormat,
  date?: string,
): Promise<DownloadedFile> {
  const query = new URLSearchParams({ phraseType, format })
  if (date !== undefined) {
    query.set('date', date)
  }
  return apiDownload(`/api/care-recipients/${careRecipientId}/export-bundles/file?${query}`)
}
