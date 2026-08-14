import { useQuery } from '@tanstack/react-query'
import { fetchCareRecipients } from './recipientApi'

/**
 * 어르신 명단 캐시 키.
 *
 * 이용 종료 포함 여부를 키에 넣는다. 같은 키로 두면 명단 화면이 받아 온 전체 목록이
 * 현장 입력 화면의 대상 목록으로 새어 나가, 이용 종료한 어르신이 새 입력에 다시 나타난다.
 */
export const recipientsKey = (includeDischarged: boolean) =>
  ['care-recipients', { includeDischarged }] as const

/** 새 입력의 대상 목록. 이용 종료한 어르신은 빠진다. */
export function useActiveRecipients() {
  return useQuery({
    queryKey: recipientsKey(false),
    queryFn: () => fetchCareRecipients(),
  })
}

/** 명단 관리 화면과 이미 남은 기록을 고치는 화면이 쓰는 전체 목록. */
export function useAllRecipients() {
  return useQuery({
    queryKey: recipientsKey(true),
    queryFn: () => fetchCareRecipients({ includeDischarged: true }),
  })
}
