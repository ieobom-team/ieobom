package com.ieobom.api.export.dto;

import java.util.List;

/**
 * 카드 한 장의 출력 문구 전부.
 *
 * @param cardId 문구를 만든 카드
 * @param needsReview 두 문구 중 하나라도 복사 전에 확인할 것이 있는지. 화면은 이 값 하나로 상단 안내를 띄운다
 * @param phrases 전산 기록 문구와 보호자 전달 문구. <b>언제나 두 개다.</b> 하나가 만들어지지 못했어도 자리는 남는다
 */
public record ExportGenerateResponse(
		Long cardId, boolean needsReview, List<ExportPhraseResponse> phrases) {

	public static ExportGenerateResponse of(Long cardId, List<ExportPhraseResponse> phrases) {
		return new ExportGenerateResponse(
				cardId, phrases.stream().anyMatch(ExportPhraseResponse::needsReview), phrases);
	}
}
