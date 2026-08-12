import { describe, expect, it } from 'vitest'
import {
  cardEntries,
  dateLabel,
  findCard,
  observedTimeLabel,
  safetyFirst,
  suggestionLabel,
  totalCardCount,
} from './handoverCard'
import type { HandoverCard, HandoverCardList } from './handoverCardApi'

function 카드(patch: Partial<HandoverCard> = {}): HandoverCard {
  return {
    id: 31,
    handoverId: 12,
    careRecipientId: 1,
    careRecipientName: '김말순',
    observedAt: '2026-08-11T12:40:00',
    statusChange: '점심 식사량 저하',
    actionTaken: null,
    nextAction: '저녁 식사량 확인',
    evidenceText: '점심을 거의 안 드셨어요',
    safetyRelated: true,
    safetyFlagSource: 'KEYWORD',
    reviewStatus: 'NEEDS_REVIEW',
    suggestedJobRole: 'CAREGIVER',
    suggestedDueTime: '17:00',
    exportAllowed: false,
    exportBlockedReason: '검토 완료 후 생성할 수 있습니다.',
    createdAt: '2026-08-11T13:11:02.401',
    ...patch,
  }
}

describe('카드 항목', () => {
  it('세 항목을 값이 없어도 모두 돌려준다', () => {
    const entries = cardEntries(카드({ actionTaken: null }))

    expect(entries.map((entry) => entry.label)).toEqual(['상태 변화', '조치', '다음 행동'])
    expect(entries[1].value).toBeNull()
  })
})

describe('안전 관련 우선 배치', () => {
  it('안전 항목을 앞으로 보낸다', () => {
    const 일반 = 카드({ id: 1, safetyRelated: false })
    const 안전 = 카드({ id: 2, safetyRelated: true })

    expect(safetyFirst([일반, 안전]).map((card) => card.id)).toEqual([2, 1])
  })

  it('같은 무게면 받은 순서를 바꾸지 않는다', () => {
    const 카드들 = [
      카드({ id: 1, safetyRelated: false }),
      카드({ id: 2, safetyRelated: true }),
      카드({ id: 3, safetyRelated: false }),
      카드({ id: 4, safetyRelated: true }),
    ]

    expect(safetyFirst(카드들).map((card) => card.id)).toEqual([2, 4, 1, 3])
  })
})

describe('제안값 표시', () => {
  it('다음 행동이 있으면 제안 직종과 기한을 한 줄로 보여 준다', () => {
    expect(suggestionLabel(카드())).toBe('제안 · 요양보호사 · 17:00까지')
  })

  it('다음 행동이 없으면 제안값을 붙이지 않는다', () => {
    expect(suggestionLabel(카드({ nextAction: null }))).toBeNull()
  })

  it('서버가 직종을 비워 보냈으면 비었다고 적는다', () => {
    expect(suggestionLabel(카드({ suggestedJobRole: null, suggestedDueTime: null }))).toBe(
      '제안 · 담당 직종 미정 · 기한 미정',
    )
  })
})

describe('시각과 날짜', () => {
  it('관찰 시각은 분까지만 보여 준다', () => {
    expect(observedTimeLabel('2026-08-11T12:40:00')).toBe('12:40')
  })

  it('원문에서 시각을 읽지 못한 카드는 시각을 보여 주지 않는다', () => {
    expect(observedTimeLabel(null)).toBeNull()
  })

  it('조회 기준일을 사람이 읽는 형태로 바꾼다', () => {
    expect(dateLabel('2026-08-11')).toBe('8월 11일')
  })
})

describe('목록에서 카드 찾기', () => {
  const list: HandoverCardList = {
    date: '2026-08-11',
    recipients: [{ careRecipientId: 1, careRecipientName: '김말순', cards: [카드({ id: 31 })] }],
    unresolved: [카드({ id: 32, careRecipientId: null, careRecipientName: null })],
  }

  it('어르신 묶음 안의 카드를 찾는다', () => {
    expect(findCard(list, 31)?.id).toBe(31)
  })

  it('어르신을 가리지 못한 카드도 찾는다', () => {
    expect(findCard(list, 32)?.careRecipientId).toBeNull()
  })

  it('없는 카드는 null 이다', () => {
    expect(findCard(list, 99)).toBeNull()
  })

  it('전체 건수는 가리지 못한 항목까지 센다', () => {
    expect(totalCardCount(list)).toBe(2)
  })
})
