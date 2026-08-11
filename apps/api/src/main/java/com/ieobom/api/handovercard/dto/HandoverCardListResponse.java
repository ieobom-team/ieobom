package com.ieobom.api.handovercard.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 하루치 카드 목록.
 *
 * <p>어르신별로 묶은 {@code recipients} 와, 대상을 가리지 못해 확정 카드가 되지 못한 {@code unresolved} 를 나눠서 내려준다. 둘을
 * 한 배열에 섞으면 화면이 "누구의 것인지 모르는 카드"를 어르신 목록 안에 그려야 한다.
 *
 * @param date 조회 기준일. 카드가 만들어진 날이다
 */
public record HandoverCardListResponse(
		LocalDate date, List<RecipientCards> recipients, List<HandoverCardResponse> unresolved) {

	/** 어르신 한 명과 그 어르신의 카드. */
	public record RecipientCards(
			Long careRecipientId, String careRecipientName, List<HandoverCardResponse> cards) {}
}
