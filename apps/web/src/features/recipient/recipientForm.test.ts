import { describe, expect, it } from 'vitest'
import {
  activeFirst,
  duplicateNotice,
  duplicatesOf,
  NAME_REQUIRED,
  normalizeName,
  recipientLabel,
} from './recipientForm'
import type { CareRecipient } from './recipientApi'

function 어르신(patch: Partial<CareRecipient> = {}): CareRecipient {
  return { id: 1, name: '김말순', code: 'IB-001', dischargedAt: null, ...patch }
}

describe('normalizeName', () => {
  it('앞뒤 공백을 떼어 낸다', () => {
    expect(normalizeName('  김말순 ')).toEqual({ name: '김말순', error: null })
  })

  it('이름이 비어 있으면 저장하지 않고 이름을 입력하도록 안내한다', () => {
    expect(normalizeName('')).toEqual({ name: '', error: NAME_REQUIRED })
  })

  it('공백만 넣은 것은 이름이 아니다', () => {
    expect(normalizeName('   ').error).toBe(NAME_REQUIRED)
  })
})

describe('duplicatesOf', () => {
  const 명단 = [어르신(), 어르신({ id: 2, name: '박순자', code: 'IB-002' })]

  it('같은 이름의 어르신을 찾아낸다', () => {
    expect(duplicatesOf('김말순', 명단).map((r) => r.code)).toEqual(['IB-001'])
  })

  it('앞뒤 공백이 있어도 같은 이름으로 본다', () => {
    expect(duplicatesOf(' 김말순 ', 명단)).toHaveLength(1)
  })

  it('이용 종료한 어르신도 이름을 차지한 것으로 센다', () => {
    const 종료된_명단 = [어르신({ dischargedAt: '2026-08-01T10:00:00' })]
    expect(duplicatesOf('김말순', 종료된_명단)).toHaveLength(1)
  })

  it('이름이 비어 있으면 아무도 세지 않는다', () => {
    expect(duplicatesOf('  ', 명단)).toEqual([])
  })
})

describe('recipientLabel', () => {
  it('이름과 내부 ID 를 함께 보여 준다', () => {
    expect(recipientLabel(어르신())).toBe('김말순 (IB-001)')
  })
})

describe('duplicateNotice', () => {
  it('이미 있는 어르신의 내부 ID 를 안내에 담는다', () => {
    expect(duplicateNotice([어르신()])).toContain('IB-001')
  })

  it('동명이인이 둘 이상이면 모두 담는다', () => {
    const 안내 = duplicateNotice([어르신(), 어르신({ id: 3, code: 'IB-021' })])
    expect(안내).toContain('IB-001')
    expect(안내).toContain('IB-021')
  })
})

describe('activeFirst', () => {
  it('이용 종료한 어르신을 뒤로 보낸다', () => {
    const 정렬 = activeFirst([
      어르신({ id: 1, code: 'IB-001', dischargedAt: '2026-08-01T10:00:00' }),
      어르신({ id: 2, code: 'IB-002' }),
    ])
    expect(정렬.map((r) => r.code)).toEqual(['IB-002', 'IB-001'])
  })
})
