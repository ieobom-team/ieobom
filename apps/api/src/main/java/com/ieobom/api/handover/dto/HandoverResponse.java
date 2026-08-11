package com.ieobom.api.handover.dto;

import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.InfoSource;
import com.ieobom.api.handover.InputMethod;
import java.time.LocalDateTime;

/**
 * 저장된 현장 특이사항.
 *
 * <p>{@code reporterName} 과 {@code infoSource} 를 나란히 돌려준다. 대리 입력에서 누가 남겼는지와 누구에게서 나온 내용인지가 갈라져
 * 있다는 것을 응답에서 바로 확인할 수 있어야 한다.
 */
public record HandoverResponse(
		Long id,
		Long careRecipientId,
		String careRecipientName,
		String rawText,
		InputMethod inputMethod,
		LocalDateTime occurredAt,
		String reporterName,
		boolean proxyInput,
		InfoSource infoSource,
		LocalDateTime createdAt) {

	public static HandoverResponse from(Handover handover) {
		return new HandoverResponse(
				handover.getId(),
				handover.getCareRecipient().getId(),
				handover.getCareRecipient().getName(),
				handover.getRawText(),
				handover.getInputMethod(),
				handover.getOccurredAt(),
				handover.getReporterName(),
				handover.isProxyInput(),
				handover.getInfoSource(),
				handover.getCreatedAt());
	}
}
