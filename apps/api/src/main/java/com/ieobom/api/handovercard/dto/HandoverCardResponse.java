package com.ieobom.api.handovercard.dto;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.handovercard.SafetyFlagSource;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 구조화된 카드 하나.
 *
 * <p>{@code evidenceText} 는 언제나 채워져 나간다. 근거 없는 항목은 저장 단계에서 이미 버려졌다.
 *
 * <p>{@code careRecipientId} 가 {@code null} 인 카드는 대상 어르신을 가리지 못한 검토 대상이다.
 */
public record HandoverCardResponse(
		Long id,
		Long handoverId,
		Long careRecipientId,
		String careRecipientName,
		LocalDateTime observedAt,
		String statusChange,
		String actionTaken,
		String nextAction,
		String evidenceText,
		boolean safetyRelated,
		SafetyFlagSource safetyFlagSource,
		ReviewStatus reviewStatus,
		JobRole suggestedJobRole,
		LocalTime suggestedDueTime,
		LocalDateTime createdAt) {

	public static HandoverCardResponse from(HandoverCard card) {
		return new HandoverCardResponse(
				card.getId(),
				card.getHandover().getId(),
				card.getCareRecipient() == null ? null : card.getCareRecipient().getId(),
				card.getCareRecipient() == null ? null : card.getCareRecipient().getName(),
				card.getObservedAt(),
				card.getStatusChange(),
				card.getActionTaken(),
				card.getNextAction(),
				card.getEvidenceText(),
				card.isSafetyRelated(),
				card.getSafetyFlagSource(),
				card.getReviewStatus(),
				card.getSuggestedJobRole(),
				card.getSuggestedDueTime(),
				card.getCreatedAt());
	}
}
