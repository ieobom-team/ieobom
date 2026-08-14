package com.ieobom.api.handovercard;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * AI 추천 액션 칩 하나. (Manyfast F-SNBVHR action · display — RFC #62 방향 A)
 *
 * <p>근거 원문은 여기 저장하지 않는다. {@link CardDraftVerifier} 가 검증에만 쓰고 버리므로, 검증을 통과한 뒤에는 "어느 칸에 채울
 * 어떤 문구인가"만 남는다. 카드의 다른 항목은 이미 자기 근거({@code evidenceText})를 따로 갖고 있어, 칩까지 근거를 들고 있으면 같은
 * 근거를 두 곳에서 보여줄 이유 없이 저장만 하게 된다.
 */
@Getter
@Embeddable
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SuggestedAction {

	/** 탭하면 채워질 칸. */
	@Enumerated(EnumType.STRING)
	@Column(name = "target_field", length = 20, nullable = false)
	private CardField targetField;

	/** 칩에 보일 짧은 문장이자, 탭했을 때 채워질 값. */
	@Column(nullable = false, length = 500)
	private String text;

	private SuggestedAction(CardField targetField, String text) {
		this.targetField = targetField;
		this.text = text;
	}

	public static SuggestedAction of(CardField targetField, String text) {
		return new SuggestedAction(targetField, text);
	}
}
