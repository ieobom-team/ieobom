package com.ieobom.api.recipient.dto;

import com.ieobom.api.recipient.CareRecipient;

/**
 * 어르신 한 명.
 *
 * <p>입력 화면이 대상을 고를 때 쓴다. {@code id} 는 {@code POST /api/handovers} 의 {@code careRecipientId} 로
 * 그대로 넘어간다.
 *
 * @param id 서버가 발급한 식별자
 * @param name 이름
 * @param code 센터 내 식별번호. 동명이인을 화면에서 구분한다
 */
public record CareRecipientResponse(Long id, String name, String code) {

	public static CareRecipientResponse from(CareRecipient careRecipient) {
		return new CareRecipientResponse(
				careRecipient.getId(), careRecipient.getName(), careRecipient.getCode());
	}
}
