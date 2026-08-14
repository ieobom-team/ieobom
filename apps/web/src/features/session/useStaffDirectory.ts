import { useQuery } from '@tanstack/react-query'
import { fetchStaffDirectory } from './staffApi'

/** 진입 화면이 쓰는 캐시 키. */
export const STAFF_DIRECTORY_KEY = ['staff'] as const

/**
 * 본인 선택 목록.
 *
 * 진입 화면에서만 부른다. 다른 화면은 이미 고른 사람을 `useSession()` 으로 받으므로 명단이 필요 없다.
 * 명단이 갱신되는 시점도 여기다 — 진입 화면을 열 때마다 다시 받아 캐시를 최신으로 만든다.
 */
export function useStaffDirectory() {
  return useQuery({ queryKey: STAFF_DIRECTORY_KEY, queryFn: fetchStaffDirectory })
}
