/**
 * 정보 출처 — 유저플로우 "새 플로우 3" n9. 대리 입력일 때만 고른다.
 *
 * **입력자와 다른 값이다.** 입력자는 앱에서 남긴 사람이고, 정보 출처는 그 내용이 실제로 나온 곳이다.
 * 운전원처럼 앱을 쓰지 않는 직원에게서 나온 내용을 데스크 근무자가 대신 남기는 경로가
 * 성립하려면 두 값이 갈라져 있어야 한다. (Manyfast F-YJJJUX dataSpec)
 */
export type InfoSource = 'GUARDIAN' | 'DRIVER' | 'COLLEAGUE' | 'OTHER'

export type InfoSourceOption = {
  value: InfoSource
  label: string
}

export const INFO_SOURCES: readonly InfoSourceOption[] = [
  { value: 'GUARDIAN', label: '보호자' },
  { value: 'DRIVER', label: '운전원' },
  { value: 'COLLEAGUE', label: '동료 근무자' },
  { value: 'OTHER', label: '그 외' },
]

export function infoSourceLabel(value: InfoSource): string {
  const found = INFO_SOURCES.find((source) => source.value === value)
  if (!found) {
    throw new Error(`알 수 없는 정보 출처입니다: ${value}`)
  }
  return found.label
}
