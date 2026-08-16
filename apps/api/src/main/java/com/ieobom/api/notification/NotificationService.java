package com.ieobom.api.notification;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.notification.dto.NotificationListResponse;
import com.ieobom.api.notification.dto.NotificationResponse;
import com.ieobom.api.staff.Staff;
import com.ieobom.api.staff.StaffRepository;
import com.ieobom.api.task.Task;
import com.ieobom.api.task.TaskRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 배정 사실을 담당 직원에게 닿게 한다. (Manyfast F-JIEOJO)
 *
 * <p>이 서비스가 지키는 것은 세 가지다. <b>누구에게 만드는가</b>(특정 담당자 하나 / 직종 전원), <b>만들지 않는 경우</b>(배정자
 * 자신 · 명단에 없는 사람 · 이미 있는 알림), 그리고 <b>배지를 당일분만 센다</b>는 것이다.
 *
 * <p><b>알림은 업무 생성 트랜잭션 밖에서 만들어진다.</b> 부르는 쪽은 {@code TaskService} 가 아니라 커밋 이후에 도는
 * {@code NotificationEventListener} 다. 업무 생성이 알림 실패로 롤백되면 안 된다는 것이 이 Issue 의 확정 사항이고, 같은
 * 트랜잭션 안에서 try/catch 로 감싸는 것으로는 그것을 지킬 수 없다 — JPA 예외 하나면 트랜잭션에 롤백 표시가 남아 업무까지 함께
 * 죽는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

	static final String STAFF_NOT_FOUND = "STAFF_NOT_FOUND";
	static final String NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND";

	/**
	 * 안전 관련이 먼저, 그다음 최신순. (Manyfast F-JIEOJO display)
	 *
	 * <p>같은 시각이면 id 역순으로 갈라 순서를 고정한다. 30초마다 다시 조회하는 화면이라 (F-JIEOJO rules) 같은 값에서
	 * 순서가 흔들리면 목록이 주기적으로 뒤집힌다.
	 */
	private static final Comparator<Notification> SAFETY_FIRST_THEN_LATEST =
			Comparator.comparing((Notification n) -> !n.getTask().getHandoverCard().isSafetyRelated())
					.thenComparing(Notification::getCreatedAt, Comparator.reverseOrder())
					.thenComparing(Notification::getId, Comparator.reverseOrder());

	private final NotificationRepository notificationRepository;
	private final StaffRepository staffRepository;
	private final TaskRepository taskRepository;

	/**
	 * 배정 알림을 만든다. (Manyfast F-JIEOJO action)
	 *
	 * <p>수신자는 담당자가 정해졌는지로 갈린다 — 사람이 정해졌으면 그 한 명, 직종까지만 정해졌으면 그 직종 <b>전원</b>이다.
	 * 직종 전원인 이유는 배정 화면의 담당자 기본값이 '직종만 배정'이라, 그 업무를 자기 일로 인식할 계기가 알림 말고는 없기 때문이다.
	 *
	 * @param assignedByStaffCode 배정한 직원의 사번. 없으면 배정자를 모르는 것으로 두고 자기 자신 제외 판정만 건너뛴다
	 */
	@Transactional
	public void notifyAssigned(Long taskId, String assignedByStaffCode) {
		Task task = taskRepository.findWithCard(taskId).orElse(null);
		if (task == null) {
			log.warn("배정 알림 대상 업무가 없음 — taskId={}", taskId);
			return;
		}

		Staff actor = findStaffOrNull(assignedByStaffCode);
		List<Staff> recipients = assignmentRecipients(task);

		if (recipients.isEmpty()) {
			log.info(
					"배정 알림 수신자 없음 — taskId={}, 담당직종={}, 담당자지정={}",
					taskId,
					task.getAssigneeJobRole(),
					task.getAssigneeName() != null);
			return;
		}

		int created = 0;
		for (Staff recipient : recipients) {
			if (create(recipient, task, NotificationType.TASK_ASSIGNED, actorName(actor), actor)) {
				created++;
			}
		}

		logCreated(NotificationType.TASK_ASSIGNED, task, recipients.size(), created);
	}

	/**
	 * 대리 완료 알림을 만든다. (Manyfast F-JIEOJO action — "담당자가 정해진 업무를 다른 사람이 완료하면")
	 *
	 * <p>대리인지 아닌지는 {@code Task#isDelegated} 하나로 가른다. 담당자가 없는 업무(직종에만 배정된 채 아무도 맡지 않고
	 * 닫힌 업무)는 거짓이라 알림이 없다 — 알릴 담당자가 없다. 본인이 직접 닫았을 때도 거짓이라 알림이 없고, 그것이 "배정한 사람과
	 * 수신 직원이 같으면 만들지 않는다"와 같은 규칙의 완료 쪽 얼굴이다. (F-JIEOJO exceptions)
	 */
	@Transactional
	public void notifyDelegatedCompletion(Long taskId) {
		Task task = taskRepository.findWithCard(taskId).orElse(null);
		if (task == null) {
			log.warn("대리 완료 알림 대상 업무가 없음 — taskId={}", taskId);
			return;
		}
		if (!task.isDelegated()) {
			return;
		}

		Staff recipient = findStaffOrNull(task.getAssigneeStaffCode());
		if (recipient == null) {
			log.info("대리 완료 알림 수신자를 명단에서 찾지 못함 — taskId={}", taskId);
			return;
		}

		boolean created =
				create(
						recipient,
						task,
						NotificationType.DELEGATED_COMPLETION,
						task.getCompletedByName(),
						null);

		logCreated(NotificationType.DELEGATED_COMPLETION, task, 1, created ? 1 : 0);
	}

	/**
	 * 관리자의 담당자 변경 알림을 만든다. (Manyfast F-JIEOJO action)
	 *
	 * <p>새 담당자에게는 배정 알림(TASK_ASSIGNED)을, 이전 담당자에게는 담당 변경 알림(ASSIGNEE_CHANGED)을 만든다.
	 * 이전 담당자가 없었던 업무(직종만 배정)는 담당 변경 알림을 만들지 않는다. (알릴 이전 담당자가 없음)
	 * 변경자와 수신자가 같으면 알림을 만들지 않는다. (F-JIEOJO exceptions)
	 */
	@Transactional
	public void notifyAssigneeChanged(
			Long taskId, String oldStaffCode, String newStaffCode, String assignedByStaffCode) {
		Task task = taskRepository.findWithCard(taskId).orElse(null);
		if (task == null) {
			log.warn("담당 변경 알림 대상 업무가 없음 — taskId={}", taskId);
			return;
		}

		Staff actor = findStaffOrNull(assignedByStaffCode);

		// 1. 새 담당자(또는 직종 전원)에게 TASK_ASSIGNED 알림
		List<Staff> newRecipients = assignmentRecipients(task);
		int assignedCreated = 0;
		for (Staff recipient : newRecipients) {
			if (oldStaffCode != null && oldStaffCode.equals(recipient.getCode())) {
				continue;
			}
			if (create(recipient, task, NotificationType.TASK_ASSIGNED, actorName(actor), actor)) {
				assignedCreated++;
			}
		}
		if (!newRecipients.isEmpty()) {
			logCreated(NotificationType.TASK_ASSIGNED, task, newRecipients.size(), assignedCreated);
		}

		// 2. 이전 담당자에게 ASSIGNEE_CHANGED 알림
		if (oldStaffCode != null && !oldStaffCode.equals(newStaffCode)) {
			Staff oldRecipient = findStaffOrNull(oldStaffCode);
			if (oldRecipient != null) {
				boolean changedCreated =
						create(
								oldRecipient,
								task,
								NotificationType.ASSIGNEE_CHANGED,
								actorName(actor),
								actor);
				logCreated(
						NotificationType.ASSIGNEE_CHANGED,
						task,
						1,
						changedCreated ? 1 : 0);
			}
		}
	}

	/**
	 * 한 직원의 알림함. (Manyfast F-JIEOJO display)
	 *
	 * <p><b>여는 것만으로는 읽음이 되지 않는다.</b> (F-JIEOJO rules) 읽기 전용 트랜잭션인 것이 그 규칙을 형태로 지킨다 —
	 * 여기서 무엇을 고치려 해도 나가지 않는다.
	 *
	 * @throws NotFoundException 명단에 없는 사번일 때
	 */
	@Transactional(readOnly = true)
	public NotificationListResponse findForStaff(String staffCode) {
		Staff staff = findStaff(staffCode);
		LocalDateTime todayStart = LocalDate.now().atStartOfDay();

		List<Notification> today = new ArrayList<>();
		List<Notification> past = new ArrayList<>();
		for (Notification notification : notificationRepository.findAllForStaff(staff.getId())) {
			(notification.getCreatedAt().isBefore(todayStart) ? past : today).add(notification);
		}

		int unreadCount = (int) today.stream().filter(n -> !n.isRead()).count();

		logListViewed(staff, today.size(), past.size(), unreadCount);
		return new NotificationListResponse(
				staff.getCode(), unreadCount, sorted(today), sorted(past));
	}

	/**
	 * 알림 하나를 읽음으로 바꾼다. (Manyfast F-JIEOJO action — "사용자가 알림을 선택하면 그 알림이 읽음으로 바뀐다")
	 *
	 * <p><b>이미 읽은 알림에 다시 불러도 오류가 아니다.</b> 아무것도 바꾸지 않고 지금 상태를 돌려준다. 완료 처리 · 담당 확정과 같은
	 * 방침이다 — 화면이 보여 줘야 하는 것은 "실패했다"가 아니라 지금 그 알림이 어떤 상태인지다.
	 *
	 * @throws NotFoundException 그 직원의 알림이 아니거나 없을 때
	 */
	@Transactional
	public NotificationResponse markRead(Long notificationId, String staffCode) {
		Notification notification =
				notificationRepository
						.findForStaff(notificationId, staffCode)
						.orElseThrow(
								() ->
										new NotFoundException(
												NOTIFICATION_NOT_FOUND, "알림을 찾을 수 없습니다."));

		boolean wasRead = notification.isRead();
		notification.markRead();

		if (!wasRead) {
			logRead(notification);
		}
		return NotificationResponse.from(notification);
	}

	/**
	 * 이 업무의 배정 알림을 받을 사람들. (Manyfast F-JIEOJO action)
	 *
	 * <p>담당자 사번이 있으면 그 한 명만 본다. <b>이름으로 되짚지 않는다</b> — 동명이인일 때 누구에게 보낼지 정할 수 없고, 그 경우
	 * 조용히 아무에게도 안 보내면 배정 사실이 닿지 않는다. 사번을 받는 이유가 그것이다.
	 *
	 * <p>담당자 이름은 있는데 사번이 없으면 (화면이 아직 사번을 보내지 않는 경로) 수신자를 특정할 수 없어 알림이 없다. 직종 전원으로
	 * 넓히지 않는 이유는, 사람이 이미 정해진 업무를 직종 전원에게 알리면 <b>내 일이 아닌 업무</b>가 여섯 명의 알림함에 뜨기 때문이다.
	 */
	private List<Staff> assignmentRecipients(Task task) {
		if (task.getAssigneeName() != null) {
			Staff assignee = findStaffOrNull(task.getAssigneeStaffCode());
			return assignee == null ? List.of() : List.of(assignee);
		}

		JobRole jobRole = task.getAssigneeJobRole();
		return jobRole == null ? List.of() : staffRepository.findByJobRole(jobRole);
	}

	/**
	 * 알림 한 건을 만든다. 만들었으면 참.
	 *
	 * <p>두 경우에 만들지 않는다. <b>배정한 사람이 수신자 자신</b>이면 (F-JIEOJO exceptions) 이미 아는 사실이고, 직종 전원
	 * 알림에서 배정자 본인의 알림함만 조용한 것이 정상이다. <b>같은 업무 · 같은 수신자 · 같은 유형</b>이 이미 있으면 (F-JIEOJO
	 * dataSpec) 같은 사실을 두 번 알리는 것이라 만들지 않는다.
	 *
	 * <p>실제로 중복을 막는 것은 {@code uk_notification_task_recipient_type} 유일 제약이다. 여기 검사는 흔한 경우를
	 * 미리 걸러내는 것뿐이라 경합에서는 새지만, 그때는 제약이 잡는다.
	 */
	private boolean create(
			Staff recipient, Task task, NotificationType type, String actorName, Staff actor) {
		if (actor != null && Objects.equals(actor.getId(), recipient.getId())) {
			return false;
		}
		if (notificationRepository.existsByTaskIdAndRecipientStaffIdAndType(
				task.getId(), recipient.getId(), type)) {
			return false;
		}

		notificationRepository.save(
				Notification.builder()
						.recipientStaff(recipient)
						.task(task)
						.type(type)
						.actorName(actorName)
						.build());
		return true;
	}

	private Staff findStaff(String staffCode) {
		return staffRepository
				.findByCode(staffCode)
				.orElseThrow(() -> new NotFoundException(STAFF_NOT_FOUND, "직원 명단에서 찾을 수 없습니다."));
	}

	/** 사번이 없거나 명단에 없으면 {@code null}. 알림 경로에서는 이것이 오류가 아니다. */
	private Staff findStaffOrNull(String staffCode) {
		return staffCode == null
				? null
				: staffRepository.findByCode(staffCode).orElseGet(() -> logUnknownStaff(staffCode));
	}

	private Staff logUnknownStaff(String staffCode) {
		log.info("알림 경로에서 명단에 없는 사번을 만남 — 무시하고 진행");
		return null;
	}

	private static String actorName(Staff actor) {
		return actor == null ? null : actor.getName();
	}

	private List<NotificationResponse> sorted(List<Notification> notifications) {
		return notifications.stream()
				.sorted(SAFETY_FIRST_THEN_LATEST)
				.map(NotificationResponse::from)
				.toList();
	}

	/**
	 * 알림 생성 이벤트. (Manyfast F-JIEOJO outcome)
	 *
	 * <p>카드 · 업무 쪽과 같은 방침으로 별도 테이블 없이 애플리케이션 로그로 남긴다. <b>수신자 이름도 업무 내용도 남기지 않는다.</b>
	 * 남기는 것은 대상 수와 실제로 만들어진 수다. 둘이 갈리는 것 — 배정자 자신이라서, 또는 이미 있어서 건너뛴 건수 — 이 나중에 물을
	 * 값이다.
	 */
	private void logCreated(NotificationType type, Task task, int targetCount, int createdCount) {
		log.info(
				"알림 생성 — 유형={}, taskId={}, 대상={}명, 생성={}건, 건너뜀={}건",
				type,
				task.getId(),
				targetCount,
				createdCount,
				targetCount - createdCount);
	}

	/** 읽음 처리 이벤트. (Manyfast F-JIEOJO outcome) 배정에서 확인까지 걸린 시간이 여기서 나온다. */
	private void logRead(Notification notification) {
		log.info(
				"알림 읽음 — notificationId={}, 유형={}, taskId={}, 생성={}, 읽음={}",
				notification.getId(),
				notification.getType(),
				notification.getTask().getId(),
				notification.getCreatedAt(),
				notification.getReadAt());
	}

	/**
	 * 알림함 조회 이벤트.
	 *
	 * <p><b>직원 이름을 남기지 않는다.</b> 30초마다 도는 호출이라 (F-JIEOJO rules) 여기에 이름을 실으면 로그 파일이 누가
	 * 언제 앱을 켜 두었는지의 기록이 된다.
	 */
	private void logListViewed(Staff staff, int todayCount, int pastCount, int unreadCount) {
		log.debug(
				"알림함 조회 — staffId={}, 오늘={}건, 지난={}건, 안읽음={}건",
				staff.getId(),
				todayCount,
				pastCount,
				unreadCount);
	}
}
