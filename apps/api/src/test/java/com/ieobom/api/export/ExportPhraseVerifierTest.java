package com.ieobom.api.export;

import static org.assertj.core.api.Assertions.assertThat;

import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.recipient.CareRecipient;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 문구를 복사해도 되는지 판정하는 규칙. <b>LLM 도 DB 도 없이 직접 증명한다.</b>
 *
 * <p>{@code CardDraftVerifierTest} 와 같은 이유다. 보호자에게 나가는 문구에 없는 사실이 섞이는 것이 이 제품에서 가장 위험한 결과이므로, 그
 * 판정만은 Spring 컨텍스트나 모델 응답에 기대지 않고 확인할 수 있어야 한다.
 */
class ExportPhraseVerifierTest {

	private static final List<String> 다른_어르신 = List.of("박순자", "이영순");

	private final ExportPhraseVerifier verifier = new ExportPhraseVerifier();

	@Test
	void 카드에_있는_내용만_담은_문구는_안내가_없다() {
		PhraseVerification 결과 =
				verifier.verify("12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림.", 카드(), 다른_어르신);

		assertThat(결과.text()).isEqualTo("12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림.");
		assertThat(결과.needsReview()).isFalse();
		assertThat(결과.reviewNotice()).isNull();
	}

	@Test
	void 문구가_비면_본문_없이_검토_안내만_남는다() {
		PhraseVerification 결과 = verifier.verify("   ", 카드(), 다른_어르신);

		assertThat(결과.text()).as("복사할 것이 없다").isNull();
		assertThat(결과.needsReview()).isTrue();
		assertThat(결과.reviewNotice()).contains("직접 작성");
	}

	@Test
	void 문구가_null_이어도_같은_안내를_단다() {
		PhraseVerification 결과 = verifier.verify(null, 카드(), 다른_어르신);

		assertThat(결과.text()).isNull();
		assertThat(결과.needsReview()).isTrue();
	}

	@Test
	void 카드에_없는_숫자가_있으면_근거_확인을_안내한다() {
		// 카드 어디에도 38 도가 없다. 지어낸 사실은 대개 이렇게 숫자로 나타난다.
		PhraseVerification 결과 = verifier.verify("체온 38도로 확인되어 안정 취하도록 함.", 카드(), 다른_어르신);

		assertThat(결과.text()).as("버리지 않고 직원에게 넘긴다").isNotNull();
		assertThat(결과.needsReview()).isTrue();
		assertThat(결과.reviewNotice()).contains("38");
	}

	@Test
	void 다른_어르신_이름이_섞이면_안내한다() {
		PhraseVerification 결과 = verifier.verify("김말순 어르신과 박순자 어르신 모두 식사량이 줄었음.", 카드(), 다른_어르신);

		assertThat(결과.needsReview()).isTrue();
		assertThat(결과.reviewNotice()).contains("박순자");
	}

	@Test
	void 길이_제한을_넘으면_자르고_안내한다() {
		PhraseVerification 결과 =
				verifier.verify("가".repeat(ExportPhraseVerifier.TEXT_LIMIT + 10), 카드(), 다른_어르신);

		assertThat(결과.text()).hasSize(ExportPhraseVerifier.TEXT_LIMIT);
		assertThat(결과.needsReview()).isTrue();
		assertThat(결과.reviewNotice()).contains("잘렸");
	}

	@Test
	void 걸린_사유가_여럿이면_모두_안내한다() {
		PhraseVerification 결과 = verifier.verify("박순자 어르신 체온 38도.", 카드(), 다른_어르신);

		assertThat(결과.reviewNotice()).contains("38").contains("박순자");
	}

	/** 어르신을 아직 가리지 못한 카드는 검토 완료가 되지 못하므로 문구까지 오지 않는다. 그래도 판정이 터지지는 않아야 한다. */
	@Test
	void 어르신이_없는_카드에서도_판정이_돈다() {
		HandoverCard 카드 =
				HandoverCard.builder()
						.handover(인계())
						.statusChange("점심 식사량 저하")
						.evidenceText("점심을 거의 안 드셨어요")
						.reviewStatus(ReviewStatus.NEEDS_REVIEW)
						.build();

		PhraseVerification 결과 = verifier.verify("점심 식사량 저하 보이심.", 카드, 다른_어르신);

		assertThat(결과.needsReview()).isFalse();
	}

	private HandoverCard 카드() {
		return HandoverCard.builder()
				.handover(인계())
				.careRecipient(CareRecipient.builder().name("김말순").code("L-001").build())
				.observedAt(LocalDateTime.of(2026, 8, 11, 12, 40))
				.statusChange("점심 식사량 저하")
				.actionTaken("죽으로 바꿔 드림")
				.evidenceText("점심을 거의 안 드셨어요")
				.reviewStatus(ReviewStatus.REVIEWED)
				.build();
	}

	private Handover 인계() {
		return Handover.builder()
				.careRecipient(CareRecipient.builder().name("김말순").code("L-001").build())
				.rawText("점심을 거의 안 드셨어요.")
				.inputMethod(InputMethod.TEXT)
				.occurredAt(LocalDateTime.of(2026, 8, 11, 13, 10))
				.reporterName("김요양")
				.proxyInput(false)
				.build();
	}
}
