package com.ieobom.api.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
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
import com.ieobom.api.notification.NotificationRepository;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
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
import org.springframework.test.web.servlet.MockMvc;

/**
 * 후속 업무 담당자 변경 API 계약 확인. (Manyfast F-IVFNPC permissions)
 */
@SpringBootTest
@AutoConfigureMockMvc
class TaskReassignApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private NotificationRepository notifications;
	@Autowired private TaskRepository tasks;

	private CareRecipient 김말순;
	private Handover 인계;
	private HandoverCard 카드;

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
								.rawText("어르신 식사량이 적으셨습니다.")
								.inputMethod(InputMethod.VOICE)
								.occurredAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
								.reporterName("김요양")
								.proxyInput(false)
								.build());

		카드 =
				cards.save(
						HandoverCard.builder()
								.handover(인계)
								.careRecipient(김말순)
								.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
								.statusChange("식사량 감소")
								.nextAction("저녁 식사량 확인")
								.evidenceText("식사량이 적으셨습니다")
								.safetyRelated(false)
								.reviewStatus(ReviewStatus.NEEDS_REVIEW)
								.build());
	}

	@AfterEach
	void tearDown() {
		notifications.deleteAll();
		tasks.deleteAll();
		cards.deleteAll();
		handovers.deleteAll();
	}

	@Test
	void 담당자가_배정된_업무의_담당자를_바꾼다() throws Exception {
		Task task =
				tasks.save(
						Task.pending(
								카드,
								"저녁 식사량 확인",
								JobRole.NURSE_AIDE,
								"박간호",
								"ST-004",
								LocalTime.of(17, 30)));

		mockMvc.perform(
						patch("/api/tasks/" + task.getId() + "/assignee")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "assigneeJobRole": "NURSE_AIDE",
										  "assigneeName": "최간호",
										  "assigneeStaffCode": "ST-005",
										  "assignedByStaffCode": "ST-001"
										}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(task.getId()))
				.andExpect(jsonPath("$.assigneeName").value("최간호"))
				.andExpect(jsonPath("$.assigneeJobRole").value("NURSE_AIDE"))
				.andExpect(jsonPath("$.claimMethod").value("DIRECT_ASSIGN"))
				.andExpect(jsonPath("$.claimable").value(false));

		Task reloaded = tasks.findById(task.getId()).orElseThrow();
		assertThat(reloaded.getAssigneeName()).isEqualTo("최간호");
		assertThat(reloaded.getAssigneeStaffCode()).isEqualTo("ST-005");
		assertThat(reloaded.getClaimedAt()).isNotNull();
	}

	@Test
	void 직종만_배정된_업무에_사람을_지정해_담당자를_바꾼다() throws Exception {
		Task task =
				tasks.save(
						Task.pending(
								카드,
								"저녁 식사량 확인",
								JobRole.NURSE_AIDE,
								null,
								null,
								LocalTime.of(17, 30)));

		mockMvc.perform(
						patch("/api/tasks/" + task.getId() + "/assignee")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "assigneeJobRole": "NURSE_AIDE",
										  "assigneeName": "최간호",
										  "assigneeStaffCode": "ST-005",
										  "assignedByStaffCode": "ST-001"
										}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.assigneeName").value("최간호"))
				.andExpect(jsonPath("$.claimMethod").value("DIRECT_ASSIGN"))
				.andExpect(jsonPath("$.claimable").value(false));
	}

	@Test
	void 완료된_업무의_담당자는_변경할_수_없다() throws Exception {
		Task task =
				tasks.save(
						Task.pending(
								카드,
								"저녁 식사량 확인",
								JobRole.NURSE_AIDE,
								"박간호",
								"ST-004",
								LocalTime.of(17, 30)));
		task.complete("이복지");
		tasks.save(task);

		mockMvc.perform(
						patch("/api/tasks/" + task.getId() + "/assignee")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "assigneeJobRole": "NURSE_AIDE",
										  "assigneeName": "최간호",
										  "assigneeStaffCode": "ST-005"
										}
										"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TASK_ALREADY_COMPLETED"))
				.andExpect(jsonPath("$.message").value(containsString("완료된 업무의 담당자는 변경할 수 없습니다")));
	}

	@Test
	void 존재하지_않는_업무는_404를_돌려준다() throws Exception {
		mockMvc.perform(
						patch("/api/tasks/99999/assignee")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "assigneeJobRole": "NURSE_AIDE",
										  "assigneeName": "최간호"
										}
										"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
	}

	@Test
	void 직종도_담당자도_지정하지_않으면_400을_돌려준다() throws Exception {
		Task task =
				tasks.save(
						Task.pending(
								카드,
								"저녁 식사량 확인",
								JobRole.NURSE_AIDE,
								"박간호",
								"ST-004",
								LocalTime.of(17, 30)));

		mockMvc.perform(
						patch("/api/tasks/" + task.getId() + "/assignee")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "assigneeJobRole": null,
										  "assigneeName": "   "
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
	}
}
