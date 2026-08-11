package com.ieobom.api.task.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.task.Task;
import com.ieobom.api.task.TaskStatus;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 후속 업무 하나.
 *
 * <p>담당자 또는 담당 직종 · 기한 · 상태를 함께 담는다. 화면은 이 셋을 언제나 같이 보여 준다. (Manyfast F-IVFNPC display)
 *
 * @param dueTime 기한. {@code HH:MM} 으로 고정한다. 이 제품의 기한은 당일 시각 단위이고 (Manyfast F-IVFNPC rules),
 *     초까지 붙여 내보내면 직원이 고쳐 보낸 값과 돌려받는 값의 모양이 달라진다
 * @param delegated 대리 완료 여부. 완료 확인자가 담당자와 다르면 참이다. 직종만 배정된 업무는 판정할 수 없어 거짓이다
 */
public record TaskResponse(
		Long id,
		Long handoverCardId,
		Long careRecipientId,
		String careRecipientName,
		String content,
		JobRole assigneeJobRole,
		String assigneeJobRoleLabel,
		String assigneeName,
		@JsonFormat(pattern = "HH:mm") LocalTime dueTime,
		TaskStatus status,
		String statusLabel,
		boolean delegated,
		LocalDateTime completedAt,
		String completedByName,
		LocalDateTime createdAt) {

	public static TaskResponse from(Task task) {
		HandoverCard card = task.getHandoverCard();
		CareRecipient recipient = card.getCareRecipient();
		JobRole jobRole = task.getAssigneeJobRole();

		return new TaskResponse(
				task.getId(),
				card.getId(),
				recipient == null ? null : recipient.getId(),
				recipient == null ? null : recipient.getName(),
				task.getContent(),
				jobRole,
				jobRole == null ? null : jobRole.getLabel(),
				task.getAssigneeName(),
				task.getDueTime(),
				task.getStatus(),
				task.getStatus().getLabel(),
				task.isDelegated(),
				task.getCompletedAt(),
				task.getCompletedByName(),
				task.getCreatedAt());
	}
}
