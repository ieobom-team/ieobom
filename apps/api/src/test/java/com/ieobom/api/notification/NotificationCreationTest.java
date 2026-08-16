package com.ieobom.api.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import com.ieobom.api.staff.Staff;
import com.ieobom.api.staff.StaffRepository;
import com.ieobom.api.task.TaskRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 알림이 <b>누구에게</b> 만들어지고 누구에게 만들어지지 않는가. (Manyfast F-JIEOJO action · exceptions)
 *
 * <p>조회와 읽음 처리 계약은 {@code NotificationApiTest} 가 본다. 여기서 보는 것은 하나다 — 배정한 사실이 <b>닿아야 할
 * 사람에게만</b> 닿는가.
 *
 * <p>알림은 업무 생성이 커밋된 뒤 {@code NotificationEventListener} 에서 만들어진다. MockMvc 로 실제 요청을 보내야
 * 그 커밋이 일어나므로, 이 테스트는 서비스를 직접 부르지 않고 API 를 거친다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class NotificationCreationTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private NotificationRepository notifications;
	@Autowired private TaskRepository tasks;
	@Autowired private StaffRepository staffs;
	@Autowired private NotificationService notificationService;
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

	@AfterEach
	void tearDown() {
		notifications.deleteAll();
		tasks.deleteAll();
	}

	@Test
	void 직종에만_배정하면_그_직종_전원에게_알림이_간다() throws Exception {
		List<Staff> 간호조무사 = staffs.findByJobRole(JobRole.NURSE_AIDE);
		assertThat(간호조무사).hasSizeGreaterThan(1);

		배정한다(카드("저녁 식사량 확인"), """
				{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
				""");

		assertThat(notifications.findAll())
				.hasSize(간호조무사.size())
				.allSatisfy(n -> assertThat(n.getType()).isEqualTo(NotificationType.TASK_ASSIGNED));
		assertThat(수신자_사번들())
				.containsExactlyInAnyOrderElementsOf(간호조무사.stream().map(Staff::getCode).toList());
	}

	@Test
	void 특정_담당자로_배정하면_그_직원에게만_알림이_간다() throws Exception {
		Staff 최민재 = 직원(JobRole.NURSE_AIDE);

		배정한다(
				카드("저녁 식사량 확인"),
				"""
				{
				  "content": "저녁 식사량 확인",
				  "assigneeJobRole": "NURSE_AIDE",
				  "assigneeName": "%s",
				  "assigneeStaffCode": "%s",
				  "dueTime": "17:30"
				}
				"""
						.formatted(최민재.getName(), 최민재.getCode()));

		assertThat(notifications.findAll())
				.singleElement()
				.satisfies(
						n -> {
							assertThat(n.getType()).isEqualTo(NotificationType.TASK_ASSIGNED);
							assertThat(n.getReadAt()).isNull();
						});
		assertThat(수신자_사번들()).containsExactly(최민재.getCode());
	}

	/**
	 * 배정한 사람에게는 알리지 않는다. (Manyfast F-JIEOJO exceptions)
	 *
	 * <p>직종 전원 알림에서 확인하는 이유는, 이 규칙이 실제로 걸리는 곳이 거기이기 때문이다. 자기 직종에 업무를 던지는 것은 현장의 정상
	 * 경로이고, 그때 배정한 본인의 알림함만 조용해야 한다.
	 */
	@Test
	void 배정한_사람과_수신_직원이_같으면_그_사람에게만_알림을_만들지_않는다() throws Exception {
		List<Staff> 간호조무사 = staffs.findByJobRole(JobRole.NURSE_AIDE);
		Staff 배정자 = 간호조무사.get(0);

		배정한다(
				카드("저녁 식사량 확인"),
				"""
				{
				  "content": "저녁 식사량 확인",
				  "assigneeJobRole": "NURSE_AIDE",
				  "assignedByStaffCode": "%s",
				  "dueTime": "17:30"
				}
				"""
						.formatted(배정자.getCode()));

		assertThat(notifications.findAll())
				.hasSize(간호조무사.size() - 1)
				.allSatisfy(n -> assertThat(n.getActorName()).isEqualTo(배정자.getName()));
		assertThat(수신자_사번들()).doesNotContain(배정자.getCode());
	}

	/** 배정된 직종에 등록된 직원이 없으면 알림 없이 업무만 생긴다. (Manyfast F-JIEOJO exceptions) */
	@Test
	void 직종에_등록된_직원이_없으면_알림_없이_업무만_생긴다() throws Exception {
		List<Staff> 운전원 = staffs.findByJobRole(JobRole.DRIVER);
		staffs.deleteAll(운전원);
		try {
			배정한다(카드("차량 좌석 확인"), """
					{"content": "차량 좌석 확인", "assigneeJobRole": "DRIVER", "dueTime": "17:30"}
					""");

			assertThat(tasks.findAll()).hasSize(1);
			assertThat(notifications.findAll()).isEmpty();
		} finally {
			// 시드는 기동 시 한 번만 돌므로 지운 명단은 이 테스트가 되돌린다.
			운전원.forEach(
					staff ->
							staffs.save(
									Staff.builder()
											.name(staff.getName())
											.code(staff.getCode())
											.jobRole(staff.getJobRole())
											.build()));
		}
	}

	/**
	 * 같은 업무 · 같은 수신자 · 같은 유형은 두 번 만들어지지 않는다. (Manyfast F-JIEOJO dataSpec)
	 *
	 * <p>카드 한 장에 업무 하나라 API 로는 같은 배정을 두 번 보낼 수 없어서, 여기서만 서비스를 직접 부른다. 화면이 아니라 <b>알림을
	 * 만드는 쪽</b>이 두 번 불렸을 때를 보는 검사다.
	 */
	@Test
	void 같은_업무_같은_직원_같은_유형의_알림은_두_번_만들어지지_않는다() throws Exception {
		배정한다(카드("저녁 식사량 확인"), """
				{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
				""");
		int 처음 = notifications.findAll().size();
		Long taskId = tasks.findAll().get(0).getId();

		notificationService.notifyAssigned(taskId, null);

		assertThat(notifications.findAll()).hasSize(처음);
	}

	/** 담당자가 정해진 업무를 다른 사람이 닫으면 담당자에게 알린다. (Manyfast F-JIEOJO action) */
	@Test
	void 대리_완료하면_담당자에게_알림이_간다() throws Exception {
		Staff 최민재 = 직원(JobRole.NURSE_AIDE);
		Long taskId = 담당자가_있는_업무(최민재);
		notifications.deleteAll();

		완료한다(taskId, "이복지");

		assertThat(notifications.findAll())
				.singleElement()
				.satisfies(
						n -> {
							assertThat(n.getType())
									.isEqualTo(NotificationType.DELEGATED_COMPLETION);
							assertThat(n.getActorName()).isEqualTo("이복지");
						});
		assertThat(수신자_사번들()).containsExactly(최민재.getCode());
	}

	/** 본인이 닫은 것은 대리가 아니다. 알릴 사실이 없다. (Manyfast F-JIEOJO exceptions) */
	@Test
	void 담당자_본인이_완료하면_알림을_만들지_않는다() throws Exception {
		Staff 최민재 = 직원(JobRole.NURSE_AIDE);
		Long taskId = 담당자가_있는_업무(최민재);
		notifications.deleteAll();

		완료한다(taskId, 최민재.getName());

		assertThat(notifications.findAll()).isEmpty();
	}

	/** 담당자가 없는 업무는 대리 완료를 판정할 근거가 없다. 알릴 담당자도 없다. */
	@Test
	void 직종에만_배정된_업무를_완료해도_대리_완료_알림은_없다() throws Exception {
		배정한다(카드("저녁 식사량 확인"), """
				{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
				""");
		Long taskId = tasks.findAll().get(0).getId();
		notifications.deleteAll();

		완료한다(taskId, "이복지");

		assertThat(notifications.findAll()).isEmpty();
	}

	/**
	 * 알림 경로가 업무 생성을 막지 않는다.
	 *
	 * <p>명단에 없는 사번이 와도 {@code 201} 이다. 알림용 칸이 업무를 400 으로 막으면 "알림이 실패해도 업무 생성은 성공한다"가
	 * 요청 검증 단계에서 뒤집힌다.
	 */
	@Test
	void 명단에_없는_사번이_와도_업무는_그대로_만들어진다() throws Exception {
		배정한다(
				카드("저녁 식사량 확인"),
				"""
				{
				  "content": "저녁 식사량 확인",
				  "assigneeJobRole": "NURSE_AIDE",
				  "assigneeName": "박간호",
				  "assigneeStaffCode": "ST-없음",
				  "assignedByStaffCode": "ST-도없음",
				  "dueTime": "17:30"
				}
				""");

		assertThat(tasks.findAll()).hasSize(1);
		assertThat(notifications.findAll()).isEmpty();
	}

	/** 담당 확정으로 사람이 붙으면 그 사번이 업무에 남아, 나중에 대리 완료 알림이 갈 곳이 생긴다. */
	@Test
	void 담당_확정한_직원이_대리_완료_알림을_받는다() throws Exception {
		Staff 최민재 = 직원(JobRole.NURSE_AIDE);
		배정한다(카드("저녁 식사량 확인"), """
				{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
				""");
		Long taskId = tasks.findAll().get(0).getId();

		mockMvc
				.perform(
						patch("/api/tasks/{id}/claim", taskId)
								.contentType(MediaType.APPLICATION_JSON)
								.content("{\"staffCode\": \"%s\"}".formatted(최민재.getCode())))
				.andExpect(status().isOk());
		notifications.deleteAll();

		완료한다(taskId, "이복지");

		assertThat(notifications.findAll())
				.singleElement()
				.satisfies(
						n ->
								assertThat(n.getType())
										.isEqualTo(NotificationType.DELEGATED_COMPLETION));
		assertThat(수신자_사번들()).containsExactly(최민재.getCode());
	}

	/**
	 * 저장된 알림의 수신자 사번.
	 *
	 * <p>SQL 로 읽는 이유는 {@code open-in-view: false} 라 {@code findAll()} 이 돌려준 알림에서
	 * {@code getRecipientStaff()} 를 건드리면 세션 밖 지연 로딩으로 깨지기 때문이다. 조회 경로는
	 * {@code NotificationApiTest} 가 API 로 확인하고, 여기서는 <b>어느 행이 만들어졌는가</b>만 본다.
	 */
	private List<String> 수신자_사번들() {
		return jdbc.queryForList(
				"select s.code from notification n join staff s on s.id = n.recipient_staff_id",
				String.class);
	}

	private Long 담당자가_있는_업무(Staff assignee) throws Exception {
		배정한다(
				카드("저녁 식사량 확인"),
				"""
				{
				  "content": "저녁 식사량 확인",
				  "assigneeJobRole": "NURSE_AIDE",
				  "assigneeName": "%s",
				  "assigneeStaffCode": "%s",
				  "dueTime": "17:30"
				}
				"""
						.formatted(assignee.getName(), assignee.getCode()));
		return tasks.findAll().get(0).getId();
	}

	private void 배정한다(HandoverCard card, String body) throws Exception {
		mockMvc
				.perform(
						post("/api/handover-cards/{cardId}/tasks", card.getId())
								.contentType(MediaType.APPLICATION_JSON)
								.content(body))
				.andExpect(status().isCreated());
	}

	private void 완료한다(Long taskId, String completedByName) throws Exception {
		mockMvc
				.perform(
						patch("/api/tasks/{id}/complete", taskId)
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"{\"completedByName\": \"%s\"}".formatted(completedByName)))
				.andExpect(status().isOk());
	}

	private void 담당자를_바꾼다(Long taskId, String body) throws Exception {
		mockMvc
				.perform(
						patch("/api/tasks/{id}/assignee", taskId)
								.contentType(MediaType.APPLICATION_JSON)
								.content(body))
				.andExpect(status().isOk());
	}

	/**
	 * 관리자가 담당자를 바꾸면 새 담당자에게 배정 알림을, 이전 담당자에게 담당 변경 알림을 만든다. (Manyfast F-JIEOJO action)
	 */
	@Test
	void 담당자_변경_시_새_담당자와_이전_담당자_양쪽에_알림이_만들어진다() throws Exception {
		List<Staff> 간호조무사들 = staffs.findByJobRole(JobRole.NURSE_AIDE);
		Staff 이전담당자 = 간호조무사들.get(0);
		Staff 새담당자 = 간호조무사들.get(1);

		Long taskId = 담당자가_있는_업무(이전담당자);
		notifications.deleteAll();

		담당자를_바꾼다(
				taskId,
				"""
				{
				  "assigneeJobRole": "NURSE_AIDE",
				  "assigneeName": "%s",
				  "assigneeStaffCode": "%s",
				  "assignedByStaffCode": "ST-006"
				}
				"""
						.formatted(새담당자.getName(), 새담당자.getCode()));

		List<Notification> 알림들 = notifications.findAll();
		assertThat(알림들).hasSize(2);

		Notification 새담당자_알림 =
				알림들.stream()
						.filter(n -> n.getType() == NotificationType.TASK_ASSIGNED)
						.findFirst()
						.orElseThrow();
		assertThat(새담당자_알림.getActorName()).isEqualTo("강태호");
		assertThat(
						jdbc.queryForObject(
								"select s.code from notification n join staff s on s.id = n.recipient_staff_id where n.id = ?",
								String.class,
								새담당자_알림.getId()))
				.isEqualTo(새담당자.getCode());

		Notification 이전담당자_알림 =
				알림들.stream()
						.filter(n -> n.getType() == NotificationType.ASSIGNEE_CHANGED)
						.findFirst()
						.orElseThrow();
		assertThat(이전담당자_알림.getActorName()).isEqualTo("강태호");
		assertThat(
						jdbc.queryForObject(
								"select s.code from notification n join staff s on s.id = n.recipient_staff_id where n.id = ?",
								String.class,
								이전담당자_알림.getId()))
				.isEqualTo(이전담당자.getCode());
	}

	/** 이전 담당자가 없던 업무(직종만 배정)를 사람으로 바꾸면 ASSIGNEE_CHANGED 는 만들지 않는다. (Manyfast F-JIEOJO action) */
	@Test
	void 이전_담당자가_없던_업무의_담당자를_지정하면_ASSIGNEE_CHANGED_는_만들지_않는다() throws Exception {
		배정한다(
				카드("저녁 식사량 확인"),
				"""
				{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
				""");
		Long taskId = tasks.findAll().get(0).getId();
		notifications.deleteAll();

		Staff 새담당자 = 직원(JobRole.NURSE_AIDE);
		담당자를_바꾼다(
				taskId,
				"""
				{
				  "assigneeJobRole": "NURSE_AIDE",
				  "assigneeName": "%s",
				  "assigneeStaffCode": "%s",
				  "assignedByStaffCode": "ST-001"
				}
				"""
						.formatted(새담당자.getName(), 새담당자.getCode()));

		List<Notification> 알림들 = notifications.findAll();
		assertThat(알림들).singleElement().satisfies(n -> {
			assertThat(n.getType()).isEqualTo(NotificationType.TASK_ASSIGNED);
		});
		assertThat(수신자_사번들()).containsExactly(새담당자.getCode());
	}

	/** 변경자와 수신자가 같으면 알림을 만들지 않는다. (Manyfast F-JIEOJO exceptions) */
	@Test
	void 변경자가_새_담당자_또는_이전_담당자_자신이면_해당_알림은_만들지_않는다() throws Exception {
		List<Staff> 간호조무사들 = staffs.findByJobRole(JobRole.NURSE_AIDE);
		Staff 이전담당자 = 간호조무사들.get(0);
		Staff 새담당자 = 간호조무사들.get(1);

		Long taskId = 담당자가_있는_업무(이전담당자);
		notifications.deleteAll();

		담당자를_바꾼다(
				taskId,
				"""
				{
				  "assigneeJobRole": "NURSE_AIDE",
				  "assigneeName": "%s",
				  "assigneeStaffCode": "%s",
				  "assignedByStaffCode": "%s"
				}
				"""
						.formatted(새담당자.getName(), 새담당자.getCode(), 새담당자.getCode()));

		List<Notification> 알림들 = notifications.findAll();
		assertThat(알림들).singleElement().satisfies(n -> {
			assertThat(n.getType()).isEqualTo(NotificationType.ASSIGNEE_CHANGED);
		});
		assertThat(수신자_사번들()).containsExactly(이전담당자.getCode());
	}

	private Staff 직원(JobRole jobRole) {
		return staffs.findByJobRole(jobRole).stream().findFirst().orElseThrow();
	}

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
