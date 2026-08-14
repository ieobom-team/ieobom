package com.ieobom.api.handovercard.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.handovercard.CardField;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.handovercard.SafetyFlagSource;
import com.ieobom.api.handovercard.SuggestedAction;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * 구조화된 카드 하나.
 *
 * <p>{@code evidenceText} 는 언제나 채워져 나간다. 근거 없는 항목은 저장 단계에서 이미 버려졌다.
 *
 * <p>{@code careRecipientId} 가 {@code null} 인 카드는 대상 어르신을 가리지 못한 검토 대상이다.
 *
 * @param suggestedDueTime 기한 제안값. 형태를 {@code HH:MM} 으로 고정한다. 고정하지 않으면 Jackson 이 {@code
 *     17:30:00} 처럼 초까지 붙여 내보내는데, 이 제품의 기한은 당일 시각 단위이고 (Manyfast F-IVFNPC rules) 직원이 고쳐 보낸
 *     값과 돌려받는 값의 모양이 달라지면 화면이 굳이 다시 다듬어야 한다
 * @param exportAllowed 이 카드로 출력 문구를 만들 수 있는지. 화면은 이 값으로 버튼을 열고 닫는다
 * @param exportBlockedReason 만들 수 없는 이유. 만들 수 있으면 {@code null}
 * @param hasAudio 원문에 재생할 원본 음성이 붙어 있는지. 화면은 이 값으로 재생 버튼을 그린다. <b>입력 방식이 음성인지와 다르다</b> — 마이크 권한을
 *     거부했거나 녹음을 지원하지 않는 브라우저의 입력도 {@code VOICE} 로 저장되고, 그 카드에는 들을 음성이 없다
 * @param suggestedActions AI 추천 액션 칩. 최대 3개. (Manyfast F-SNBVHR action · display — RFC #62 방향 A) 근거가
 *     없어 폐기된 제안은 애초에 담기지 않는다
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
		@JsonFormat(pattern = "HH:mm") LocalTime suggestedDueTime,
		boolean exportAllowed,
		String exportBlockedReason,
		LocalDateTime createdAt,
		boolean hasAudio,
		List<SuggestedActionResponse> suggestedActions) {

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
				card.canGenerateExport(),
				card.exportBlockedReason(),
				card.getCreatedAt(),
				card.getHandover().hasAudio(),
				card.getSuggestedActions().stream().map(SuggestedActionResponse::from).toList());
	}

	/** 칩 하나. 근거 원문은 검증에서만 쓰고 저장하지 않으므로 여기 실려 나가지 않는다. */
	public record SuggestedActionResponse(CardField targetField, String text) {

		static SuggestedActionResponse from(SuggestedAction action) {
			return new SuggestedActionResponse(action.getTargetField(), action.getText());
		}
	}
}
