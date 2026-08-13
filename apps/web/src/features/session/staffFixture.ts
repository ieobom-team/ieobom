import { cacheDirectory, type Staff } from './staffDirectory'

/**
 * 테스트에서만 쓰는 가상 직원 명단.
 *
 * 서버 시드(`StaffSeeder`, `ST-001`~)와 같은 모양이다. **화면 코드는 이 파일을 쓰지 않는다** —
 * 명단은 서버에서 온다. (#33)
 */
export const TEST_STAFF: readonly Staff[] = [
  { code: 'ST-001', name: '김하늘' },
  { code: 'ST-002', name: '이도윤' },
]

/** 명단을 이미 받아 둔 상태를 만든다. 저장된 진입 선택값은 이 캐시를 보고 되살아난다. */
export function seedStaffCache(directory: readonly Staff[] = TEST_STAFF): void {
  cacheDirectory(directory)
}
