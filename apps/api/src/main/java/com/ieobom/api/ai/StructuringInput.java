package com.ieobom.api.ai;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 구조화 요청 한 건.
 *
 * @param rawText 인계 원문. 손대지 않은 그대로 넣는다
 * @param occurredAt 특이사항이 있었던 시점. 제안 기한과 관찰 시각의 기준이 된다
 * @param selectedRecipientName 입력할 때 직원이 고른 어르신 이름
 * @param candidateRecipientNames 고를 수 있는 어르신 이름 전체. 이 목록 밖의 이름은 뒤에서 버린다
 */
public record StructuringInput(
		String rawText,
		LocalDateTime occurredAt,
		String selectedRecipientName,
		List<String> candidateRecipientNames) {}
