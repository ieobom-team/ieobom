package com.ieobom.api.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.export.file.ExportDocument;
import com.ieobom.api.export.file.ExportSheet;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.handovercard.SafetyFlagSource;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import com.ieobom.api.task.Task;
import com.ieobom.api.task.TaskRepository;
import java.io.ByteArrayInputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 어르신 당일 인계 항목 표 계약 확인. (Manyfast F-GUSOFG action · display)
 *
 * <p>여기서 보는 것은 <b>표의 단위가 문구가 아니라는 것</b>이다. 행은 카드고, 담당·기한·처리 상태는 후속 업무에서 온다. 후속 업무가 없는 항목에
 * 무엇이 적히는지가 이 파일에서 가장 쉽게 틀릴 수 있는 자리라 그것을 가장 자세히 본다.
 *
 * <p>파일을 실제로 열어서 확인한다. 바이트가 나왔다는 것만으로는 열 이름도 값도 알 수 없다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ExportSheetApiTest {

	private static final Pattern FILENAME = Pattern.compile("filename\\*=UTF-8''([^;]+)");

	/** 고지 한 줄, 열 이름 한 줄 다음부터 데이터다. */
	private static final int HEADER_ROW = 1;
	private static final int FIRST_DATA_ROW = 2;

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private TaskRepository tasks;

	private CareRecipient 김말순;
	private Handover 인계;
	private Workbook 열어둔표;

	@BeforeEach
	void setUp() {
		tasks.deleteAll();
		cards.deleteAll();
		handovers.deleteAll();

		김말순 = careRecipients.findAll().get(0);
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

	/** 업무를 남겨 두면 다른 테스트 클래스의 {@code cards.deleteAll()} 이 외래키에 걸린다. */
	@AfterEach
	void tearDown() throws Exception {
		tasks.deleteAll();
		if (열어둔표 != null) {
			열어둔표.close();
			열어둔표 = null;
		}
	}

	@Test
	void 표의_열_이름과_행_수는_그날_검토_완료_카드를_따른다() throws Exception {
		카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");
		카드(LocalTime.of(14, 0), true, "복도에서 넘어지실 뻔함", "부축해 드림", "복도에서 휘청하셨어요");

		Sheet 표 = 표내려받기();

		assertThat(줄(표, HEADER_ROW)).isEqualTo(ExportSheet.COLUMNS);
		assertThat(표.getLastRowNum()).as("고지 · 열 이름 · 카드 두 장").isEqualTo(FIRST_DATA_ROW + 1);
	}

	/** 표를 아무리 아래로 늘려도 첫 줄은 남는다. 아래에 두면 행이 늘수록 화면 밖으로 밀린다. */
	@Test
	void 맨_윗줄에_검토를_전제로_한_초안이라는_고지가_있다() throws Exception {
		카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");

		assertThat(칸(표내려받기(), 0, 0)).isEqualTo(ExportDocument.DISCLAIMER);
	}

	@Test
	void 안전_관련_항목이_먼저_온다() throws Exception {
		카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");
		카드(LocalTime.of(14, 0), true, "복도에서 넘어지실 뻔함", "부축해 드림", "복도에서 휘청하셨어요");

		Sheet 표 = 표내려받기();

		assertThat(줄(표, FIRST_DATA_ROW)).contains("복도에서 넘어지실 뻔함");
		assertThat(줄(표, FIRST_DATA_ROW + 1)).contains("아침 기침 잦으심");
	}

	/**
	 * 후속 업무가 없는 항목에 담당을 적지 않는다. (Manyfast F-GUSOFG action)
	 *
	 * <p>카드에는 AI 가 제안한 담당 직종이 붙어 있지만 사람이 배정한 적은 없다. 표에 적히는 순간 배정된 것으로 읽힌다.
	 */
	@Test
	void 후속_업무가_없으면_담당은_미배정이고_기한과_처리_상태는_빈_칸이다() throws Exception {
		카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");

		List<String> 줄 = 줄(표내려받기(), FIRST_DATA_ROW);

		assertThat(줄.get(ExportSheet.COLUMNS.indexOf("담당"))).isEqualTo("미배정");
		assertThat(줄.get(ExportSheet.COLUMNS.indexOf("기한"))).isEmpty();
		assertThat(줄.get(ExportSheet.COLUMNS.indexOf("처리 상태"))).isEmpty();
		assertThat(줄).as("AI 제안 직종을 담당으로 적지 않는다").doesNotContain("간호조무사");
	}

	@Test
	void 후속_업무가_있으면_담당과_기한과_처리_상태가_채워진다() throws Exception {
		HandoverCard 카드 = 카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");
		업무(카드, "체온 다시 확인", JobRole.NURSE_AIDE, "박간호", LocalTime.of(16, 30));

		List<String> 줄 = 줄(표내려받기(), FIRST_DATA_ROW);

		assertThat(줄.get(ExportSheet.COLUMNS.indexOf("담당"))).isEqualTo("박간호");
		assertThat(줄.get(ExportSheet.COLUMNS.indexOf("기한"))).isEqualTo("16:30");
		assertThat(줄.get(ExportSheet.COLUMNS.indexOf("처리 상태"))).isEqualTo("미처리");
	}

	/** 직종만 배정된 업무가 정상이다. 그때 비워 두면 배정되지 않은 항목과 구별되지 않는다. */
	@Test
	void 담당자_이름_없이_직종만_배정하면_직종이_담당이_된다() throws Exception {
		HandoverCard 카드 = 카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");
		업무(카드, "체온 다시 확인", JobRole.NURSE_AIDE, null, LocalTime.of(16, 30));

		assertThat(줄(표내려받기(), FIRST_DATA_ROW).get(ExportSheet.COLUMNS.indexOf("담당")))
				.isEqualTo("간호조무사");
	}

	/** 근거 없는 내용은 파일에도 들어가지 않는다. (Manyfast R-TUBGKD 수락기준 4) */
	@Test
	void 모든_행에_근거_원문이_들어간다() throws Exception {
		카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");
		카드(LocalTime.of(14, 0), true, "복도에서 넘어지실 뻔함", "부축해 드림", "복도에서 휘청하셨어요");

		Sheet 표 = 표내려받기();
		int 근거 = ExportSheet.COLUMNS.indexOf("근거 원문");

		assertThat(칸(표, FIRST_DATA_ROW, 근거)).isEqualTo("복도에서 휘청하셨어요");
		assertThat(칸(표, FIRST_DATA_ROW + 1, 근거)).isEqualTo("기침 잦으셨어요");
	}

	/** 묶음과 같은 기준이다. 같은 화면에서 받은 두 파일이 다른 카드를 담으면 어느 쪽이 그날의 전부인지 알 수 없다. */
	@Test
	void 검토되지_않은_카드는_표에_들어가지_않는다() throws Exception {
		카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");
		cards.save(
				HandoverCard.builder()
						.handover(인계)
						.careRecipient(김말순)
						.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(11, 0)))
						.statusChange("아직 검토하지 않은 변화")
						.evidenceText("확인이 더 필요해요")
						.safetyRelated(false)
						.reviewStatus(ReviewStatus.NEEDS_REVIEW)
						.build());

		Sheet 표 = 표내려받기();

		assertThat(표.getLastRowNum()).isEqualTo(FIRST_DATA_ROW);
		assertThat(줄(표, FIRST_DATA_ROW)).doesNotContain("아직 검토하지 않은 변화");
	}

	@Test
	void 파일_이름에_표라는_것과_어르신_실명과_날짜가_들어간다() throws Exception {
		카드(LocalTime.of(9, 0), false, "아침 기침 잦으심", "미지근한 물 드림", "기침 잦으셨어요");

		MvcResult result =
				mockMvc
						.perform(get("/api/care-recipients/{id}/export-sheet", 김말순.getId()))
						.andExpect(status().isOk())
						.andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("spreadsheetml")))
						.andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
						.andReturn();

		assertThat(파일이름(result)).isEqualTo("이어봄_인계표_김말순_%s.xlsx".formatted(LocalDate.now()));
	}

	@Test
	void 담을_항목이_없으면_내려받을_수_없다() throws Exception {
		mockMvc
				.perform(get("/api/care-recipients/{id}/export-sheet", 김말순.getId()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EXPORT_SHEET_EMPTY"));
	}

	@Test
	void 없는_어르신의_표를_요청하면_404_로_알려_준다() throws Exception {
		mockMvc
				.perform(get("/api/care-recipients/{id}/export-sheet", 999999))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_FOUND"));
	}

	/**
	 * 받은 파일을 실제로 열어 첫 시트를 돌려준다.
	 *
	 * <p>열어 둔 통합 문서는 {@link #tearDown()} 에서 닫는다. 여기서 닫아 버리면 돌려준 시트가 이미 닫힌 문서를 가리키게 된다.
	 */
	private Sheet 표내려받기() throws Exception {
		byte[] file =
				mockMvc
						.perform(get("/api/care-recipients/{id}/export-sheet", 김말순.getId()))
						.andExpect(status().isOk())
						.andReturn()
						.getResponse()
						.getContentAsByteArray();

		열어둔표 = new XSSFWorkbook(new ByteArrayInputStream(file));
		return 열어둔표.getSheetAt(0);
	}

	private List<String> 줄(Sheet 표, int rowIndex) {
		List<String> values = new ArrayList<>();
		for (int column = 0; column < ExportSheet.COLUMNS.size(); column++) {
			values.add(칸(표, rowIndex, column));
		}
		return values;
	}

	private String 칸(Sheet 표, int rowIndex, int column) {
		Row row = 표.getRow(rowIndex);
		if (row == null) {
			return "";
		}
		Cell cell = row.getCell(column);
		return cell == null ? "" : cell.getStringCellValue();
	}

	private String 파일이름(MvcResult result) {
		String disposition = result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION);
		Matcher matcher = FILENAME.matcher(disposition == null ? "" : disposition);
		assertThat(matcher.find()).as("파일 이름이 헤더에 없다: %s", disposition).isTrue();
		return URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
	}

	/** 검토 완료 카드 한 장. AI 담당 직종 제안값을 일부러 붙여 둔다 — 표에 새어 나오면 안 되는 값이다. */
	private HandoverCard 카드(
			LocalTime 관찰시각, boolean 안전, String 상태변화, String 조치, String 근거) {

		return cards.save(
				HandoverCard.builder()
						.handover(인계)
						.careRecipient(김말순)
						.observedAt(LocalDateTime.of(LocalDate.now(), 관찰시각))
						.statusChange(상태변화)
						.actionTaken(조치)
						.nextAction("이따 한 번 더 확인")
						.evidenceText(근거)
						.safetyRelated(안전)
						.safetyFlagSource(안전 ? SafetyFlagSource.KEYWORD : null)
						.reviewStatus(ReviewStatus.REVIEWED)
						.suggestedJobRole(JobRole.NURSE_AIDE)
						.suggestedDueTime(LocalTime.of(17, 0))
						.build());
	}

	private void 업무(
			HandoverCard 카드, String 내용, JobRole 직종, String 담당자, LocalTime 기한) {
		tasks.save(Task.pending(카드, 내용, 직종, 담당자, 기한));
	}
}
