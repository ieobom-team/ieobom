package com.ieobom.api.handovercard;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * 카드가 스스로 지키는 규칙. DB 도 HTTP 도 없이 본다.
 *
 * <p>문구 생성 허용 판정은 {@code #17} 문구 생성 API 가 그대로 다시 쓴다. 조건이 양쪽에 흩어지지 않는지를 여기서 못 박아 둔다.
 */
class HandoverCardTest {

	@Test
	void 검토가_끝나지_않은_카드로는_문구를_만들_수_없고_이유가_붙는다() {
		HandoverCard card = 카드(ReviewStatus.NEEDS_REVIEW);

		assertThat(card.canGenerateExport()).isFalse();
		assertThat(card.exportBlockedReason()).isEqualTo("검토 완료 후 생성할 수 있습니다.");
	}

	@Test
	void 검토가_끝난_카드로는_문구를_만들_수_있다() {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);

		assertThat(card.canGenerateExport()).isTrue();
		assertThat(card.exportBlockedReason()).isNull();
	}

	@Test
	void 직원이_안전_표시를_켜면_출처가_직원이고_끄면_비워진다() {
		HandoverCard card = 카드(ReviewStatus.NEEDS_REVIEW);

		card.markSafety(true);
		assertThat(card.isSafetyRelated()).isTrue();
		assertThat(card.getSafetyFlagSource()).isEqualTo(SafetyFlagSource.STAFF);

		card.markSafety(false);
		assertThat(card.isSafetyRelated()).isFalse();
		// 안전 항목이 아니게 됐으므로 판정 출처가 남아 있으면 안 된다.
		assertThat(card.getSafetyFlagSource()).isNull();
	}

	private HandoverCard 카드(ReviewStatus reviewStatus) {
		return HandoverCard.builder()
				.statusChange("점심 식사량 저하")
				.evidenceText("점심을 거의 안 드셨어요")
				.reviewStatus(reviewStatus)
				.build();
	}
}
