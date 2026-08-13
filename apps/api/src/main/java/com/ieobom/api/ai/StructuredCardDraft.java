package com.ieobom.api.ai;

/**
 * AI 가 돌려준 카드 항목 하나. <b>검증 전</b> 초안이다.
 *
 * <p>열거값에 해당하는 자리까지 모두 {@code String} 으로 받는다. 스키마로 값을 강제하더라도 그것을 그대로 믿고 도메인 타입으로 받으면, 목록 밖 값이
 * 들어왔을 때 파싱 단계에서 예외로 터져 카드 전체가 날아간다. 문자열로 받아 두고 {@code CardDraftVerifier} 가 한 항목씩 판정해 버릴 것만
 * 버리는 편이 안전하다.
 *
 * <p>텍스트 칸은 <b>치환된 원문에서 나온 것</b>이라 어르신이 내부 ID로 적혀 있다. 실명 복원은 이 초안을 받은 자리에서 곧바로 한다. ({@code
 * HandoverCardService})
 *
 * @param recipientCode 대상 어르신의 내부 ID. 가릴 수 없으면 비어 있다
 * @param statusChange 상태 변화
 * @param actionTaken 현장에서 이미 한 조치
 * @param nextAction 남아 있는 다음 행동
 * @param evidenceText 근거가 된 원문 구간. 필수다
 * @param suggestedJobRole 제안 담당 직종. 판단 근거가 부족하면 {@code UNKNOWN}
 * @param suggestedDueTime 제안 기한. 당일 {@code HH:MM}
 * @param observedTime 상황이 있었던 시각. 당일 {@code HH:MM}
 * @param safetyCategory 지정 키워드 4종 중 하나 또는 {@code NONE}
 */
public record StructuredCardDraft(
		String recipientCode,
		String statusChange,
		String actionTaken,
		String nextAction,
		String evidenceText,
		String suggestedJobRole,
		String suggestedDueTime,
		String observedTime,
		String safetyCategory) {}
