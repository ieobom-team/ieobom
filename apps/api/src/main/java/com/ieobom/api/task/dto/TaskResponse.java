package com.ieobom.api.task.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.task.ClaimMethod;
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
 * @param claimedAt 담당이 정해진 시각. 담당자가 없으면 {@code null}
 * @param claimMethod 담당 확정 방식. 담당자가 있을 때만 값이 있다 (Manyfast F-IVFNPC dataSpec)
 * @param claimable 지금 맡을 수 있는지. 화면이 '내가 처리할게요'를 그릴지 정하는 값이고, <b>담당 확정을 허가하는 값이 아니다</b>
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
		LocalDateTime claimedAt,
		ClaimMethod claimMethod,
		String claimMethodLabel,
		boolean claimable,
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
		ClaimMethod claimMethod = task.getClaimMethod();

		return new TaskResponse(
				task.getId(),
				card.getId(),
				recipient == null ? null : recipient.getId(),
				recipient == null ? null : recipient.getName(),
				task.getContent(),
				jobRole,
				jobRole == null ? null : jobRole.getLabel(),
				task.getAssigneeName(),
				task.getClaimedAt(),
				claimMethod,
				claimMethod == null ? null : claimMethod.getLabel(),
				task.isClaimable(),
				task.getDueTime(),
				task.getStatus(),
				task.getStatus().getLabel(),
				task.isDelegated(),
				task.getCompletedAt(),
				task.getCompletedByName(),
				task.getCreatedAt());
	}
}
