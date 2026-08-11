package com.ieobom.api.handovercard.dto;

import com.ieobom.api.common.JobRole;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;

/**
 * 카드 검토 수정 요청. 고칠 수 있는 항목을 통째로 대신한다.
 *
 * <p><b>일부 항목만 보내는 방식({@code PATCH})을 쓰지 않는다.</b> 그 방식으로는 "조치 내용을 지운다"와 "조치 내용은 건드리지
 * 않는다"가 요청 본문에서 똑같이 보인다. 검토 화면은 어차피 카드 한 장을 통째로 편집하므로 전체를 다시 받는다.
 *
 * <p>근거 원문과 관찰 시각은 여기 없다. 원문에서 나온 값이라 직원이 고치지 않는다. 검토 상태와 안전 표시도 없다. 별도 API 로 뗐다.
 *
 * @param careRecipientId 직원이 지정한 어르신. AI 가 가리지 못한 카드를 여기서 확정한다. 아직 모르면 {@code null}
 * @param suggestedJobRole 다음 행동을 맡을 직종. 다음 행동이 있을 때만 지정할 수 있다
 * @param suggestedDueTime 다음 행동의 기한. 당일 {@code HH:MM} 이고 다음 행동이 있을 때만 지정할 수 있다
 */
public record HandoverCardUpdateRequest(
		Long careRecipientId,
		@Size(max = 500, message = "상태 변화는 500자까지 넣을 수 있습니다.") String statusChange,
		@Size(max = 500, message = "조치는 500자까지 넣을 수 있습니다.") String actionTaken,
		@Size(max = 500, message = "다음 행동은 500자까지 넣을 수 있습니다.") String nextAction,
		JobRole suggestedJobRole,
		LocalTime suggestedDueTime) {

	public String normalizedStatusChange() {
		return trimToNull(statusChange);
	}

	public String normalizedActionTaken() {
		return trimToNull(actionTaken);
	}

	public String normalizedNextAction() {
		return trimToNull(nextAction);
	}

	/** 공백만 남은 칸은 지운 것으로 본다. 화면에서 지우다 만 공백이 내용으로 저장되면 안 된다. */
	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
