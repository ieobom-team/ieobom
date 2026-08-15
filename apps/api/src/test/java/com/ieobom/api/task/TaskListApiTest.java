package com.ieobom.api.task;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.notification.NotificationRepository;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 당일 운영 현황과 하원 미처리 브리핑이 읽는 목록. (Manyfast F-HQTFLK)
 *
 * <p>여기서 보는 것은 세 가지다. <b>당일 경계</b>가 생성 시점으로 그어지는가, 미처리와 완료가 <b>섞이지 않고 각자의 순서로</b> 나오는가,
 * 그리고 <b>대리 완료 표시</b>가 목록에서도 맞는가.
 *
 * <p>마지막 것을 굳이 목록에서 다시 보는 이유는 {@code delegated} 가 저장된 값이 아니라 담당자와 확인자를 비교해 그때그때 판정하는 값이기
 * 때문이다. 상세에서 맞다고 목록에서 맞다는 보장이 없다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TaskListApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private NotificationRepository notifications;
	@Autowired private TaskRepository tasks;
	@Autowired private JdbcTemplate jdbc;

	private CareRecipient 김말순;
	private Handover 인계;

	@BeforeEach
	void setUp() {
		notifications.deleteAll();
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
	void tearDown() {
		notifications.deleteAll();
		tasks.deleteAll();
	}

	@Test
	void 대시보드는_미처리와_완료를_나눠_준다() throws Exception {
		업무("저녁 식사량 확인", LocalTime.of(17, 30), "박간호");
		완료된_업무("낮잠 여부 확인", LocalTime.of(15, 0), "박간호", "박간호");

		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.date").value(LocalDate.now().toString()))
				.andExpect(jsonPath("$.pending.length()").value(1))
				.andExpect(jsonPath("$.pending[0].content").value("저녁 식사량 확인"))
				.andExpect(jsonPath("$.pending[0].status").value("PENDING"))
				.andExpect(jsonPath("$.done.length()").value(1))
				.andExpect(jsonPath("$.done[0].content").value("낮잠 여부 확인"))
				.andExpect(jsonPath("$.done[0].status").value("DONE"))
				// 건수는 응답에 담는다. 화면이 목록을 잘라 보여 줘도 숫자는 줄지 않아야 한다.
				.andExpect(jsonPath("$.pendingCount").value(1))
				.andExpect(jsonPath("$.doneCount").value(1));
	}

	@Test
	void 미처리는_기한이_이른_것부터_나온다() throws Exception {
		업무("늦은 일", LocalTime.of(17, 30), "박간호");
		업무("이른 일", LocalTime.of(14, 0), "박간호");
		업무("중간 일", LocalTime.of(16, 0), "박간호");

		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				// 하원 전에 무엇부터 확인해야 하는지가 그대로 순서다.
				.andExpect(jsonPath("$.pending[0].content").value("이른 일"))
				.andExpect(jsonPath("$.pending[1].content").value("중간 일"))
				.andExpect(jsonPath("$.pending[2].content").value("늦은 일"));
	}

	@Test
	void 완료는_방금_닫힌_것부터_나온다() throws Exception {
		완료된_업무("먼저 닫은 일", LocalTime.of(14, 0), "박간호", "박간호", LocalDateTime.now().minusHours(2));
		완료된_업무("방금 닫은 일", LocalTime.of(17, 0), "박간호", "박간호", LocalDateTime.now());

		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.done[0].content").value("방금 닫은 일"))
				.andExpect(jsonPath("$.done[1].content").value("먼저 닫은 일"));
	}

	@Test
	void 어제_만들어진_업무는_오늘_목록에_없다() throws Exception {
		Task 어제업무 = 업무("어제 남은 일", LocalTime.of(17, 30), "박간호");
		생성시점을_옮긴다(어제업무, LocalDateTime.now().minusDays(1));

		// 당일만 보는 것이 명세이고 자동 승계도 없다. (Manyfast F-HQTFLK rules)
		// 그래서 어제 만들어져 아직 미처리인 업무는 오늘 어느 화면에도 뜨지 않는다.
		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pending.length()").value(0))
				.andExpect(jsonPath("$.pendingCount").value(0));

		mockMvc
				.perform(get("/api/tasks/pending-briefing"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pending.length()").value(0));

		// 어제로 물으면 그때는 보인다. 사라진 것이 아니라 오늘 것이 아닐 뿐이다.
		mockMvc
				.perform(get("/api/tasks").param("date", LocalDate.now().minusDays(1).toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pending.length()").value(1))
				.andExpect(jsonPath("$.pending[0].content").value("어제 남은 일"));
	}

	@Test
	void 업무가_없는_날도_빈_목록으로_답한다() throws Exception {
		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.date").value(LocalDate.now().toString()))
				.andExpect(jsonPath("$.pending.length()").value(0))
				.andExpect(jsonPath("$.done.length()").value(0))
				.andExpect(jsonPath("$.pendingCount").value(0))
				.andExpect(jsonPath("$.doneCount").value(0));
	}

	@Test
	void 브리핑은_완료된_업무를_섞지_않는다() throws Exception {
		업무("아직 안 닫힌 일", LocalTime.of(17, 30), "박간호");
		완료된_업무("닫은 일", LocalTime.of(15, 0), "박간호", "박간호");

		mockMvc
				.perform(get("/api/tasks/pending-briefing"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.date").value(LocalDate.now().toString()))
				.andExpect(jsonPath("$.pending.length()").value(1))
				.andExpect(jsonPath("$.pending[0].content").value("아직 안 닫힌 일"))
				.andExpect(jsonPath("$.pendingCount").value(1))
				// 완료를 담을 자리를 두지 않는다. 비워서 내려주면 응답이 "완료가 0건"이라고 거짓말을 한다.
				.andExpect(jsonPath("$.done").doesNotExist())
				.andExpect(jsonPath("$.doneCount").doesNotExist());
	}

	@Test
	void 브리핑은_미처리_건수를_담당_확정과_미확정으로_나눈다() throws Exception {
		업무("담당자가 맡은 일", LocalTime.of(15, 0), "박간호");
		직종만_배정된_업무("아무도 안 맡은 일", LocalTime.of(16, 0));
		직종만_배정된_업무("이것도 아무도 안 맡은 일", LocalTime.of(17, 0));
		완료된_업무("닫은 일", LocalTime.of(14, 0), "박간호", "박간호");

		mockMvc
				.perform(get("/api/tasks/pending-briefing"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pendingCount").value(3))
				// 관리자가 묻는 것은 "남은 게 몇 건인가"가 아니라 "아무도 손대지 않은 게 몇 건인가"다.
				.andExpect(jsonPath("$.claimedCount").value(1))
				.andExpect(jsonPath("$.unclaimedCount").value(2));
	}

	@Test
	void 브리핑의_확정과_미확정은_합쳐서_미처리_건수가_된다() throws Exception {
		업무("담당자가 맡은 일", LocalTime.of(15, 0), "박간호");
		직종만_배정된_업무("아무도 안 맡은 일", LocalTime.of(16, 0));
		// 완료된 업무는 애초에 미처리가 아니므로 어느 쪽에도 세지 않는다.
		완료된_업무("담당자가 있던 닫은 일", LocalTime.of(13, 0), "박간호", "박간호");

		mockMvc
				.perform(get("/api/tasks/pending-briefing"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pendingCount").value(2))
				.andExpect(jsonPath("$.claimedCount").value(1))
				.andExpect(jsonPath("$.unclaimedCount").value(1));
	}

	@Test
	void 브리핑이_비면_나눈_건수도_모두_0이다() throws Exception {
		mockMvc
				.perform(get("/api/tasks/pending-briefing"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pendingCount").value(0))
				.andExpect(jsonPath("$.claimedCount").value(0))
				.andExpect(jsonPath("$.unclaimedCount").value(0));
	}

	/**
	 * {@code /api/tasks/pending-briefing} 이 {@code /api/tasks/&#123;taskId&#125;} 로 흘러가지 않는다.
	 *
	 * <p>두 경로는 깊이가 같고, 지금 동작하는 이유는 Spring 이 경로 변수보다 리터럴을 먼저 맞추기 때문이다. 프레임워크 규칙에 기대는 자리라
	 * 못 박아 둔다. 매핑을 손대다 이 우선순위가 깨지면 브리핑은 오류가 아니라 <b>{@code taskId} 파싱 실패</b>로 조용히 400 이 된다.
	 */
	@Test
	void 브리핑_경로가_업무_상세_경로에_먹히지_않는다() throws Exception {
		Task task = 업무("저녁 식사량 확인", LocalTime.of(17, 30), "박간호");

		mockMvc
				.perform(get("/api/tasks/pending-briefing"))
				.andExpect(status().isOk())
				// 상세 응답이었다면 최상위에 pending 이 아니라 id 가 있다.
				.andExpect(jsonPath("$.pending").exists())
				.andExpect(jsonPath("$.id").doesNotExist());

		// 같은 깊이의 숫자 경로는 그대로 상세로 간다.
		mockMvc
				.perform(get("/api/tasks/{id}", task.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(task.getId()))
				.andExpect(jsonPath("$.pending").doesNotExist());
	}

	@Test
	void 목록도_대리_완료를_상세와_같게_판정한다() throws Exception {
		완료된_업무("대리로 닫은 일", LocalTime.of(14, 0), "박간호", "이복지");
		완료된_업무("본인이 닫은 일", LocalTime.of(15, 0), "박간호", "박간호");
		완료된_업무("직종만 배정된 일", LocalTime.of(16, 0), null, "이복지");

		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				// 완료는 완료 시각 역순이라 마지막에 닫은 것이 앞에 온다.
				.andExpect(jsonPath("$.done[0].content").value("직종만 배정된 일"))
				// 담당자가 사람 단위로 정해진 적이 없으면 대리라고 말할 근거가 없다.
				.andExpect(jsonPath("$.done[0].delegated").value(false))
				.andExpect(jsonPath("$.done[0].completedByName").value("이복지"))
				.andExpect(jsonPath("$.done[1].content").value("본인이 닫은 일"))
				.andExpect(jsonPath("$.done[1].delegated").value(false))
				.andExpect(jsonPath("$.done[2].content").value("대리로 닫은 일"))
				.andExpect(jsonPath("$.done[2].delegated").value(true))
				.andExpect(jsonPath("$.done[2].assigneeName").value("박간호"))
				.andExpect(jsonPath("$.done[2].completedByName").value("이복지"));
	}

	@Test
	void 목록은_어르신과_카드를_함께_준다() throws Exception {
		Task task = 업무("저녁 식사량 확인", LocalTime.of(17, 30), "박간호");

		// open-in-view 가 꺼져 있어 목록을 만드는 자리에서 지연 로딩이 열리면 여기서 터진다.
		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pending[0].handoverCardId").value(task.getHandoverCard().getId()))
				.andExpect(jsonPath("$.pending[0].careRecipientId").value(김말순.getId()))
				.andExpect(jsonPath("$.pending[0].careRecipientName").value(김말순.getName()))
				.andExpect(jsonPath("$.pending[0].assigneeJobRoleLabel").value("간호조무사"))
				.andExpect(jsonPath("$.pending[0].dueTime").value("17:30"))
				.andExpect(jsonPath("$.pending[0].statusLabel").value("미처리"));
	}

	private Task 업무(String content, LocalTime dueTime, String assigneeName) {
		return tasks.save(
				Task.pending(카드(content), content, JobRole.NURSE_AIDE, assigneeName, null, dueTime));
	}

	/** 담당자 없이 직종에만 배정된 업무. 브리핑이 "아직 아무도 맡지 않은 건"으로 세는 대상이다. */
	private Task 직종만_배정된_업무(String content, LocalTime dueTime) {
		return 업무(content, dueTime, null);
	}

	private void 완료된_업무(
			String content, LocalTime dueTime, String assigneeName, String completedByName) {
		완료된_업무(content, dueTime, assigneeName, completedByName, LocalDateTime.now());
	}

	/**
	 * 완료 시각까지 정해서 만든다.
	 *
	 * <p>{@link Task#complete} 는 지금 시각으로 닫으므로 여러 건을 잇달아 만들면 완료 시각이 거의 같아져 정렬을 확인할 수 없다. 완료
	 * 시각은 저장한 뒤 옮긴다.
	 */
	private void 완료된_업무(
			String content,
			LocalTime dueTime,
			String assigneeName,
			String completedByName,
			LocalDateTime completedAt) {

		Task task = 업무(content, dueTime, assigneeName);
		task.complete(completedByName);
		tasks.save(task);
		jdbc.update("update task set completed_at = ? where id = ?", completedAt, task.getId());
	}

	/**
	 * 생성 시점을 옮긴다.
	 *
	 * <p>{@code createdAt} 은 {@code updatable = false} 라 JPA 로는 바꿀 수 없다. 어제 만들어진 업무를 실제로 만들어
	 * 두지 않으면 당일 경계가 그어지는지 확인할 수 없어 여기서만 SQL 로 옮긴다.
	 */
	private void 생성시점을_옮긴다(Task task, LocalDateTime createdAt) {
		jdbc.update("update task set created_at = ? where id = ?", createdAt, task.getId());
	}

	/** 검토 단계를 거치지 않고 카드를 직접 만든다. 무엇이 카드가 되는지는 카드 쪽 테스트가 본다. */
	private HandoverCard 카드(String nextAction) {
		return cards.save(
				HandoverCard.builder()
						.handover(인계)
						.careRecipient(김말순)
						.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
						.statusChange("점심 식사량 저하")
						.nextAction(nextAction)
						.evidenceText("점심을 거의 안 드셨어요")
						.safetyRelated(false)
						.reviewStatus(ReviewStatus.NEEDS_REVIEW)
						.build());
	}
}
