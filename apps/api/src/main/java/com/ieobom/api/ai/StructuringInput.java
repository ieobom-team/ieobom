package com.ieobom.api.ai;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 구조화 요청 한 건. <b>여기 담긴 값은 그대로 LLM 으로 나간다.</b>
 *
 * <p>그래서 어르신은 실명이 아니라 내부 ID로만 담는다. 원문도 손대지 않은 그대로가 아니라 <b>등록된 실명을 내부 ID로 바꾼 뒤</b>의 문자열이다.
 * 이름 칸만 바꾸고 원문을 그대로 보내면 실명은 원문에 실려 그대로 나간다. 치환은 {@code RecipientAliases} 가 하고, 부르는 쪽이 이 레코드를
 * 만들기 전에 끝내 둔다. (Manyfast F-LUDCWW rules)
 *
 * @param maskedRawText 등록된 실명을 내부 ID로 바꾼 인계 원문
 * @param occurredAt 특이사항이 있었던 시점. 제안 기한과 관찰 시각의 기준이 된다
 * @param selectedRecipientCode 입력할 때 직원이 고른 어르신의 내부 ID
 * @param candidateRecipientCodes 고를 수 있는 어르신의 내부 ID 전체. 이 목록 밖의 ID는 뒤에서 버린다
 */
public record StructuringInput(
		String maskedRawText,
		LocalDateTime occurredAt,
		String selectedRecipientCode,
		List<String> candidateRecipientCodes) {}
