package com.ieobom.api.notification;

import com.ieobom.api.task.TaskAssignedEvent;
import com.ieobom.api.task.TaskAssigneeChangedEvent;
import com.ieobom.api.task.TaskCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 업무 쪽 사건을 듣고 알림을 만든다. (Manyfast F-JIEOJO trigger)
 *
 * <p><b>이 클래스의 존재 이유는 "알림 생성이 실패해도 후속 업무 생성 자체는 성공한다"이다.</b> 그 규칙을 지키는 방법이 세 개
 * 겹쳐 있다.
 *
 * <ol>
 *   <li>{@link TransactionPhase#AFTER_COMMIT} — 업무는 이 코드가 돌기 <b>전에</b> 이미 커밋됐다. 여기서 무슨 일이
 *       나든 되돌릴 업무가 없다
 *   <li>{@link Propagation#REQUIRES_NEW} — 알림은 자기 트랜잭션에서 만들어진다. 업무 트랜잭션은 끝났으므로 여기에
 *       롤백 표시가 남아도 갈 곳이 없다
 *   <li>{@code try/catch} — {@code afterCommit} 에서 던진 예외는 커밋을 되돌리지 못하지만 <b>호출자에게 전파되어</b>
 *       업무 생성 응답을 500 으로 만든다. 업무는 저장됐는데 화면은 실패로 보는 상태가 가장 나쁘다
 * </ol>
 *
 * <p>같은 트랜잭션 안에서 {@code try/catch} 만으로 처리하지 않는 이유가 여기 있다. JPA 예외 하나면 트랜잭션에 롤백 표시가
 * 남아, 잡아 삼켜도 커밋 시점에 업무까지 함께 죽는다.
 *
 * <p><b>비동기가 아니다.</b> 응답이 나가기 전에 동기로 돈다. 파일럿 규모에서 알림 몇 행을 넣는 비용이 배정 응답을 늦출 만하지
 * 않고, 비동기로 두면 배정 직후 알림함을 열었을 때 아직 없는 경우가 생긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

	private final NotificationService notificationService;

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onTaskAssigned(TaskAssignedEvent event) {
		try {
			notificationService.notifyAssigned(event.taskId(), event.assignedByStaffCode());
		} catch (RuntimeException e) {
			log.error("배정 알림 생성 실패 — taskId={}, 업무는 그대로 저장됨", event.taskId(), e);
		}
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onTaskCompleted(TaskCompletedEvent event) {
		try {
			notificationService.notifyDelegatedCompletion(event.taskId());
		} catch (RuntimeException e) {
			log.error("대리 완료 알림 생성 실패 — taskId={}, 완료 처리는 그대로 저장됨", event.taskId(), e);
		}
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onTaskAssigneeChanged(TaskAssigneeChangedEvent event) {
		try {
			notificationService.notifyAssigneeChanged(
					event.taskId(),
					event.oldAssigneeStaffCode(),
					event.newAssigneeStaffCode(),
					event.assignedByStaffCode());
		} catch (RuntimeException e) {
			log.error("담당 변경 알림 생성 실패 — taskId={}, 담당자 변경은 그대로 저장됨", event.taskId(), e);
		}
	}
}
