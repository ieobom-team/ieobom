import { cacheDirectory, type Staff } from './staffDirectory'

/**
 * 테스트에서만 쓰는 가상 직원 명단.
 *
 * 서버 시드(`StaffSeeder`, `ST-001`~)와 같은 모양이다. **화면 코드는 이 파일을 쓰지 않는다** —
 * 명단은 서버에서 온다. (#33)
 */
export const TEST_STAFF: readonly Staff[] = [
  { code: 'ST-001', name: '김하늘', jobRole: 'CAREGIVER', jobRoleLabel: '요양보호사', hasPin: false },
  { code: 'ST-002', name: '이도윤', jobRole: 'CAREGIVER', jobRoleLabel: '요양보호사', hasPin: false },
  { code: 'ST-003', name: '박서연', jobRole: 'CAREGIVER', jobRoleLabel: '요양보호사', hasPin: false },
  { code: 'ST-004', name: '최민재', jobRole: 'NURSE_AIDE', jobRoleLabel: '간호조무사', hasPin: false },
  { code: 'ST-005', name: '정유진', jobRole: 'NURSE_AIDE', jobRoleLabel: '간호조무사', hasPin: false },
  { code: 'ST-006', name: '강태호', jobRole: 'SOCIAL_WORKER', jobRoleLabel: '사회복지사', hasPin: false },
  { code: 'ST-007', name: '윤소라', jobRole: 'DRIVER', jobRoleLabel: '운전원', hasPin: false },
  { code: 'ST-008', name: '임현우', jobRole: 'CENTER_HEAD', jobRoleLabel: '센터장', hasPin: false },
]

/** 명단을 이미 받아 둔 상태를 만든다. 저장된 진입 선택값은 이 캐시를 보고 되살아난다. */
export function seedStaffCache(directory: readonly Staff[] = TEST_STAFF): void {
  cacheDirectory(directory)
}
