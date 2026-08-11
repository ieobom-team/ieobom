package com.ieobom.api.handovercard;

import java.util.List;

/**
 * 검증 결과. 통과한 것과 버린 것을 함께 들고 있다.
 *
 * <p>버린 것을 세는 이유는 그것이 정상 동작이기 때문이다. 근거 없는 항목이 사라진 것과 AI 가 애초에 아무것도 못 만든 것은 다른 상황인데, 통과한 것만
 * 돌려주면 둘이 똑같이 "카드 0개"로 보인다.
 */
public record CardVerification(List<CardBlueprint> accepted, List<Discarded> discarded) {

	/** 항목을 버린 이유. */
	public enum DiscardReason {
		/** 근거 필드가 비어 있다. */
		NO_EVIDENCE("근거 원문 없음"),

		/** 근거라고 적은 구간이 원문에 없다. 지어낸 근거다. */
		EVIDENCE_NOT_IN_SOURCE("근거가 원문에 없음"),

		/** 변화·조치·다음 행동이 모두 비어 카드에 담을 내용이 없다. */
		NO_CONTENT("담을 내용 없음");

		private final String label;

		DiscardReason(String label) {
			this.label = label;
		}

		public String label() {
			return label;
		}
	}

	/**
	 * 버린 항목 하나.
	 *
	 * @param evidenceText 버릴 때 들고 있던 근거. 무엇이 왜 빠졌는지 로그로 확인하기 위한 값이다
	 */
	public record Discarded(String evidenceText, DiscardReason reason) {}
}
