package com.ieobom.api.handover.dto;

import com.ieobom.api.handover.InfoSource;
import com.ieobom.api.handover.InputMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 현장 특이사항 등록 요청.
 *
 * <p>대상 어르신 · 원문 · 입력 방식 · 입력 시점 · 입력자 식별이 필수이고, 대리 입력 여부와 정보 출처는 선택이다. (Manyfast F-YJJJUX
 * dataSpec)
 *
 * @param careRecipientId 대상 어르신. 입력 시 반드시 고른다
 * @param rawText 입력 원문. 요약하거나 다듬지 않고 그대로 저장된다
 * @param inputMethod 음성 · 텍스트 · 체크 중 하나
 * @param occurredAt 특이사항이 있었던 시점. 저장 시각과 다를 수 있다
 * @param reporterName 입력자 이름. 로그인이 없으므로 진입 시 고른 직원 식별을 그대로 받는다
 * @param proxyInput 다른 사람에게 들은 내용을 대신 남기는지 여부. 생략하면 직접 입력으로 본다
 * @param infoSource 대리 입력일 때 그 내용을 실제로 전한 사람
 */
public record HandoverCreateRequest(
		@NotNull(message = "대상 어르신을 선택해 주세요.") Long careRecipientId,
		@NotBlank(message = "입력 내용을 남겨 주세요.")
				@Size(max = 2000, message = "입력 내용은 2000자까지 남길 수 있습니다.")
				String rawText,
		@NotNull(message = "입력 방식을 선택해 주세요.") InputMethod inputMethod,
		@NotNull(message = "입력 시점을 입력해 주세요.") LocalDateTime occurredAt,
		@NotBlank(message = "입력자를 선택해 주세요.")
				@Size(max = 50, message = "입력자 이름은 50자까지 넣을 수 있습니다.")
				String reporterName,
		Boolean proxyInput,
		InfoSource infoSource) {

	/** 생략된 대리 입력 여부는 직접 입력으로 본다. */
	public boolean isProxyInput() {
		return Boolean.TRUE.equals(proxyInput);
	}
}
