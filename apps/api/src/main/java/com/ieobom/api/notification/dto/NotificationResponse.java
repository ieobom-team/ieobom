package com.ieobom.api.notification.dto;

import com.ieobom.api.notification.Notification;
import com.ieobom.api.notification.NotificationType;
import com.ieobom.api.task.dto.TaskResponse;
import java.time.LocalDateTime;

/**
 * 알림 한 줄.
 *
 * <p><b>업무를 통째로 중첩한다.</b> 어르신 이름 · 업무 내용 · 기한 · 담당자 · {@code claimable} 을 알림이 따로 복사해
 * 내려주지 않는 이유는, 화면이 알림함에서 그리는 것과 업무 상세에서 그리는 것이 같은 값이기 때문이다. 두 벌로 내려주면 "알림함에서는
 * 아직 열려 있는데 들어가 보니 남이 맡은" 상태가 응답 안에서 생긴다.
 *
 * <p>이 중첩이 Manyfast 의 <b>"직종 배정 알림은 다른 직원이 그 업무를 맡으면 누가 맡았는지 보여 주는 내용으로 갱신된다"</b>
 * (F-JIEOJO action) 를 지키는 방식이다. 갱신할 문구를 저장해 두지 않으므로 갱신에 실패할 수도 없다. 화면은 {@code
 * task.claimable} 로 '내가 처리할게요'를, {@code task.assigneeName} · {@code task.claimedAt} 으로 이미 맡은
 * 사람을 그린다. (F-JIEOJO display)
 *
 * @param actorName 이 알림을 일으킨 사람. 배정 알림이면 <b>배정한 사람</b>, 대리 완료 알림이면 완료를 확인한 사람이다.
 *     배정자를 보내지 않은 요청이었으면 {@code null}
 * @param safetyRelated 안전 관련 카드에서 나온 업무인지. 참이면 목록 위쪽에 온다 (Manyfast F-JIEOJO display)
 * @param readAt 읽은 시각. 읽기 전까지 {@code null} 이고, 다시 읽어도 처음 값이 덮이지 않는다
 */
public record NotificationResponse(
		Long id,
		NotificationType type,
		String typeLabel,
		boolean read,
		String actorName,
		boolean safetyRelated,
		LocalDateTime createdAt,
		LocalDateTime readAt,
		TaskResponse task) {

	public static NotificationResponse from(Notification notification) {
		NotificationType type = notification.getType();

		return new NotificationResponse(
				notification.getId(),
				type,
				type.getLabel(),
				notification.isRead(),
				notification.getActorName(),
				notification.getTask().getHandoverCard().isSafetyRelated(),
				notification.getCreatedAt(),
				notification.getReadAt(),
				TaskResponse.from(notification.getTask()));
	}
}
