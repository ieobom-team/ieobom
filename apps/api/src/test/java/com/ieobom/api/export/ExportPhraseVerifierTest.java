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
import org.springframework.test.util.ReflectionTestUtils;

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

	/**
	 * 문구를 만든 뒤 카드가 바뀌면, 문구는 옛 내용으로 얼어붙은 채 근거만 새것으로 바뀐다.
	 *
	 * <p>이 판정만 만드는 시점이 아니라 <b>읽는 시점</b>에 돈다. 그래서 저장된 안내와 합쳐서 나가는 모양을 여기서 본다.
	 */
	@Test
	void 문구를_만든_뒤_카드가_바뀌면_안내가_붙는다() {
		HandoverCard 카드 = 카드();
		ExportPhrase 문구 = 문구(카드, null);

		시각(문구, "verifiedAt", LocalDateTime.of(2026, 8, 12, 9, 0));
		시각(카드, "updatedAt", LocalDateTime.of(2026, 8, 12, 9, 30));

		assertThat(ExportPhraseVerifier.reviewNoticeOf(문구, 카드)).contains("카드가 바뀌었습니다");
	}

	@Test
	void 카드가_바뀌지_않았으면_안내가_붙지_않는다() {
		HandoverCard 카드 = 카드();
		ExportPhrase 문구 = 문구(카드, null);

		시각(카드, "updatedAt", LocalDateTime.of(2026, 8, 12, 9, 0));
		시각(문구, "verifiedAt", LocalDateTime.of(2026, 8, 12, 9, 30));

		assertThat(ExportPhraseVerifier.reviewNoticeOf(문구, 카드)).isNull();
	}

	/** 두 안내는 서로 다른 것을 말한다. 하나가 다른 하나를 덮으면 직원이 확인할 것 하나를 잃는다. */
	@Test
	void 만들_때_붙은_안내와_카드_변경_안내가_함께_나온다() {
		HandoverCard 카드 = 카드();
		ExportPhrase 문구 = 문구(카드, "카드에 없는 숫자(38)가 있습니다. 근거를 확인한 뒤 복사해 주세요.");

		시각(문구, "verifiedAt", LocalDateTime.of(2026, 8, 12, 9, 0));
		시각(카드, "updatedAt", LocalDateTime.of(2026, 8, 12, 9, 30));

		assertThat(ExportPhraseVerifier.reviewNoticeOf(문구, 카드)).contains("38").contains("카드가 바뀌었습니다");
	}

	/** 저장 전 엔티티에는 시각이 없다. 그래도 판정이 터지지 않고 "바뀌지 않았다"로 떨어져야 한다. */
	@Test
	void 시각을_알_수_없으면_바뀌지_않은_것으로_본다() {
		HandoverCard 카드 = 카드();

		assertThat(ExportPhraseVerifier.reviewNoticeOf(문구(카드, null), 카드)).isNull();
	}

	private ExportPhrase 문구(HandoverCard 카드, String 저장된_안내) {
		return ExportPhrase.builder()
				.handoverCard(카드)
				.phraseType(ExportPhraseType.RECORD)
				.generatedText("점심 식사량 저하 보이심.")
				.reviewNotice(저장된_안내)
				.build();
	}

	/**
	 * 생성·수정 시각은 JPA 라이프사이클 콜백이 채운다. DB 없이 판정만 보려면 여기서 직접 넣는 수밖에 없다.
	 *
	 * <p>{@code updatedAt} 은 {@code BaseTimeEntity} 에 있어 상위 타입까지 훑어야 찾힌다.
	 */
	private void 시각(Object 대상, String 필드, LocalDateTime 값) {
		ReflectionTestUtils.setField(대상, 필드, 값);
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
