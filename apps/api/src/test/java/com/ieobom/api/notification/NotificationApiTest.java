package com.ieobom.api.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import com.ieobom.api.task.Task;
import com.ieobom.api.task.TaskRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 알림함 조회와 읽음 처리 계약. (Manyfast F-JIEOJO display · rules · permissions)
 *
 * <p>여기서 보는 것은 세 가지다. <b>배지가 당일분만 세는가</b>, <b>목록을 여는 것만으로는 읽음이 되지 않는가</b>, 그리고 <b>남의
 * 알림에 닿지 못하는가</b>.
 *
 * <p>알림은 서비스로 직접 만든다. 어떤 배정이 어떤 알림을 만드는지는 {@code NotificationCreationTest} 가 이미 보고,
 * 여기서는 <b>만들어진 뒤</b>를 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class NotificationApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private NotificationRepository notifications;
	@Autowired private TaskRepository tasks;
	@Autowired private StaffRepository staffs;
	@Autowired private JdbcTemplate jdbc;

	private CareRecipient 김말순;
	private Handover 인계;
	private Staff 최민재;
	private Staff 정유진;

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

		최민재 = staffs.findByJobRole(JobRole.NURSE_AIDE).get(0);
		정유진 = staffs.findByJobRole(JobRole.NURSE_AIDE).get(1);
	}

	@AfterEach
	void tearDown() {
		notifications.deleteAll();
		tasks.deleteAll();
	}

	@Test
	void 알림함은_어르신_업무_배정자_기한을_담아_돌려준다() throws Exception {
		알림(최민재, 업무("저녁 식사량 확인", false), NotificationType.TASK_ASSIGNED, "이복지");

		mockMvc
				.perform(get("/api/notifications").param("staffCode", 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.staffCode").value(최민재.getCode()))
				.andExpect(jsonPath("$.unreadCount").value(1))
				.andExpect(jsonPath("$.today.length()").value(1))
				.andExpect(jsonPath("$.past.length()").value(0))
				.andExpect(jsonPath("$.today[0].type").value("TASK_ASSIGNED"))
				.andExpect(jsonPath("$.today[0].typeLabel").value("새 업무 배정"))
				.andExpect(jsonPath("$.today[0].read").value(false))
				.andExpect(jsonPath("$.today[0].readAt").doesNotExist())
				.andExpect(jsonPath("$.today[0].actorName").value("이복지"))
				.andExpect(jsonPath("$.today[0].safetyRelated").value(false))
				// 업무를 통째로 중첩한다. 화면이 알림함과 업무 상세에서 같은 값을 그린다
				.andExpect(jsonPath("$.today[0].task.careRecipientName").value(김말순.getName()))
				.andExpect(jsonPath("$.today[0].task.content").value("저녁 식사량 확인"))
				.andExpect(jsonPath("$.today[0].task.dueTime").value("17:30"))
				.andExpect(jsonPath("$.today[0].task.claimable").value(true));
	}

	/**
	 * 누적 보관하되 배지는 당일분만 센다. (Manyfast F-JIEOJO rules)
	 *
	 * <p>지난 알림이 <b>사라지지 않으면서</b> 배지에는 들어가지 않는 것이 이 규칙의 요점이다. 사라지면 조회가 안 되고, 배지에 들어가면
	 * 어제 못 본 알림이 오늘 숫자로 남아 범위 밖인 "다음 교대 자동 승계"와 구분되지 않는다.
	 */
	@Test
	void 지난_알림은_조회되지만_읽지_않은_개수에는_세지_않는다() throws Exception {
		알림(최민재, 업무("저녁 식사량 확인", false), NotificationType.TASK_ASSIGNED, "이복지");
		Notification 어제것 = 알림(최민재, 업무("수분 섭취 확인", false), NotificationType.TASK_ASSIGNED, "이복지");
		어제로_돌린다(어제것);

		mockMvc
				.perform(get("/api/notifications").param("staffCode", 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.today.length()").value(1))
				.andExpect(jsonPath("$.past.length()").value(1))
				.andExpect(jsonPath("$.past[0].read").value(false))
				// 읽지 않은 지난 알림이 있어도 배지는 오늘 것만 센다
				.andExpect(jsonPath("$.unreadCount").value(1));
	}

	/** 안전 관련 카드에서 나온 업무의 알림이 위에 온다. (Manyfast F-JIEOJO display) */
	@Test
	void 안전_관련_업무의_알림이_목록_위에_온다() throws Exception {
		알림(최민재, 업무("저녁 식사량 확인", false), NotificationType.TASK_ASSIGNED, "이복지");
		알림(최민재, 업무("낙상 부위 확인", true), NotificationType.TASK_ASSIGNED, "이복지");

		mockMvc
				.perform(get("/api/notifications").param("staffCode", 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.today[0].safetyRelated").value(true))
				.andExpect(jsonPath("$.today[0].task.content").value("낙상 부위 확인"))
				.andExpect(jsonPath("$.today[1].safetyRelated").value(false));
	}

	/** 목록을 여는 것만으로는 읽음으로 바꾸지 않는다. (Manyfast F-JIEOJO rules) */
	@Test
	void 목록을_여는_것만으로는_읽음이_되지_않는다() throws Exception {
		Notification 알림 = 알림(최민재, 업무("저녁 식사량 확인", false), NotificationType.TASK_ASSIGNED, "이복지");

		mockMvc
				.perform(get("/api/notifications").param("staffCode", 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(1));

		assertThat(notifications.findById(알림.getId()).orElseThrow().getReadAt()).isNull();
	}

	@Test
	void 항목을_선택하면_그_항목만_읽음이_된다() throws Exception {
		Notification 첫째 = 알림(최민재, 업무("저녁 식사량 확인", false), NotificationType.TASK_ASSIGNED, "이복지");
		알림(최민재, 업무("수분 섭취 확인", false), NotificationType.TASK_ASSIGNED, "이복지");

		mockMvc
				.perform(읽음(첫째.getId(), 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(첫째.getId()))
				.andExpect(jsonPath("$.read").value(true))
				.andExpect(jsonPath("$.readAt").exists());

		mockMvc
				.perform(get("/api/notifications").param("staffCode", 최민재.getCode()))
				.andExpect(jsonPath("$.unreadCount").value(1));
	}

	/** 두 번 눌러도 읽음 시각이 지금으로 옮겨 가지 않는다. 배정에서 확인까지 걸린 시간이 그 값에서 나온다. */
	@Test
	void 이미_읽은_알림을_다시_눌러도_읽음_시각이_덮이지_않는다() throws Exception {
		Notification 알림 = 알림(최민재, 업무("저녁 식사량 확인", false), NotificationType.TASK_ASSIGNED, "이복지");

		mockMvc.perform(읽음(알림.getId(), 최민재.getCode())).andExpect(status().isOk());
		LocalDateTime 처음 = notifications.findById(알림.getId()).orElseThrow().getReadAt();

		mockMvc
				.perform(읽음(알림.getId(), 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.read").value(true));

		assertThat(notifications.findById(알림.getId()).orElseThrow().getReadAt()).isEqualTo(처음);
	}

	/** 자신에게 온 알림만 본다. (Manyfast F-JIEOJO permissions) */
	@Test
	void 다른_직원의_알림은_목록에도_없고_읽지도_못한다() throws Exception {
		Notification 정유진것 =
				알림(정유진, 업무("저녁 식사량 확인", false), NotificationType.TASK_ASSIGNED, "이복지");

		mockMvc
				.perform(get("/api/notifications").param("staffCode", 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.today.length()").value(0))
				.andExpect(jsonPath("$.unreadCount").value(0));

		mockMvc
				.perform(읽음(정유진것.getId(), 최민재.getCode()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));

		assertThat(notifications.findById(정유진것.getId()).orElseThrow().getReadAt()).isNull();
	}

	@Test
	void 알림이_없으면_빈_목록과_0을_돌려준다() throws Exception {
		mockMvc
				.perform(get("/api/notifications").param("staffCode", 최민재.getCode()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unreadCount").value(0))
				.andExpect(jsonPath("$.today.length()").value(0))
				.andExpect(jsonPath("$.past.length()").value(0));
	}

	@Test
	void 사번이_없거나_명단에_없으면_형태가_같은_오류로_돌려준다() throws Exception {
		mockMvc
				.perform(get("/api/notifications"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("staffCode"));

		mockMvc
				.perform(get("/api/notifications").param("staffCode", "ST-없음"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("STAFF_NOT_FOUND"));
	}

	@Test
	void 없는_알림을_읽으려_하면_404_다() throws Exception {
		mockMvc
				.perform(읽음(9_999_999L, 최민재.getCode()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));
	}

	private MockHttpServletRequestBuilder 읽음(Long notificationId, String staffCode) {
		return patch("/api/notifications/{id}/read", notificationId)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"staffCode\": \"%s\"}".formatted(staffCode));
	}

	private Notification 알림(Staff recipient, Task task, NotificationType type, String actorName) {
		return notifications.save(
				Notification.builder()
						.recipientStaff(recipient)
						.task(task)
						.type(type)
						.actorName(actorName)
						.build());
	}

	/** 생성 시각은 {@code @PrePersist} 가 채우므로 지난 알림은 SQL 로 되돌린다. */
	private void 어제로_돌린다(Notification notification) {
		jdbc.update(
				"update notification set created_at = ? where id = ?",
				LocalDate.now().minusDays(1).atTime(9, 0),
				notification.getId());
	}

	private Task 업무(String content, boolean safetyRelated) {
		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(인계)
								.careRecipient(김말순)
								.observedAt(
										LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
								.statusChange("점심 식사량 저하")
								.nextAction(content)
								.evidenceText("점심을 거의 안 드셨어요")
								.safetyRelated(safetyRelated)
								.reviewStatus(ReviewStatus.NEEDS_REVIEW)
								.build());

		return tasks.save(
				Task.pending(card, content, JobRole.NURSE_AIDE, null, null, LocalTime.of(17, 30)));
	}
}
