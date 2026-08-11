package com.ieobom.api.handovercard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 카드 검토 · 수정 · 안전 표시 계약 확인. (Manyfast F-SNBVHR action · rules · dataSpec)
 *
 * <p>AI 를 거치지 않고 카드를 직접 만들어 둔다. 여기서 보는 것은 "AI 가 만든 카드를 직원이 어떻게 고치는가"이고, 무엇이 카드가 되는지는 {@code
 * HandoverCardApiTest} 와 {@code CardDraftVerifierTest} 가 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class HandoverCardReviewApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;

	private CareRecipient 김말순;
	private CareRecipient 박순자;
	private Handover 인계;

	@BeforeEach
	void setUp() {
		cards.deleteAll();
		handovers.deleteAll();

		List<CareRecipient> seeded = careRecipients.findAll();
		김말순 = seeded.get(0);
		박순자 = seeded.get(1);

		인계 =
				handovers.save(
						Handover.builder()
								.careRecipient(김말순)
								.rawText("점심을 거의 안 드셨어요.")
								.inputMethod(InputMethod.TEXT)
								.occurredAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(13, 10)))
								.reporterName("김요양")
								.proxyInput(false)
								.build());
	}

	@Test
	void 항목을_고치면_저장되고_근거_원문은_그대로다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, "저녁 식사량 확인", false);

		mockMvc
				.perform(
						put("/api/handover-cards/{id}", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "statusChange": "점심과 저녁 식사량 저하",
										  "actionTaken": "죽으로 바꿔 드림",
										  "nextAction": "저녁 식사량 확인",
										  "suggestedJobRole": "NURSE_AIDE",
										  "suggestedDueTime": "17:30"
										}
										"""
												.formatted(김말순.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.statusChange").value("점심과 저녁 식사량 저하"))
				.andExpect(jsonPath("$.actionTaken").value("죽으로 바꿔 드림"))
				.andExpect(jsonPath("$.suggestedJobRole").value("NURSE_AIDE"))
				.andExpect(jsonPath("$.suggestedDueTime").value("17:30"))
				.andExpect(jsonPath("$.evidenceText").value("점심을 거의 안 드셨어요"))
				.andExpect(jsonPath("$.reviewStatus").value("NEEDS_REVIEW"));

		assertThat(cards.findById(card.getId()))
				.get()
				.satisfies(
						saved -> {
							assertThat(saved.getActionTaken()).isEqualTo("죽으로 바꿔 드림");
							// 근거는 요청에 없는 값이다. 고칠 수 있는 자리를 두지 않았다.
							assertThat(saved.getEvidenceText()).isEqualTo("점심을 거의 안 드셨어요");
						});
	}

	@Test
	void 세_항목을_모두_비우면_보완할_항목을_모아_알려_준다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, null, false);

		mockMvc
				.perform(
						put("/api/handover-cards/{id}", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{"careRecipientId": %d, "statusChange": "   ", "actionTaken": null, "nextAction": null}
										"""
												.formatted(김말순.getId())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields.length()").value(3));

		assertThat(cards.findById(card.getId())).get().satisfies(
				saved -> assertThat(saved.getStatusChange()).isEqualTo("점심 식사량 저하"));
	}

	@Test
	void 다음_행동_없이_제안값만_지정하면_거부한다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, "저녁 식사량 확인", false);

		mockMvc
				.perform(
						put("/api/handover-cards/{id}", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{"careRecipientId": %d, "statusChange": "점심 식사량 저하", "suggestedJobRole": "NURSE_AIDE"}
										"""
												.formatted(김말순.getId())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("nextAction"));
	}

	@Test
	void 없는_카드를_고치려_하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(
						put("/api/handover-cards/{id}", 999999)
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"statusChange": "점심 식사량 저하"}
										"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("HANDOVER_CARD_NOT_FOUND"));
	}

	@Test
	void 목록에_없는_어르신을_지정하면_404_로_알려_준다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, null, false);

		mockMvc
				.perform(
						put("/api/handover-cards/{id}", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"careRecipientId": 999999, "statusChange": "점심 식사량 저하"}
										"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_FOUND"));
	}

	@Test
	void 어르신을_지정하면_검토_대상_카드가_확정된다() throws Exception {
		HandoverCard card = 카드(null, "점심 식사량 저하", null, null, false);

		mockMvc
				.perform(
						put("/api/handover-cards/{id}", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{"careRecipientId": %d, "statusChange": "점심 식사량 저하"}
										"""
												.formatted(박순자.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.careRecipientId").value(박순자.getId()))
				.andExpect(jsonPath("$.careRecipientName").value(박순자.getName()));

		// 확정된 뒤에는 검토 완료로 올릴 수 있다.
		mockMvc
				.perform(검토상태(card, "REVIEWED"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.exportAllowed").value(true));
	}

	@Test
	void 어르신을_가리지_못한_카드는_검토_완료로_올리지_못한다() throws Exception {
		HandoverCard card = 카드(null, "점심 식사량 저하", null, null, false);

		mockMvc
				.perform(검토상태(card, "REVIEWED"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_RESOLVED"));

		assertThat(cards.findById(card.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getReviewStatus()).isEqualTo(ReviewStatus.NEEDS_REVIEW));
	}

	@Test
	void 검토_완료로_올리면_문구를_만들_수_있다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, null, false);

		mockMvc
				.perform(검토상태(card, "REVIEWED"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reviewStatus").value("REVIEWED"))
				.andExpect(jsonPath("$.exportAllowed").value(true))
				.andExpect(jsonPath("$.exportBlockedReason").value(nullValue()));
	}

	@Test
	void 검토_필요로_되돌리면_문구를_만들_수_없다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, null, false);
		mockMvc.perform(검토상태(card, "REVIEWED")).andExpect(status().isOk());

		mockMvc
				.perform(검토상태(card, "NEEDS_REVIEW"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reviewStatus").value("NEEDS_REVIEW"))
				.andExpect(jsonPath("$.exportAllowed").value(false))
				.andExpect(jsonPath("$.exportBlockedReason").value("검토 완료 후 생성할 수 있습니다."));
	}

	@Test
	void 검토_완료_카드에서는_어르신을_비울_수_없다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, null, false);
		mockMvc.perform(검토상태(card, "REVIEWED")).andExpect(status().isOk());

		mockMvc
				.perform(
						put("/api/handover-cards/{id}", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"careRecipientId": null, "statusChange": "점심 식사량 저하"}
										"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_RESOLVED"));
	}

	@Test
	void 직원이_안전_표시를_켜면_판정_출처가_직원이_된다() throws Exception {
		HandoverCard card = 카드(김말순, "밤사이 잠을 못 주무심", null, null, false);

		mockMvc
				.perform(안전표시(card, true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.safetyRelated").value(true))
				.andExpect(jsonPath("$.safetyFlagSource").value("STAFF"));
	}

	@Test
	void 키워드로_잡힌_안전_표시를_직원이_끄면_판정_출처가_비워진다() throws Exception {
		HandoverCard card = 카드(김말순, "점심 식사량 저하", null, null, true);

		mockMvc
				.perform(안전표시(card, false))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.safetyRelated").value(false))
				.andExpect(jsonPath("$.safetyFlagSource").value(nullValue()));

		assertThat(cards.findById(card.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getSafetyFlagSource()).isNull());
	}

	private MockHttpServletRequestBuilder 검토상태(HandoverCard card, String reviewStatus) {
		return patch("/api/handover-cards/{id}/review-status", card.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"reviewStatus": "%s"}
						""".formatted(reviewStatus));
	}

	private MockHttpServletRequestBuilder 안전표시(HandoverCard card, boolean safetyRelated) {
		return patch("/api/handover-cards/{id}/safety", card.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"safetyRelated": %s}
						""".formatted(safetyRelated));
	}

	private HandoverCard 카드(
			CareRecipient careRecipient,
			String statusChange,
			String actionTaken,
			String nextAction,
			boolean safetyRelated) {
		return cards.save(
				HandoverCard.builder()
						.handover(인계)
						.careRecipient(careRecipient)
						.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
						.statusChange(statusChange)
						.actionTaken(actionTaken)
						.nextAction(nextAction)
						.evidenceText("점심을 거의 안 드셨어요")
						.safetyRelated(safetyRelated)
						.safetyFlagSource(safetyRelated ? SafetyFlagSource.KEYWORD : null)
						.reviewStatus(ReviewStatus.NEEDS_REVIEW)
						.suggestedJobRole(nextAction == null ? null : JobRole.CAREGIVER)
						.suggestedDueTime(nextAction == null ? null : LocalTime.of(17, 0))
						.build());
	}
}
