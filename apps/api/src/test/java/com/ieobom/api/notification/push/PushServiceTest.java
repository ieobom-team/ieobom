package com.ieobom.api.notification.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import tools.jackson.databind.ObjectMapper;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.notification.NotificationType;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import com.ieobom.api.staff.Staff;
import com.ieobom.api.staff.StaffRepository;
import com.ieobom.api.task.Task;
import com.ieobom.api.task.TaskRepository;
import com.ieobom.api.handovercard.ReviewStatus;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class PushServiceTest {

	@Autowired
	private PushService pushService;

	@Autowired
	private PushSubscriptionRepository pushSubscriptionRepository;

	@Autowired
	private StaffRepository staffRepository;

	@Autowired
	private CareRecipientRepository careRecipientRepository;

	@Autowired
	private HandoverRepository handoverRepository;

	@Autowired
	private HandoverCardRepository handoverCardRepository;

	@Autowired
	private TaskRepository taskRepository;

	@Autowired
	private ObjectMapper objectMapper;

	private Staff staff;
	private Task task;

	@BeforeEach
	void setUp() {
		pushSubscriptionRepository.deleteAll();
		taskRepository.deleteAll();
		handoverCardRepository.deleteAll();
		handoverRepository.deleteAll();

		staff = staffRepository.findByCode("ST-001").orElseThrow();
		CareRecipient recipient = careRecipientRepository.findAll().get(0);
		Handover handover =
				handoverRepository.save(
						Handover.builder()
								.careRecipient(recipient)
								.rawText("어르신이 오늘 식사를 잘 못하셨습니다")
								.inputMethod(InputMethod.TEXT)
								.occurredAt(LocalDateTime.now())
								.reporterName("작성자")
								.proxyInput(false)
								.build());
		HandoverCard card =
				handoverCardRepository.save(
						HandoverCard.builder()
								.handover(handover)
								.careRecipient(recipient)
								.evidenceText("어르신이 오늘 식사를 잘 못하셨습니다")
								.safetyRelated(false)
								.reviewStatus(ReviewStatus.REVIEWED)
								.build());

		task =
				taskRepository.save(
						Task.pending(
								card,
								"저녁 식사량 확인 및 투약 보조",
								JobRole.SOCIAL_WORKER,
								"김복지",
								"ST-001",
								LocalTime.of(17, 30)));
	}

	@Test
	@DisplayName("sendTaskPush — VAPID 미설정 또는 네트워크 오류 시에도 예외를 전파하지 않고 안전 격리")
	void sendTaskPushSafelyHandlesError() {
		pushSubscriptionRepository.save(
				new PushSubscription(
						staff,
						"https://fcm.googleapis.com/fcm/send/invalid-token",
						"fake-key",
						"fake-auth"));

		// VAPID 미설정 또는 예외 상황에서도 상위로 throw 되지 않아야 함
		assertThatCode(() -> pushService.sendTaskPush(staff, task, NotificationType.TASK_ASSIGNED))
				.doesNotThrowAnyException();
	}

	@Test
	@DisplayName("sendTaskPush — 구독이 없는 직원에게 발송 시 조용히 종료")
	void sendTaskPushNoSubscription() {
		assertThatCode(() -> pushService.sendTaskPush(staff, task, NotificationType.TASK_ASSIGNED))
				.doesNotThrowAnyException();
	}
}
