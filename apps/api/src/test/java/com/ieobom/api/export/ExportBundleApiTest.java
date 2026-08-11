package com.ieobom.api.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * 어르신 당일 문구 묶음 계약 확인. (Manyfast F-GUSOFG action · dataSpec)
 *
 * <p>여기서 보는 것은 "무엇이 묶음에 들어가고, 어떤 순서로 붙으며, 복사 기록이 어디에 남는가"다. 문구를 어떻게 만드는지는 {@link ExportApiTest}
 * 가 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(StubExportPhraseClient.Config.class)
class ExportBundleApiTest {

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
		인계 = 인계원문(김말순);
	}

	@Test
	void 어르신_당일_문구가_유형별로_이어_붙는다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침에 기침 잦으심.", "아침에 기침이 잦으셨습니다.");
		문구있는_카드(김말순, LocalTime.of(14, 0), false, "오후 산책 다녀오심.", "오후에 산책을 다녀오셨습니다.");

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.careRecipientId").value(김말순.getId()))
				.andExpect(jsonPath("$.careRecipientName").value(김말순.getName()))
				.andExpect(jsonPath("$.date").value(LocalDate.now().toString()))
				.andExpect(jsonPath("$.bundles.length()").value(2))
				.andExpect(jsonPath("$.bundles[0].phraseType").value("RECORD"))
				.andExpect(jsonPath("$.bundles[0].phraseTypeLabel").value("전산 기록 문구"))
				.andExpect(jsonPath("$.bundles[0].text").value("아침에 기침 잦으심.\n오후 산책 다녀오심."))
				.andExpect(jsonPath("$.bundles[0].phraseCount").value(2))
				.andExpect(jsonPath("$.bundles[0].empty").value(false))
				.andExpect(jsonPath("$.bundles[0].needsReview").value(false))
				.andExpect(jsonPath("$.bundles[1].phraseType").value("GUARDIAN"))
				.andExpect(jsonPath("$.bundles[1].phraseTypeLabel").value("보호자 전달 문구"))
				.andExpect(jsonPath("$.bundles[1].text").value("아침에 기침이 잦으셨습니다.\n오후에 산책을 다녀오셨습니다."));
	}

	/** 안전 관련 항목의 문구를 먼저 두고, 그다음 관찰 시각 순. (Manyfast F-GUSOFG action) */
	@Test
	void 안전_항목_문구가_먼저_붙고_그다음_관찰_시각_순으로_붙는다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		문구있는_카드(김말순, LocalTime.of(14, 0), true, "복도에서 넘어지실 뻔함.", "이동 중 부축해 드렸습니다.");
		문구있는_카드(김말순, LocalTime.of(8, 0), false, "등원 시 표정 밝으심.", "등원 시 표정이 밝으셨습니다.");

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(
						jsonPath("$.bundles[0].text")
								.value("복도에서 넘어지실 뻔함.\n등원 시 표정 밝으심.\n아침 기침."));
	}

	/** 문구를 만든 뒤에도 카드를 검토 필요로 되돌릴 수 있다. 그때 묶음에서 빠져야 한다. */
	@Test
	void 검토_필요로_되돌린_카드의_문구는_묶음에서_빠진다() throws Exception {
		HandoverCard 남는_카드 = 문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		HandoverCard 되돌린_카드 = 문구있는_카드(김말순, LocalTime.of(14, 0), false, "오후 산책.", "오후에 산책하셨습니다.");

		mockMvc
				.perform(
						patch("/api/handover-cards/{id}/review-status", 되돌린_카드.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"reviewStatus": "NEEDS_REVIEW"}
										"""))
				.andExpect(status().isOk());

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bundles[0].text").value("아침 기침."))
				.andExpect(jsonPath("$.bundles[0].phraseCount").value(1))
				.andExpect(jsonPath("$.bundles[0].phrases[0].cardId").value(남는_카드.getId()));
	}

	@Test
	void 다른_어르신의_문구는_묶음에_섞이지_않는다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		문구있는_카드(박순자, LocalTime.of(10, 0), false, "점심 식사량 저하.", "점심 식사량이 줄었습니다.");

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bundles[0].phraseCount").value(1))
				.andExpect(jsonPath("$.bundles[0].text").value("아침 기침."));
	}

	@Test
	void 다른_날짜의_묶음에는_오늘_문구가_들어가지_않는다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");

		mockMvc
				.perform(
						get("/api/care-recipients/{id}/export-bundles", 김말순.getId())
								.param("date", LocalDate.now().minusDays(1).toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.date").value(LocalDate.now().minusDays(1).toString()))
				.andExpect(jsonPath("$.bundles[0].empty").value(true))
				.andExpect(jsonPath("$.bundles[0].text").value(nullValue()));
	}

	/** 묶음에 들어간 문구도 각자 근거로 돌아갈 길을 들고 있어야 한다. (Manyfast R-TUBGKD 수락기준 3) */
	@Test
	void 묶음의_각_문구가_자기_카드와_근거를_들고_있다() throws Exception {
		HandoverCard card = 문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bundles[0].phrases[0].cardId").value(card.getId()))
				.andExpect(jsonPath("$.bundles[0].phrases[0].handoverId").value(인계.getId()))
				.andExpect(jsonPath("$.bundles[0].phrases[0].careRecipientId").value(김말순.getId()))
				.andExpect(jsonPath("$.bundles[0].phrases[0].evidenceText").value("점심을 거의 안 드셨어요"));
	}

	@Test
	void 검토_안내가_붙은_문구가_있으면_묶음도_검토_필요로_표시한다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		// 카드 어디에도 38 도가 없다.
		문구있는_카드(김말순, LocalTime.of(14, 0), false, "체온 38도로 확인됨.", "오후에 산책하셨습니다.");

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bundles[0].needsReview").value(true))
				.andExpect(jsonPath("$.bundles[0].notice").value(containsString("확인이 필요한 문구")))
				.andExpect(jsonPath("$.bundles[0].phraseCount").value(2))
				.andExpect(jsonPath("$.bundles[1].needsReview").value(false));
	}

	/** 이어 붙일 글자가 없는 문구는 묶음에서 빼고, 빠졌다는 사실을 알린다. */
	@Test
	void 문구가_만들어지지_않은_카드는_묶음에서_빠지고_안내가_붙는다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		문구있는_카드(김말순, LocalTime.of(14, 0), false, "", "");

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bundles[0].text").value("아침 기침."))
				.andExpect(jsonPath("$.bundles[0].phraseCount").value(1))
				.andExpect(jsonPath("$.bundles[0].needsReview").value(true))
				.andExpect(jsonPath("$.bundles[0].notice").value(containsString("빠졌습니다")));
	}

	@Test
	void 포함할_문구가_없으면_빈_묶음임을_구분해_알려_준다() throws Exception {
		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bundles.length()").value(2))
				.andExpect(jsonPath("$.bundles[0].empty").value(true))
				.andExpect(jsonPath("$.bundles[0].text").value(nullValue()))
				.andExpect(jsonPath("$.bundles[0].phraseCount").value(0))
				.andExpect(jsonPath("$.bundles[0].notice").value(containsString("검토 완료된 문구가 없습니다")))
				.andExpect(jsonPath("$.bundles[1].empty").value(true));
	}

	/** 묶음은 저장하지 않고 조회 시점에 만든다. (Manyfast F-GUSOFG dataSpec) */
	@Test
	void 묶음을_읽어도_문구를_새로_만들거나_저장하지_않는다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		long 문구수 = phrases.count();
		int 모델호출수 = 문구생성.callCount();

		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 김말순.getId()))
				.andExpect(status().isOk());

		assertThat(phrases.count()).as("묶음은 저장 대상이 아니다").isEqualTo(문구수);
		assertThat(문구생성.callCount()).as("이어 붙일 때 모델을 부르지 않는다").isEqualTo(모델호출수);
	}

	@Test
	void 없는_어르신의_묶음을_요청하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(get("/api/care-recipients/{id}/export-bundles", 999999))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_FOUND"));
	}

	/** 복사 기록은 묶음이 아니라 묶음에 들어간 문구 하나하나에 남는다. */
	@Test
	void 묶음을_복사하면_포함된_문구_전부에_복사_시점이_남는다() throws Exception {
		HandoverCard 첫_카드 = 문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		HandoverCard 둘째_카드 = 문구있는_카드(김말순, LocalTime.of(14, 0), false, "오후 산책.", "오후에 산책하셨습니다.");

		mockMvc
				.perform(
						post("/api/care-recipients/{id}/export-bundles/copy", 김말순.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"phraseType": "RECORD"}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.phraseType").value("RECORD"))
				.andExpect(jsonPath("$.phraseCount").value(2))
				.andExpect(jsonPath("$.phrases[0].copiedAt").isNotEmpty())
				.andExpect(jsonPath("$.phrases[1].copiedAt").isNotEmpty());

		assertThat(복사시점(첫_카드, ExportPhraseType.RECORD)).isNotNull();
		assertThat(복사시점(둘째_카드, ExportPhraseType.RECORD)).isNotNull();
		assertThat(복사시점(첫_카드, ExportPhraseType.GUARDIAN))
				.as("복사한 유형에만 남는다")
				.isNull();
	}

	@Test
	void 묶음에서_빠진_문구에는_복사_기록이_남지_않는다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");
		HandoverCard 빈_문구_카드 = 문구있는_카드(김말순, LocalTime.of(14, 0), false, "", "");

		mockMvc
				.perform(
						post("/api/care-recipients/{id}/export-bundles/copy", 김말순.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"phraseType": "RECORD"}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.phraseCount").value(1));

		assertThat(복사시점(빈_문구_카드, ExportPhraseType.RECORD))
				.as("복사되지 않은 문구를 복사한 것으로 남길 수 없다")
				.isNull();
	}

	@Test
	void 빈_묶음은_복사할_수_없다() throws Exception {
		mockMvc
				.perform(
						post("/api/care-recipients/{id}/export-bundles/copy", 김말순.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{"phraseType": "GUARDIAN"}
										"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EXPORT_BUNDLE_EMPTY"));
	}

	@Test
	void 복사한_문구_유형_없이는_기록할_수_없다() throws Exception {
		문구있는_카드(김말순, LocalTime.of(9, 0), false, "아침 기침.", "아침에 기침이 있으셨습니다.");

		mockMvc
				.perform(
						post("/api/care-recipients/{id}/export-bundles/copy", 김말순.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("phraseType"));
	}

	private LocalDateTime 복사시점(HandoverCard card, ExportPhraseType type) {
		return phrases.findByHandoverCardIdOrderByIdAsc(card.getId()).stream()
				.filter(phrase -> phrase.getPhraseType() == type)
				.findFirst()
				.orElseThrow()
				.getCopiedAt();
	}

	/** 검토 완료 카드 한 장과 그 카드에서 만들어진 두 문구. */
	private HandoverCard 문구있는_카드(
			CareRecipient 어르신, LocalTime 관찰시각, boolean 안전, String 기록문구, String 보호자문구) throws Exception {

		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(어르신.getId().equals(김말순.getId()) ? 인계 : 인계원문(어르신))
								.careRecipient(어르신)
								.observedAt(LocalDateTime.of(LocalDate.now(), 관찰시각))
								.statusChange("점심 식사량 저하")
								.actionTaken("죽으로 바꿔 드림")
								.evidenceText("점심을 거의 안 드셨어요")
								.safetyRelated(안전)
								.safetyFlagSource(안전 ? SafetyFlagSource.KEYWORD : null)
								.reviewStatus(ReviewStatus.REVIEWED)
								.build());

		문구생성.willReturn(기록문구, 보호자문구);
		mockMvc
				.perform(post("/api/handover-cards/{id}/exports", card.getId()))
				.andExpect(status().isCreated());
		return card;
	}

	private Handover 인계원문(CareRecipient 어르신) {
		return handovers.save(
				Handover.builder()
						.careRecipient(어르신)
						.rawText("점심을 거의 안 드셨어요.")
						.inputMethod(InputMethod.TEXT)
						.occurredAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(13, 10)))
						.reporterName("김요양")
						.proxyInput(false)
						.build());
	}
}
