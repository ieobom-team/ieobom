package com.ieobom.api.recipient.dto;

import com.ieobom.api.recipient.CareRecipient;
import java.time.LocalDateTime;

/**
 * 어르신 한 명.
 *
 * <p>입력 화면이 대상을 고를 때, 명단 화면이 등록된 어르신을 그릴 때 쓴다. {@code id} 는 {@code POST /api/handovers} 의
 * {@code careRecipientId} 로 그대로 넘어간다.
 *
 * @param id 서버가 발급한 식별자
 * @param name 이름
 * @param code 내부 ID. 동명이인을 화면에서 구분하고, 실명을 대신해 LLM 요청에 나간다
 * @param dischargedAt 이용 종료 시점. 이용 중이면 {@code null}
 */
public record CareRecipientResponse(
		Long id, String name, String code, LocalDateTime dischargedAt) {

	public static CareRecipientResponse from(CareRecipient careRecipient) {
		return new CareRecipientResponse(
				careRecipient.getId(),
				careRecipient.getName(),
				careRecipient.getCode(),
				careRecipient.getDischargedAt());
	}
}
