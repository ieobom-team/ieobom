package com.ieobom.api.handovercard;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.recipient.CareRecipient;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * 검증을 통과해 카드로 만들어도 되는 항목.
 *
 * <p>{@link CardDraftVerifier} 만 이걸 만든다. 검증을 거치지 않은 값이 카드가 되는 경로를 두지 않기 위해서다.
 *
 * @param careRecipient 대상 어르신. 가릴 수 없었으면 {@code null} 이고 카드는 검토 대상으로 남는다
 * @param evidenceText 근거 원문. 여기까지 온 시점에 비어 있지 않음이 보장된다
 * @param suggestedActions 근거 검증을 통과한 추천 액션 칩. 최대 3개
 */
public record CardBlueprint(
		CareRecipient careRecipient,
		LocalDateTime observedAt,
		String statusChange,
		String actionTaken,
		String nextAction,
		String evidenceText,
		boolean safetyRelated,
		SafetyFlagSource safetyFlagSource,
		JobRole suggestedJobRole,
		LocalTime suggestedDueTime,
		List<SuggestedAction> suggestedActions) {

	/** 대상 어르신을 가리지 못한 항목인지. Manyfast F-SNBVHR exceptions 의 "분리할 수 없는 원문". */
	public boolean isUnresolved() {
		return careRecipient == null;
	}
}
