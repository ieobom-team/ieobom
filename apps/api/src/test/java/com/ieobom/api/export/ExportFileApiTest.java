package com.ieobom.api.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.export.file.ExportDocument;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.handovercard.SafetyFlagSource;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.io.ByteArrayInputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 문구 파일 내려받기 계약 확인. (Manyfast F-GUSOFG action · display)
 *
 * <p>여기서 보는 것은 "파일에 무엇이 담기고, 이름이 어떻게 붙고, 내려받기가 무엇을 남기는가"다. 문구를 어떻게 만드는지는 {@link ExportApiTest}
 * 가, 묶음이 어떻게 이어 붙는지는 {@link ExportBundleApiTest} 가 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(StubExportPhraseClient.Config.class)
class ExportFileApiTest {

	private static final Pattern FILENAME = Pattern.compile("filename\\*=UTF-8''([^;]+)");

	@Autowired private MockMvc mockMvc;
	@Autowired private StubExportPhraseClient 문구생성;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private ExportPhraseRepository phrases;

	private CareRecipient 김말순;
	private Handover 인계;

	@BeforeEach
	void setUp() {
		phrases.deleteAll();
		cards.deleteAll();
		handovers.deleteAll();
		문구생성.reset();

		김말순 = careRecipients.findAll().get(0);
		인계 = 인계원문(김말순);
	}

	@Test
	void 카드_문구를_txt_로_내려받으면_본문과_근거와_고지가_함께_담긴다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		MvcResult result =
				mockMvc
						.perform(get("/api/exports/{id}/file", 문구(카드, ExportPhraseType.RECORD).getId())
								.param("format", "txt"))
						.andExpect(status().isOk())
						.andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("text/plain")))
						.andReturn();

		String 파일 = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
		assertThat(파일).contains("전산 기록 문구 — 김말순");
		assertThat(파일).contains("점심 식사량 저하 보이심.");
		assertThat(파일).as("파일만 받은 사람도 근거를 볼 수 있어야 한다").contains("점심을 거의 안 드셨어요");
		assertThat(파일).contains(ExportDocument.DISCLAIMER);
		assertThat(파일).as("붙여넣기용이라 윈도우 줄바꿈을 쓴다").contains("\r\n");
	}

	/** 붙여넣는 자리가 위쪽이라 근거와 고지는 구분선 아래로 내려간다. */
	@Test
	void txt_는_본문을_맨_위에_두고_근거를_구분선_아래에_둔다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		String 파일 = 내려받기(문구(카드, ExportPhraseType.RECORD).getId(), "txt");

		assertThat(파일.indexOf("점심 식사량 저하 보이심."))
				.isLessThan(파일.indexOf("근거 원문"))
				.isLessThan(파일.indexOf(ExportDocument.DISCLAIMER));
	}

	@Test
	void md_는_근거를_문구와_짝지어_담는다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		String 파일 = 내려받기(문구(카드, ExportPhraseType.GUARDIAN).getId(), "md");

		assertThat(파일).contains("# 보호자 전달 문구 — 김말순");
		assertThat(파일).contains("## 근거 원문");
		assertThat(파일).contains("1. 점심 식사량이 줄었습니다.");
		assertThat(파일).contains("> \"점심을 거의 안 드셨어요\"");
		assertThat(파일).contains(ExportDocument.DISCLAIMER);
	}

	/**
	 * "일지"라고 부르지 않는다. 워드로 받은 문서에 그 이름이 붙으면 그대로 제출해도 되는 것으로 읽힌다.
	 *
	 * <p>담기는 사실은 텍스트·마크다운과 같다. 다른 것은 모양뿐이다.
	 */
	@Test
	void docx_는_검토용_초안_제목과_근거와_고지를_담는다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		MvcResult result =
				mockMvc
						.perform(get("/api/exports/{id}/file", 문구(카드, ExportPhraseType.RECORD).getId())
								.param("format", "docx"))
						.andExpect(status().isOk())
						.andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("wordprocessingml")))
						.andReturn();

		String 문서 = 워드_본문(result.getResponse().getContentAsByteArray());
		assertThat(문서).contains("검토용 서술형 기록 초안");
		assertThat(문서).doesNotContain("일지");
		assertThat(문서).contains("전산 기록 문구 — 김말순");
		assertThat(문서).contains("점심 식사량 저하 보이심.");
		assertThat(문서).as("파일만 받은 사람도 근거를 볼 수 있어야 한다").contains("점심을 거의 안 드셨어요");
		assertThat(문서).contains(ExportDocument.DISCLAIMER);
		assertThat(파일이름(result))
				.isEqualTo("이어봄_전산기록문구_김말순_%s.docx".formatted(LocalDate.now()));
	}

	@Test
	void 묶음도_docx_로_내려받을_수_있다() throws Exception {
		문구있는_카드(LocalTime.of(9, 0), false, "아침 기침 잦으심.", "아침에 기침이 잦으셨습니다.");
		문구있는_카드(LocalTime.of(14, 0), true, "복도에서 넘어지실 뻔함.", "복도에서 넘어지실 뻔해 부축해 드렸습니다.");

		MvcResult result =
				mockMvc
						.perform(
								get("/api/care-recipients/{id}/export-bundles/file", 김말순.getId())
										.param("phraseType", "RECORD")
										.param("format", "docx"))
						.andExpect(status().isOk())
						.andReturn();

		String 문서 = 워드_본문(result.getResponse().getContentAsByteArray());
		assertThat(문서).contains("전산 기록 문구 묶음 — 김말순");
		assertThat(문서)
				.as("이어 붙인 본문이 한 덩어리로 뭉치지 않고 줄로 나뉜다")
				.contains("복도에서 넘어지실 뻔함.\n아침 기침 잦으심.");
	}

	/** 표는 단위가 다르다. 문구를 내려받는 자리에서 고를 수 있으면 무엇이 나가는지 설명할 수 없다. */
	@Test
	void 문구는_xlsx_로_내려받을_수_없다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		mockMvc
				.perform(get("/api/exports/{id}/file", 문구(카드, ExportPhraseType.RECORD).getId())
						.param("format", "xlsx"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("format"));
	}

	/** 이름이 깨지면 여러 개를 받아 둔 직원이 어느 것이 누구 것인지 알 수 없다. */
	@Test
	void 파일_이름에_유형과_어르신_실명과_날짜가_들어간다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		MvcResult result =
				mockMvc
						.perform(get("/api/exports/{id}/file", 문구(카드, ExportPhraseType.RECORD).getId())
								.param("format", "txt"))
						.andExpect(status().isOk())
						.andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
						.andReturn();

		assertThat(파일이름(result))
				.isEqualTo("이어봄_전산기록문구_김말순_%s.txt".formatted(LocalDate.now()));
	}

	@Test
	void 묶음을_내려받으면_이어_붙인_본문과_항목별_근거가_담긴다() throws Exception {
		문구있는_카드(LocalTime.of(9, 0), false, "아침 기침 잦으심.", "아침에 기침이 잦으셨습니다.");
		문구있는_카드(LocalTime.of(14, 0), true, "복도에서 넘어지실 뻔함.", "복도에서 넘어지실 뻔해 부축해 드렸습니다.");

		MvcResult result =
				mockMvc
						.perform(
								get("/api/care-recipients/{id}/export-bundles/file", 김말순.getId())
										.param("phraseType", "RECORD")
										.param("format", "txt"))
						.andExpect(status().isOk())
						.andReturn();

		String 파일 = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
		assertThat(파일).contains("전산 기록 문구 묶음 — 김말순");
		assertThat(파일)
				.as("안전 항목의 문구가 먼저 온다")
				.contains("복도에서 넘어지실 뻔함.\r\n아침 기침 잦으심.");
		assertThat(파일).contains("근거 원문");
		assertThat(파일이름(result))
				.isEqualTo("이어봄_전산기록문구_김말순_%s.txt".formatted(LocalDate.now()));
	}

	/** 내려받기는 복사가 아니다. 받아 두고 붙여넣지 않을 수도 있다. */
	@Test
	void 내려받아도_복사_기록은_남지_않는다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		내려받기(문구(카드, ExportPhraseType.RECORD).getId(), "txt");
		mockMvc
				.perform(
						get("/api/care-recipients/{id}/export-bundles/file", 김말순.getId())
								.param("phraseType", "RECORD")
								.param("format", "md"))
				.andExpect(status().isOk());

		assertThat(문구(카드, ExportPhraseType.RECORD).getCopiedAt()).isNull();
	}

	@Test
	void 지원하지_않는_형식은_보완할_항목과_함께_거절한다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "점심 식사량 저하 보이심.", "점심 식사량이 줄었습니다.");

		mockMvc
				.perform(get("/api/exports/{id}/file", 문구(카드, ExportPhraseType.RECORD).getId())
						.param("format", "pdf"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("format"));
	}

	@Test
	void 정의되지_않은_문구_유형은_보완할_항목과_함께_거절한다() throws Exception {
		문구있는_카드(LocalTime.of(9, 0), false, "아침 기침 잦으심.", "아침에 기침이 잦으셨습니다.");

		mockMvc
				.perform(
						get("/api/care-recipients/{id}/export-bundles/file", 김말순.getId())
								.param("phraseType", "STAFF")
								.param("format", "txt"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("phraseType"));
	}

	@Test
	void 없는_문구를_내려받으려_하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(get("/api/exports/{id}/file", 999999).param("format", "txt"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("EXPORT_PHRASE_NOT_FOUND"));
	}

	/** 없는 것을 내려준 것으로 남길 수 없다. 막는 것은 담을 문구 자체가 없을 때뿐이다. */
	@Test
	void 담을_문구가_없으면_내려받을_수_없다() throws Exception {
		HandoverCard 카드 = 문구있는_카드(LocalTime.of(12, 40), false, "", "");

		mockMvc
				.perform(get("/api/exports/{id}/file", 문구(카드, ExportPhraseType.RECORD).getId())
						.param("format", "txt"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EXPORT_PHRASE_EMPTY"));
	}

	@Test
	void 빈_묶음은_내려받을_수_없다() throws Exception {
		mockMvc
				.perform(
						get("/api/care-recipients/{id}/export-bundles/file", 김말순.getId())
								.param("phraseType", "RECORD")
								.param("format", "txt"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EXPORT_BUNDLE_EMPTY"));
	}

	@Test
	void 없는_어르신의_묶음_파일을_요청하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(
						get("/api/care-recipients/{id}/export-bundles/file", 999999)
								.param("phraseType", "RECORD")
								.param("format", "txt"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_FOUND"));
	}

	private String 내려받기(Long phraseId, String format) throws Exception {
		return mockMvc
				.perform(get("/api/exports/{id}/file", phraseId).param("format", format))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	/** 받은 워드 파일을 실제로 열어 문단을 잇는다. 바이트가 나왔다는 것만으로는 무엇이 담겼는지 알 수 없다. */
	private String 워드_본문(byte[] file) throws Exception {
		try (XWPFDocument word = new XWPFDocument(new ByteArrayInputStream(file))) {
			return word.getParagraphs().stream()
					.map(XWPFParagraph::getText)
					.collect(Collectors.joining("\n"));
		}
	}

	/** RFC 5987 로 인코딩된 이름을 되돌린다. 브라우저가 실제로 보게 될 이름이다. */
	private String 파일이름(MvcResult result) {
		String disposition = result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION);
		Matcher matcher = FILENAME.matcher(disposition == null ? "" : disposition);
		assertThat(matcher.find()).as("파일 이름이 헤더에 없다: %s", disposition).isTrue();
		return URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
	}

	private ExportPhrase 문구(HandoverCard card, ExportPhraseType type) {
		return phrases.findByHandoverCardIdOrderByIdAsc(card.getId()).stream()
				.filter(phrase -> phrase.getPhraseType() == type)
				.findFirst()
				.orElseThrow();
	}

	/** 검토 완료 카드 한 장과 그 카드에서 만들어진 두 문구. */
	private HandoverCard 문구있는_카드(LocalTime 관찰시각, boolean 안전, String 기록문구, String 보호자문구)
			throws Exception {

		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(인계)
								.careRecipient(김말순)
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
