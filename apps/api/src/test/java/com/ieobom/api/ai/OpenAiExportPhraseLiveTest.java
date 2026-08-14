package com.ieobom.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.ieobom.api.export.ExportPhraseVerifier;
import com.ieobom.api.export.PhraseVerification;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.RecipientAliases;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 진짜 LLM 을 불러서 문구 생성 계약이 살아 있는지 확인한다.
 *
 * <p>{@code OpenAiStructuringLiveTest} 와 같은 이유로 기본 빌드에서 제외돼 있다.
 *
 * <pre>
 *   ./gradlew llmLiveTest          (LLM_API_KEY 가 잡혀 있어야 한다)
 * </pre>
 *
 * <p>이 클래스의 호출은 2회다. 모델이 만드는 문장은 매번 다르므로 <b>문구를 단정하지 않는다.</b> 대신 stub 으로는 확인할 수 없는 것만 본다.
 *
 * <ul>
 *   <li>스키마가 실제로 걸려 두 문구가 함께 오는지 — 스키마가 잘못 생겼으면 여기서만 드러난다
 *   <li>카드에 없는 값을 지어내지 않는지 — {@link ExportPhraseVerifier} 로 판정한다
 *   <li>의료적 판단을 덧붙이지 않는지
 * </ul>
 */
@Tag("llm-live")
@EnabledIfEnvironmentVariable(
		named = "LLM_API_KEY",
		matches = ".+",
		disabledReason = "LLM_API_KEY 가 없어 실호출 확인을 건너뛴다.")
@SpringBootTest
class OpenAiExportPhraseLiveTest {

	private static final List<String> 다른_어르신 = List.of("박순자", "이영순");

	/** 문구 생성도 구조화와 같은 대조표를 거친다. 실명은 모델에 가지 않는다. (Manyfast F-LUDCWW rules) */
	private static final RecipientAliases 대조표 =
			RecipientAliases.of(
					List.of(
							CareRecipient.builder().name("김말순").code("IB-001").build(),
							CareRecipient.builder().name("박순자").code("IB-002").build(),
							CareRecipient.builder().name("이영순").code("IB-003").build()));

	@Autowired private ExportPhraseClient client;

	private final ExportPhraseVerifier verifier = new ExportPhraseVerifier();

	@Test
	void 카드_하나에서_두_문구가_나오고_카드에_없는_값을_만들지_않는다() {
		HandoverCard 카드 =
				카드("점심 식사량 저하", "죽으로 바꿔 드림", "저녁 식사량 확인", "점심을 거의 안 드셨어요");

		ExportPhraseDraft draft = 복원한(client.generate(입력(카드)));

		assertThat(draft.recordPhrase()).as("전산 기록 문구가 비면 안 된다").isNotBlank();
		assertThat(draft.guardianPhrase()).as("보호자 전달 문구가 비면 안 된다").isNotBlank();
		assertThat(draft.recordPhrase())
				.as("두 문구는 읽는 사람이 다르므로 같은 문장을 돌려 쓰면 안 된다")
				.isNotEqualTo(draft.guardianPhrase());

		PhraseVerification 기록 = verifier.verify(draft.recordPhrase(), 카드, 다른_어르신);
		PhraseVerification 보호자 = verifier.verify(draft.guardianPhrase(), 카드, 다른_어르신);

		assertThat(기록.needsReview())
				.as("카드에 없는 값을 지어냈다 — %s / 문구: %s", 기록.reviewNotice(), draft.recordPhrase())
				.isFalse();
		assertThat(보호자.needsReview())
				.as("카드에 없는 값을 지어냈다 — %s / 문구: %s", 보호자.reviewNotice(), draft.guardianPhrase())
				.isFalse();
	}

	@Test
	void 발열_카드에서_의료_판단을_덧붙이지_않는다() {
		HandoverCard 카드 =
				카드("오전에 미열 있으심", "이마 짚어 보고 안정 취하도록 함", "보호자께 연락", "오전에 열이 좀 있는 것 같았어요");

		ExportPhraseDraft draft = 복원한(client.generate(입력(카드)));

		assertThat(draft.recordPhrase()).isNotBlank();
		assertThat(draft.guardianPhrase()).isNotBlank();

		// 원인 추정·진단·투약 권고는 이 제품이 만들지 않기로 한 것이다. (Manyfast F-GUSOFG rules)
		assertThat(draft.recordPhrase() + " " + draft.guardianPhrase())
				.as("진단·처방·복용 권고를 만들면 안 된다")
				.doesNotContain("처방", "진단", "복용", "감염", "의심됩니다");

		// 체온을 재지 않았는데 숫자가 나오면 지어낸 것이다. 가장 위험한 형태의 hallucination 이다.
		PhraseVerification 기록 = verifier.verify(draft.recordPhrase(), 카드, 다른_어르신);
		PhraseVerification 보호자 = verifier.verify(draft.guardianPhrase(), 카드, 다른_어르신);

		assertThat(기록.needsReview())
				.as("재지 않은 체온을 만들었다 — %s / 문구: %s", 기록.reviewNotice(), draft.recordPhrase())
				.isFalse();
		assertThat(보호자.needsReview())
				.as("재지 않은 체온을 만들었다 — %s / 문구: %s", 보호자.reviewNotice(), draft.guardianPhrase())
				.isFalse();
	}

	/** 서비스와 같다. 어르신은 내부 ID로, 나머지 칸도 치환해서 넘긴다. */
	private ExportInput 입력(HandoverCard 카드) {
		return new ExportInput(
				카드.getCareRecipient().getCode(),
				카드.getObservedAt(),
				대조표.mask(카드.getStatusChange()),
				대조표.mask(카드.getActionTaken()),
				대조표.mask(카드.getNextAction()),
				대조표.mask(카드.getEvidenceText()));
	}

	/** 서비스와 같다. 응답을 받은 자리에서 곧바로 되돌리고, 판정은 실명으로 된 문구에 한다. */
	private ExportPhraseDraft 복원한(ExportPhraseDraft draft) {
		return new ExportPhraseDraft(
				대조표.restore(draft.recordPhrase()), 대조표.restore(draft.guardianPhrase()));
	}

	/** 검토 완료 카드 한 장. 문구 생성은 DB 를 거치지 않으므로 저장하지 않는다. */
	private HandoverCard 카드(
			String statusChange, String actionTaken, String nextAction, String evidenceText) {
		CareRecipient 김말순 = CareRecipient.builder().name("김말순").code("IB-001").build();
		return HandoverCard.builder()
				.handover(
						Handover.builder()
								.careRecipient(김말순)
								.rawText(evidenceText)
								.inputMethod(InputMethod.TEXT)
								.occurredAt(LocalDateTime.of(2026, 8, 11, 13, 10))
								.reporterName("김요양")
								.proxyInput(false)
								.build())
				.careRecipient(김말순)
				.observedAt(LocalDateTime.of(2026, 8, 11, 12, 40))
				.statusChange(statusChange)
				.actionTaken(actionTaken)
				.nextAction(nextAction)
				.evidenceText(evidenceText)
				.reviewStatus(ReviewStatus.REVIEWED)
				.build();
	}
}
