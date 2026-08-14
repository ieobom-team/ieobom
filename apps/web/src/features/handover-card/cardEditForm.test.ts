import { describe, expect, it } from 'vitest'
import {
  cardDraftFrom,
  toCardUpdateRequest,
  validateCardDraft,
  type CardEditDraft,
} from './cardEditForm'
import type { HandoverCard } from './handoverCardApi'

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
    safetyRelated: false,
    safetyFlagSource: null,
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

function 폼(patch: Partial<CardEditDraft> = {}): CardEditDraft {
  return { ...cardDraftFrom(카드()), ...patch }
}

describe('카드 값으로 폼 채우기', () => {
  it('카드가 들고 있는 값을 그대로 채운다', () => {
    expect(cardDraftFrom(카드())).toEqual({
      careRecipientId: 1,
      statusChange: '점심 식사량 저하',
      actionTaken: '',
      nextAction: '저녁 식사량 확인',
      suggestedJobRole: 'CAREGIVER',
      suggestedDueTime: '17:00',
    })
  })

  it('어르신을 가리지 못한 카드는 어르신을 비운 채로 연다', () => {
    const draft = cardDraftFrom(카드({ careRecipientId: null, careRecipientName: null }))

    expect(draft.careRecipientId).toBeNull()
  })
})

describe('제출 전 검증', () => {
  it('고칠 게 없으면 통과한다', () => {
    expect(validateCardDraft(폼())).toEqual([])
  })

  it('세 항목을 모두 비우면 셋을 모두 지목한다', () => {
    const found = validateCardDraft(
      폼({
        statusChange: '  ',
        actionTaken: '',
        nextAction: '',
        suggestedJobRole: null,
        suggestedDueTime: '',
      }),
    )

    expect(found.map((error) => error.field)).toEqual(['statusChange', 'actionTaken', 'nextAction'])
    expect(found[0].reason).toContain('하나는 남겨 주세요')
  })

  it('다음 행동 없이 제안 직종만 남기면 막는다', () => {
    const found = validateCardDraft(
      폼({ nextAction: '', suggestedJobRole: 'NURSE_AIDE', suggestedDueTime: '' }),
    )

    expect(found).toHaveLength(1)
    expect(found[0].field).toBe('nextAction')
    expect(found[0].reason).toContain('다음 행동이 있을 때만')
  })

  it('다음 행동 없이 제안 기한만 남겨도 막는다', () => {
    const found = validateCardDraft(
      폼({ nextAction: '', suggestedJobRole: null, suggestedDueTime: '17:30' }),
    )

    expect(found.map((error) => error.field)).toEqual(['nextAction'])
  })

  it('다음 행동과 제안값을 함께 지우는 것은 막지 않는다', () => {
    expect(
      validateCardDraft(폼({ nextAction: '', suggestedJobRole: null, suggestedDueTime: '' })),
    ).toEqual([])
  })
})

describe('요청으로 바꾸기', () => {
  it('공백만 남은 칸은 지운 것으로 보낸다', () => {
    const request = toCardUpdateRequest(폼({ actionTaken: '   ', statusChange: ' 기침 ' }))

    expect(request.actionTaken).toBeNull()
    expect(request.statusChange).toBe('기침')
  })

  it('어르신을 비운 채로도 보낸다', () => {
    expect(toCardUpdateRequest(폼({ careRecipientId: null })).careRecipientId).toBeNull()
  })

  it('고칠 수 있는 항목을 통째로 담는다', () => {
    expect(Object.keys(toCardUpdateRequest(폼())).sort()).toEqual([
      'actionTaken',
      'careRecipientId',
      'nextAction',
      'statusChange',
      'suggestedDueTime',
      'suggestedJobRole',
    ])
  })
})
