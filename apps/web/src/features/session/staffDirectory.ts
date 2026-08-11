/**
 * 직원 명단 — 본인 식별에 쓰는 데모용 상수.
 *
 * 명단을 어디서 받아오는지는 아직 정해지지 않아서(#4) 지금은 프론트 상수로 둔다.
 * 서버가 명단을 관리해야 하면 별도 Issue로 뺀다.
 *
 * 담당 직종은 **일부러 넣지 않았다.** 담당 직종은 업무 배정에만 쓰는 값이라
 * 여기에 두면 진입 역할과 섞인다.
 *
 * 이름은 모두 가상 인물이다. 실제 직원 정보를 넣지 않는다.
 */
export type Staff = {
  /** 사번. 명단 안에서 유일하며 저장된 선택값을 되살릴 때 이 값을 쓴다. */
  code: string
  name: string
}

export const STAFF_DIRECTORY: readonly Staff[] = [
  { code: 'ST-001', name: '김하늘' },
  { code: 'ST-002', name: '이도윤' },
  { code: 'ST-003', name: '박서연' },
  { code: 'ST-004', name: '최민재' },
  { code: 'ST-005', name: '정유진' },
  { code: 'ST-006', name: '강태호' },
  { code: 'ST-007', name: '윤소라' },
  { code: 'ST-008', name: '임현우' },
]

export function findStaffByCode(code: string | null | undefined): Staff | undefined {
  if (!code) {
    return undefined
  }
  return STAFF_DIRECTORY.find((staff) => staff.code === code)
}
