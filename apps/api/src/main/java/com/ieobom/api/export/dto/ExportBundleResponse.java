package com.ieobom.api.export.dto;

import com.ieobom.api.export.ExportPhraseType;
import java.util.List;

/**
 * 어르신 한 명의 당일 문구를 유형별로 이어 붙인 묶음. (Manyfast F-GUSOFG action)
 *
 * <p><b>저장하지 않는다.</b> 조회 시점에 만든다. 저장하면 문구 하나가 여러 카드를 가리키게 되고, 그 문장이 원문 어디서 나왔는지 더 이상 말할 수 없다.
 * 그래서 이 응답에는 묶음의 식별자가 없다. 묶음을 다시 가리키려면 어르신과 날짜와 유형으로 다시 부른다.
 *
 * @param text 이어 붙인 문구 전체. 직원이 이것 하나를 복사한다. 담을 문구가 없으면 {@code null}
 * @param empty 이어 붙일 문구가 없었는지. 화면은 "묶음이 비었다"와 "묶을 문구가 있는데 못 만들었다"를 구분해야 한다
 * @param phraseCount 묶음에 실제로 들어간 문구 수
 * @param needsReview 복사 전에 확인할 것이 있는지. 포함된 문구 중 하나라도 안내가 붙었거나, 빠진 문구가 있으면 참
 * @param notice 직원에게 알릴 내용. 빈 묶음 안내와 검토 안내가 모두 여기로 온다. {@code empty} 와 {@code needsReview} 가 그
 *     성격을 가른다
 * @param phrases 묶음에 <b>실제로 들어간</b> 문구들. 각 항목이 자기 {@code cardId} 와 근거를 들고 있어 근거로 돌아갈 수 있다
 *     (Manyfast R-TUBGKD 수락기준 3)
 */
public record ExportBundleResponse(
		ExportPhraseType phraseType,
		String phraseTypeLabel,
		String text,
		boolean empty,
		int phraseCount,
		boolean needsReview,
		String notice,
		List<ExportPhraseResponse> phrases) {

	public static ExportBundleResponse of(
			ExportPhraseType phraseType,
			String text,
			boolean needsReview,
			String notice,
			List<ExportPhraseResponse> phrases) {

		return new ExportBundleResponse(
				phraseType,
				phraseType.label(),
				text,
				text == null,
				phrases.size(),
				needsReview,
				notice,
				phrases);
	}
}
