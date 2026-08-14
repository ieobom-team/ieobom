package com.ieobom.api.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.ai.ExportInput;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.handovercard.SafetyFlagSource;
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
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 문구 생성 · 수정 · 복사 계약 확인. (Manyfast F-GUSOFG)
 *
 * <p>AI 응답은 {@link StubExportPhraseClient} 로 고정한다. 여기서 보는 것은 "AI 가 준 문구가 어떤 조건에서 만들어지고, 무엇이 검토
 * 안내를 달고 나가며, 직원의 수정과 복사가 어떻게 남는가"다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(StubExportPhraseClient.Config.class)
class ExportApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private StubExportPhraseClient 문구생성;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private ExportPhraseRepository phrases;

	private CareRecipient 김말순;
	private CareRecipient 박순자;
	private Handover 인계;

	@BeforeEach
	void setUp() {
		phrases.deleteAll();
		cards.deleteAll();
		handovers.deleteAll();
		문구생성.reset();

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
	void 검토_완료_카드에서_두_가지_문구가_만들어진다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림.", "점심 식사량이 줄어 죽으로 바꿔 드렸습니다.");

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.cardId").value(card.getId()))
				.andExpect(jsonPath("$.needsReview").value(false))
				.andExpect(jsonPath("$.phrases.length()").value(2))
				.andExpect(jsonPath("$.phrases[0].phraseType").value("RECORD"))
				.andExpect(jsonPath("$.phrases[0].phraseTypeLabel").value("전산 기록 문구"))
				.andExpect(jsonPath("$.phrases[0].text").value("12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림."))
				.andExpect(jsonPath("$.phrases[0].edited").value(false))
				.andExpect(jsonPath("$.phrases[0].copiedAt").value(nullValue()))
				.andExpect(jsonPath("$.phrases[1].phraseType").value("GUARDIAN"))
				.andExpect(jsonPath("$.phrases[1].phraseTypeLabel").value("보호자 전달 문구"))
				.andExpect(jsonPath("$.phrases[1].text").value("점심 식사량이 줄어 죽으로 바꿔 드렸습니다."));

		assertThat(phrases.findByHandoverCardIdOrderByIdAsc(card.getId()))
				.extracting(ExportPhrase::getPhraseType)
				.containsExactly(ExportPhraseType.RECORD, ExportPhraseType.GUARDIAN);
	}

	@Test
	void 문구는_원본_인계_정보와의_연결을_유지한다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated())
				// 문구 하나만 떼어 봐도 근거로 돌아갈 수 있어야 한다. (Manyfast R-TUBGKD 수락기준 3)
				.andExpect(jsonPath("$.phrases[0].cardId").value(card.getId()))
				.andExpect(jsonPath("$.phrases[0].handoverId").value(인계.getId()))
				.andExpect(jsonPath("$.phrases[0].careRecipientId").value(김말순.getId()))
				.andExpect(jsonPath("$.phrases[0].careRecipientName").value(김말순.getName()))
				.andExpect(jsonPath("$.phrases[0].evidenceText").value("점심을 거의 안 드셨어요"));
	}

	@Test
	void 카드_내용만_모델에_넘기고_인계_원문은_넘기지_않는다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()));

		assertThat(문구생성.lastInput()).isNotNull();
		assertThat(문구생성.lastInput().careRecipientCode()).isEqualTo(김말순.getCode());
		assertThat(문구생성.lastInput().statusChange()).isEqualTo("점심 식사량 저하");
		assertThat(문구생성.lastInput().evidenceText()).isEqualTo("점심을 거의 안 드셨어요");
	}

	/**
	 * 이 호출 지점의 요청 페이로드에 어르신 실명이 없다는 것을 확인한다.
	 *
	 * <p>구조화와 같은 KPI 다. 어르신 칸만 보지 않는다. 근거 원문은 인계 원문에서 잘라 온 구간이고 상태·조치 칸은 직원이 고칠 수 있어서, 어느
	 * 칸에나 이름이 섞일 수 있다. (Manyfast F-LUDCWW rules)
	 */
	@Test
	void 문구_생성_요청_페이로드에_어르신_실명이_없다() throws Exception {
		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(인계)
								.careRecipient(김말순)
								.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
								.statusChange("%s 어르신 점심 식사량 저하".formatted(김말순.getName()))
								.actionTaken("죽으로 바꿔 드림")
								.nextAction("%s 어르신도 저녁 식사량 확인".formatted(박순자.getName()))
								.evidenceText("%s 어르신이 점심을 거의 안 드셨어요".formatted(김말순.getName()))
								.safetyRelated(true)
								.safetyFlagSource(SafetyFlagSource.KEYWORD)
								.reviewStatus(ReviewStatus.REVIEWED)
								.build());
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()));

		ExportInput 요청 = 문구생성.lastInput();
		String 나가는_값 =
				String.join(
						" ",
						요청.careRecipientCode(),
						요청.statusChange(),
						요청.actionTaken(),
						요청.nextAction(),
						요청.evidenceText());

		assertThat(careRecipients.findAll())
				.isNotEmpty()
				.allSatisfy(어르신 -> assertThat(나가는_값).doesNotContain(어르신.getName()));
		assertThat(요청.evidenceText()).contains(김말순.getCode());
		assertThat(요청.nextAction()).contains(박순자.getCode());
	}

	/**
	 * 치환된 문구를 실명으로 되돌린 뒤에 판정하고 저장한다.
	 *
	 * <p>보호자 전달 문구는 사람이 읽고 그대로 복사하는 글이라 이름이 있어야 말이 된다. 되돌리지 않고 저장하면 내부 ID 안의 숫자가 "카드에 없는
	 * 숫자"로 잡히고, 직원이 화면에서 고친 문구만 실명이 되어 저장된 형식이 갈린다.
	 */
	@Test
	void 치환된_문구를_실명으로_되돌려_저장한다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn(
				"%s 어르신 점심 식사량 저하 보이심.".formatted(김말순.getCode()),
				"%s 어르신 점심 식사량이 줄었습니다.".formatted(김말순.getCode()));

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.phrases[0].text").value("%s 어르신 점심 식사량 저하 보이심.".formatted(김말순.getName())))
				.andExpect(jsonPath("$.phrases[1].text").value("%s 어르신 점심 식사량이 줄었습니다.".formatted(김말순.getName())))
				// 내부 ID 의 숫자가 "카드에 없는 숫자"로 잡히지 않는다.
				.andExpect(jsonPath("$.needsReview").value(false));
	}

	@Test
	void 검토_필요_카드에서는_문구를_만들지_않는다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.NEEDS_REVIEW);

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("CARD_NOT_REVIEWED"))
				.andExpect(jsonPath("$.message").value("검토 완료 후 생성할 수 있습니다."));

		assertThat(문구생성.callCount()).as("거부된 요청으로 크레딧이 나가면 안 된다").isZero();
		assertThat(phrases.findByHandoverCardIdOrderByIdAsc(card.getId())).isEmpty();
	}

	@Test
	void 없는_카드로_문구를_만들려_하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", 999999))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("HANDOVER_CARD_NOT_FOUND"));
	}

	@Test
	void 이미_만들어_둔_문구가_있으면_다시_만들지_않는다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");
		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated());

		Long 처음_문구_id = phrases.findByHandoverCardIdOrderByIdAsc(card.getId()).get(0).getId();
		문구생성.willReturn("다시 만든 문구", "다시 만든 보호자 문구");

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.phrases[0].id").value(처음_문구_id))
				.andExpect(jsonPath("$.phrases[0].text").value("점심 식사량 저하 보이심."));

		assertThat(문구생성.callCount()).as("모델을 다시 부르지 않는다").isEqualTo(1);
		assertThat(phrases.findByHandoverCardIdOrderByIdAsc(card.getId())).hasSize(2);
	}

	@Test
	void 근거에_없는_숫자가_섞이면_복사_전_검토를_안내한다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		// 카드 어디에도 38 도가 없다.
		문구생성.willReturn("체온 38도로 확인됨.", "점심 식사량이 줄었습니다.");

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.needsReview").value(true))
				.andExpect(jsonPath("$.phrases[0].needsReview").value(true))
				.andExpect(jsonPath("$.phrases[0].reviewNotice").value(containsString("38")))
				.andExpect(jsonPath("$.phrases[1].needsReview").value(false));
	}

	@Test
	void 문구가_만들어지지_않으면_직접_작성하도록_안내한다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("", "");

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.needsReview").value(true))
				.andExpect(jsonPath("$.phrases[0].text").value(nullValue()))
				.andExpect(jsonPath("$.phrases[0].reviewNotice").value(containsString("직접 작성")));
	}

	@Test
	void 문구를_만들_수_없으면_아무것도_저장하지_않고_503_으로_알린다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willFail();

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("LLM_UNAVAILABLE"));

		assertThat(phrases.findByHandoverCardIdOrderByIdAsc(card.getId())).isEmpty();
	}

	@Test
	void 직원이_고친_문구가_저장되고_AI_원문은_남는다() throws Exception {
		ExportPhrase 문구 = 생성된_문구("체온 38도로 확인됨.", "점심 식사량이 줄었습니다.").get(0);

		mockMvc
				.perform(
						put("/api/exports/{id}", 문구.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"text": "점심 식사량 저하 보이심. 죽으로 바꿔 드림."}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.text").value("점심 식사량 저하 보이심. 죽으로 바꿔 드림."))
				.andExpect(jsonPath("$.generatedText").value("체온 38도로 확인됨."))
				.andExpect(jsonPath("$.edited").value(true))
				// 직원이 고쳐서 안내 사유가 사라졌다.
				.andExpect(jsonPath("$.needsReview").value(false))
				.andExpect(jsonPath("$.reviewNotice").value(nullValue()));

		assertThat(phrases.findById(문구.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getGeneratedText()).isEqualTo("체온 38도로 확인됨."));
	}

	@Test
	void 직원이_고친_문구도_같은_기준으로_다시_본다() throws Exception {
		ExportPhrase 문구 = 생성된_문구("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.").get(0);

		mockMvc
				.perform(
						put("/api/exports/{id}", 문구.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{"text": "%s 어르신도 함께 식사량이 줄었음."}
										"""
												.formatted(박순자.getName())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.needsReview").value(true))
				.andExpect(jsonPath("$.reviewNotice").value(containsString(박순자.getName())));
	}

	@Test
	void 빈_문구로는_고칠_수_없다() throws Exception {
		ExportPhrase 문구 = 생성된_문구("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.").get(0);

		mockMvc
				.perform(
						put("/api/exports/{id}", 문구.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"text": "   "}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("text"));
	}

	@Test
	void 없는_문구를_고치려_하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(
						put("/api/exports/{id}", 999999)
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"text": "점심 식사량 저하 보이심."}
										"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("EXPORT_PHRASE_NOT_FOUND"));
	}

	@Test
	void 복사하면_유형과_복사_시점이_남는다() throws Exception {
		ExportPhrase 문구 = 생성된_문구("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.").get(1);

		mockMvc
				.perform(post("/api/exports/{id}/copy", 문구.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.phraseType").value("GUARDIAN"))
				.andExpect(jsonPath("$.copiedAt").isNotEmpty());

		assertThat(phrases.findById(문구.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getCopiedAt()).isNotNull());
	}

	@Test
	void 복사할_문구가_없으면_거절한다() throws Exception {
		ExportPhrase 문구 = 생성된_문구("", "").get(0);

		mockMvc
				.perform(post("/api/exports/{id}/copy", 문구.getId()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EXPORT_PHRASE_EMPTY"));
	}

	/** 검토 안내가 붙어 있어도 복사를 막지 않는다. 안내는 "확인하고 쓰라"는 말이지 "쓰지 말라"는 말이 아니다. */
	@Test
	void 검토_안내가_붙은_문구도_복사할_수_있다() throws Exception {
		ExportPhrase 문구 = 생성된_문구("체온 38도로 확인됨.", "점심 식사량이 줄었습니다.").get(0);

		mockMvc
				.perform(post("/api/exports/{id}/copy", 문구.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.needsReview").value(true))
				.andExpect(jsonPath("$.copiedAt").isNotEmpty());
	}

	@Test
	void 없는_문구를_복사하려_하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(post("/api/exports/{id}/copy", 999999))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("EXPORT_PHRASE_NOT_FOUND"));
	}

	/**
	 * 문구를 만든 뒤 카드가 바뀌는 경로. (Issue #27)
	 *
	 * <p>검토 완료 카드도 고칠 수 있는데 {@code generatedText} 는 만든 시점에 얼어붙는다. 그러면 응답의 {@code evidenceText} 는
	 * 카드에서 실시간으로 오고 {@code text} 만 옛것이라, <b>직원이 근거와 어긋난 문구를 아무 경고 없이 복사하게 된다.</b>
	 */
	@Test
	void 문구를_만든_뒤_카드를_고치면_복사_전_검토를_안내한다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");
		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.needsReview").value(false));

		카드수정(card, "점심을 전혀 못 드심");

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.needsReview").value(true))
				.andExpect(jsonPath("$.phrases[0].needsReview").value(true))
				.andExpect(jsonPath("$.phrases[0].reviewNotice").value(containsString("카드가 바뀌었습니다")))
				// 옛 문구가 사라지지는 않는다. 확인하고 고치라는 안내이지 지우라는 말이 아니다.
				.andExpect(jsonPath("$.phrases[0].text").value("점심 식사량 저하 보이심."))
				.andExpect(jsonPath("$.phrases[1].needsReview").value(true));
	}

	@Test
	void 직원이_문구를_고치면_카드_변경_안내가_해소된다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");
		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()));
		ExportPhrase 문구 = phrases.findByHandoverCardIdOrderByIdAsc(card.getId()).get(0);

		카드수정(card, "점심을 전혀 못 드심");

		mockMvc
				.perform(
						put("/api/exports/{id}", 문구.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"text": "점심을 전혀 못 드심."}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.needsReview").value(false))
				.andExpect(jsonPath("$.reviewNotice").value(nullValue()));
	}

	/**
	 * 복사는 안내를 해소하지 않는다.
	 *
	 * <p>기준 시각을 {@code updatedAt} 으로 잡으면 {@code markCopied} 가 그것을 올리므로, <b>복사하는 순간 경고가 조용히
	 * 사라진다.</b> 그 함정을 직접 막는 테스트다.
	 */
	@Test
	void 복사해도_카드_변경_안내는_남는다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");
		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()));
		ExportPhrase 문구 = phrases.findByHandoverCardIdOrderByIdAsc(card.getId()).get(0);

		카드수정(card, "점심을 전혀 못 드심");

		mockMvc
				.perform(post("/api/exports/{id}/copy", 문구.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.copiedAt").isNotEmpty())
				.andExpect(jsonPath("$.needsReview").value(true));

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(jsonPath("$.phrases[0].reviewNotice").value(containsString("카드가 바뀌었습니다")));
	}

	@Test
	void 카드가_바뀌지_않았으면_안내가_붙지_않는다() throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn("점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");
		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()));

		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.needsReview").value(false))
				.andExpect(jsonPath("$.phrases[0].reviewNotice").value(nullValue()))
				.andExpect(jsonPath("$.phrases[1].reviewNotice").value(nullValue()));
	}

	/** 검토 화면과 같은 경로로 카드를 고친다. 검토 완료 카드도 고칠 수 있다. */
	private void 카드수정(HandoverCard card, String 상태변화) throws Exception {
		mockMvc
				.perform(
						put("/api/handover-cards/{id}", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{"careRecipientId": %d, "statusChange": "%s", "actionTaken": "죽으로 바꿔 드림"}
										"""
												.formatted(김말순.getId(), 상태변화)))
				.andExpect(status().isOk());
	}

	/** 검토 완료 카드에서 문구를 만들어 두고 저장된 것을 돌려준다. 순서는 기록 문구, 보호자 문구다. */
	private List<ExportPhrase> 생성된_문구(String 기록, String 보호자) throws Exception {
		HandoverCard card = 카드(ReviewStatus.REVIEWED);
		문구생성.willReturn(기록, 보호자);
		mockMvc.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated());
		return phrases.findByHandoverCardIdOrderByIdAsc(card.getId());
	}

	private HandoverCard 카드(ReviewStatus reviewStatus) {
		return cards.save(
				HandoverCard.builder()
						.handover(인계)
						.careRecipient(김말순)
						.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
						.statusChange("점심 식사량 저하")
						.actionTaken("죽으로 바꿔 드림")
						.evidenceText("점심을 거의 안 드셨어요")
						.safetyRelated(true)
						.safetyFlagSource(SafetyFlagSource.KEYWORD)
						.reviewStatus(reviewStatus)
						.build());
	}
}
