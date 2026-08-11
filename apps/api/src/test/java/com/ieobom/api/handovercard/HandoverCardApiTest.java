package com.ieobom.api.handovercard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;

import com.ieobom.api.ai.StructuredCardDraft;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@code POST /api/handovers/{id}/cards} 와 {@code GET /api/handover-cards} 계약 확인.
 *
 * <p>AI 응답은 {@link StubStructuringClient} 로 고정한다. 여기서 보는 것은 "AI 가 준 것 중 무엇이 카드가 되어 어떻게 조회되는가"다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(StubStructuringClient.Config.class)
class HandoverCardApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private StubStructuringClient 구조화;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;

	private CareRecipient 첫번째;
	private CareRecipient 두번째;

	@BeforeEach
	void setUp() {
		// 같은 H2 를 여러 테스트가 함께 쓴다. 날짜 조회는 그날 만들어진 카드를 전부 보므로,
		// 앞 테스트가 남긴 카드가 있으면 어느 카드가 앞에 오는지가 테스트마다 달라진다.
		cards.deleteAll();
		handovers.deleteAll();

		List<CareRecipient> seeded = careRecipients.findAll();
		첫번째 = seeded.get(0);
		두번째 = seeded.get(1);
		구조화.willReturn(List.of());
	}

	@Test
	void 구조화하면_카드가_저장되고_안전_항목이_앞에_온다() throws Exception {
		Handover handover = 인계("점심을 거의 안 드셨어요. 오후에는 산책을 도와 드렸습니다.");
		구조화.willReturn(
				List.of(
						초안(첫번째.getName(), null, "산책을 도와 드림", null, "오후에는 산책을 도와 드렸습니다", "NONE"),
						초안(첫번째.getName(), "점심 식사량 저하", null, "저녁 식사량 확인", "점심을 거의 안 드셨어요",
								"POOR_INTAKE")));

		mockMvc
				.perform(post("/api/handovers/{id}/cards", handover.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.handoverId").value(handover.getId()))
				.andExpect(jsonPath("$.createdCount").value(2))
				.andExpect(jsonPath("$.discardedCount").value(0))
				.andExpect(jsonPath("$.cards[0].safetyRelated").value(true))
				.andExpect(jsonPath("$.cards[0].safetyFlagSource").value("KEYWORD"))
				.andExpect(jsonPath("$.cards[0].statusChange").value("점심 식사량 저하"))
				.andExpect(jsonPath("$.cards[0].evidenceText").value("점심을 거의 안 드셨어요"))
				.andExpect(jsonPath("$.cards[0].reviewStatus").value("NEEDS_REVIEW"))
				.andExpect(jsonPath("$.cards[1].safetyRelated").value(false))
				.andExpect(jsonPath("$.cards[1].safetyFlagSource").value(nullValue()));

		assertThat(cards.findByHandoverIdOrderByIdAsc(handover.getId())).hasSize(2);
	}

	@Test
	void 근거가_없는_항목은_카드가_되지_않는다() throws Exception {
		Handover handover = 인계("오늘 컨디션이 좋아 보이셨어요.");
		구조화.willReturn(
				List.of(
						초안(첫번째.getName(), "컨디션 양호", null, null, "오늘 컨디션이 좋아 보이셨어요", "NONE"),
						초안(첫번째.getName(), "혈압이 높음", null, "혈압약 확인", null, "NONE"),
						초안(첫번째.getName(), "열이 남", null, "체온 재확인", "밤사이 열이 났다고 하셨어요", "FEVER")));

		mockMvc
				.perform(post("/api/handovers/{id}/cards", handover.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.createdCount").value(1))
				.andExpect(jsonPath("$.discardedCount").value(2))
				.andExpect(jsonPath("$.cards[0].statusChange").value("컨디션 양호"));

		// 근거가 빈 항목과 원문에 없는 근거를 붙인 항목이 둘 다 사라졌다.
		assertThat(cards.findByHandoverIdOrderByIdAsc(handover.getId()))
				.singleElement()
				.satisfies(card -> assertThat(card.getEvidenceText()).isEqualTo("오늘 컨디션이 좋아 보이셨어요"));
	}

	@Test
	void 어르신을_가릴_수_없는_항목은_검토_대상으로_조회된다() throws Exception {
		Handover handover = 인계("두 분 다 점심을 거의 안 드셨어요.");
		구조화.willReturn(List.of(초안(null, "점심 식사량 저하", null, null, "두 분 다 점심을 거의 안 드셨어요", "POOR_INTAKE")));

		mockMvc
				.perform(post("/api/handovers/{id}/cards", handover.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.cards[0].careRecipientId").value(nullValue()))
				.andExpect(jsonPath("$.cards[0].reviewStatus").value("NEEDS_REVIEW"));

		mockMvc
				.perform(get("/api/handover-cards").param("date", LocalDate.now().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unresolved[?(@.evidenceText == '두 분 다 점심을 거의 안 드셨어요')]").exists());
	}

	@Test
	void 날짜로_조회하면_어르신별로_묶여_나온다() throws Exception {
		Handover 첫_인계 = 인계("점심을 거의 안 드셨어요.");
		구조화.willReturn(List.of(초안(첫번째.getName(), "점심 식사량 저하", null, null, "점심을 거의 안 드셨어요", "POOR_INTAKE")));
		mockMvc.perform(post("/api/handovers/{id}/cards", 첫_인계.getId())).andExpect(status().isCreated());

		Handover 두번째_인계 = 인계("오늘 걸음이 많이 불안하셨어요.");
		구조화.willReturn(List.of(초안(두번째.getName(), "보행 불안정", null, null, "오늘 걸음이 많이 불안하셨어요", "NONE")));
		mockMvc
				.perform(post("/api/handovers/{id}/cards", 두번째_인계.getId()))
				.andExpect(status().isCreated());

		mockMvc
				.perform(get("/api/handover-cards").param("date", LocalDate.now().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.date").value(LocalDate.now().toString()))
				.andExpect(jsonPath("$.recipients.length()").value(2))
				.andExpect(
						jsonPath("$.recipients[?(@.careRecipientId == %d)].cards[0].statusChange".formatted(첫번째.getId()))
								.value(hasItem("점심 식사량 저하")))
				.andExpect(
						jsonPath("$.recipients[?(@.careRecipientId == %d)].cards[0].statusChange".formatted(두번째.getId()))
								.value(hasItem("보행 불안정")));
	}

	@Test
	void 다른_날짜로_조회하면_비어_있다() throws Exception {
		Handover handover = 인계("점심을 거의 안 드셨어요.");
		구조화.willReturn(List.of(초안(첫번째.getName(), "점심 식사량 저하", null, null, "점심을 거의 안 드셨어요", "POOR_INTAKE")));
		mockMvc.perform(post("/api/handovers/{id}/cards", handover.getId())).andExpect(status().isCreated());

		mockMvc
				.perform(get("/api/handover-cards").param("date", LocalDate.now().minusDays(1).toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.recipients.length()").value(0))
				.andExpect(jsonPath("$.unresolved.length()").value(0));
	}

	@Test
	void 이미_구조화된_인계는_다시_구조화하지_않는다() throws Exception {
		Handover handover = 인계("점심을 거의 안 드셨어요.");
		구조화.willReturn(List.of(초안(첫번째.getName(), "점심 식사량 저하", null, null, "점심을 거의 안 드셨어요", "POOR_INTAKE")));
		mockMvc.perform(post("/api/handovers/{id}/cards", handover.getId())).andExpect(status().isCreated());

		mockMvc
				.perform(post("/api/handovers/{id}/cards", handover.getId()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("HANDOVER_ALREADY_STRUCTURED"));

		assertThat(cards.findByHandoverIdOrderByIdAsc(handover.getId())).hasSize(1);
	}

	@Test
	void 없는_인계를_구조화하려_하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(post("/api/handovers/{id}/cards", 999999))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("HANDOVER_NOT_FOUND"));
	}

	@Test
	void 구조화_요청에는_어르신_후보_목록과_원문이_함께_넘어간다() throws Exception {
		Handover handover = 인계("점심을 거의 안 드셨어요.");

		mockMvc.perform(post("/api/handovers/{id}/cards", handover.getId())).andExpect(status().isCreated());

		assertThat(구조화.lastInput().rawText()).isEqualTo("점심을 거의 안 드셨어요.");
		assertThat(구조화.lastInput().selectedRecipientName()).isEqualTo(첫번째.getName());
		assertThat(구조화.lastInput().candidateRecipientNames()).contains(첫번째.getName(), 두번째.getName());
	}

	private Handover 인계(String rawText) {
		return handovers.save(
				Handover.builder()
						.careRecipient(첫번째)
						.rawText(rawText)
						.inputMethod(InputMethod.TEXT)
						.occurredAt(LocalDateTime.of(LocalDate.now(), java.time.LocalTime.of(13, 10)))
						.reporterName("김요양")
						.proxyInput(false)
						.build());
	}

	private static StructuredCardDraft 초안(
			String recipientName,
			String statusChange,
			String actionTaken,
			String nextAction,
			String evidenceText,
			String safetyCategory) {
		return new StructuredCardDraft(
				recipientName,
				statusChange,
				actionTaken,
				nextAction,
				evidenceText,
				"UNKNOWN",
				null,
				null,
				safetyCategory);
	}
}
