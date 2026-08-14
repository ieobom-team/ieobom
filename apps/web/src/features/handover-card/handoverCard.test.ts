import { describe, expect, it } from 'vitest'
import {
  cardEntries,
  chipTextsFor,
  dateLabel,
  findCard,
  observedTimeLabel,
  safetyFirst,
  suggestionLabel,
  totalCardCount,
  uncertainFieldLabels,
  withUpdatedCard,
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
    hasAudio: false,
    suggestedActions: [],
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

describe('AI 추천 액션 칩 (F-SNBVHR display)', () => {
  const 칩카드 = 카드({
    suggestedActions: [
      { targetField: 'ACTION_TAKEN', text: '죽으로 바꿔 드림' },
      { targetField: 'NEXT_ACTION', text: '저녁 식사량 재확인' },
      { targetField: 'NEXT_ACTION', text: '보호자에게 안내' },
    ],
  })

  it('대상 칸으로 나눠 문구만 돌려준다', () => {
    expect(chipTextsFor(칩카드, 'ACTION_TAKEN')).toEqual(['죽으로 바꿔 드림'])
    expect(chipTextsFor(칩카드, 'NEXT_ACTION')).toEqual(['저녁 식사량 재확인', '보호자에게 안내'])
  })

  it('추천이 없으면 빈 배열이다', () => {
    expect(chipTextsFor(카드({ suggestedActions: [] }), 'ACTION_TAKEN')).toEqual([])
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

describe('AI 가 채우지 못한 자리', () => {
  it('다 채워진 카드에는 아무것도 알리지 않는다', () => {
    expect(uncertainFieldLabels(카드())).toEqual([])
  })

  it('어르신을 가리지 못했으면 알린다', () => {
    expect(uncertainFieldLabels(카드({ careRecipientId: null, careRecipientName: null }))).toEqual([
      '대상 어르신',
    ])
  })

  it('원문에서 시각을 읽지 못했으면 알린다', () => {
    expect(uncertainFieldLabels(카드({ observedAt: null }))).toEqual(['관찰 시각'])
  })

  it('다음 행동이 있는데 직종과 기한을 비웠으면 둘 다 알린다', () => {
    expect(
      uncertainFieldLabels(카드({ suggestedJobRole: null, suggestedDueTime: null })),
    ).toEqual(['제안 담당 직종', '제안 기한'])
  })

  it('다음 행동이 없으면 제안값이 비어 있어도 빈 자리로 보지 않는다', () => {
    const 다음행동없음 = 카드({
      nextAction: null,
      suggestedJobRole: null,
      suggestedDueTime: null,
    })

    expect(uncertainFieldLabels(다음행동없음)).toEqual([])
  })
})

describe('고쳐진 카드를 목록에 되꽂기', () => {
  const list: HandoverCardList = {
    date: '2026-08-11',
    recipients: [{ careRecipientId: 1, careRecipientName: '김말순', cards: [카드({ id: 31 })] }],
    unresolved: [카드({ id: 40, careRecipientId: null, careRecipientName: null })],
  }

  it('같은 어르신 안에서 고친 내용으로 갈아 끼운다', () => {
    const 고침 = 카드({ id: 31, statusChange: '점심과 저녁 모두 저하' })

    const 결과 = withUpdatedCard(list, 고침)

    expect(결과.recipients).toHaveLength(1)
    expect(결과.recipients[0].cards).toHaveLength(1)
    expect(결과.recipients[0].cards[0].statusChange).toBe('점심과 저녁 모두 저하')
  })

  it('어르신을 지정하면 검토 필요 항목에서 빼고 그 어르신 묶음으로 옮긴다', () => {
    const 확정 = 카드({ id: 40, careRecipientId: 1, careRecipientName: '김말순' })

    const 결과 = withUpdatedCard(list, 확정)

    expect(결과.unresolved).toEqual([])
    expect(결과.recipients[0].cards.map((card) => card.id)).toEqual([31, 40])
  })

  it('목록에 없던 어르신이면 묶음을 새로 만든다', () => {
    const 확정 = 카드({ id: 40, careRecipientId: 2, careRecipientName: '박순자' })

    const 결과 = withUpdatedCard(list, 확정)

    expect(결과.recipients.map((recipient) => recipient.careRecipientName)).toEqual([
      '김말순',
      '박순자',
    ])
    expect(결과.unresolved).toEqual([])
  })

  it('어르신을 비우면 검토 필요 항목으로 돌아가고 빈 묶음은 사라진다', () => {
    const 비움 = 카드({ id: 31, careRecipientId: null, careRecipientName: null })

    const 결과 = withUpdatedCard(list, 비움)

    expect(결과.recipients).toEqual([])
    expect(결과.unresolved.map((card) => card.id)).toEqual([40, 31])
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
