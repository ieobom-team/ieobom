package com.ieobom.api.task.dto;

import com.ieobom.api.common.JobRole;
import jakarta.validation.constraints.Size;

/**
 * 후속 업무 담당자 변경 요청. (Manyfast F-IVFNPC permissions, F-JIEOJO trigger)
 *
 * <p>관리자가 이미 있는 업무의 담당 직종 또는 담당자를 바꾼다.
 *
 * @param assigneeJobRole 변경할 담당 직종. PRD 5개 역할로 한정한다 ({@link JobRole})
 * @param assigneeName 변경할 담당자 이름. 직종만 정하고 사람을 특정하지 않을 수 있다
 * @param assigneeStaffCode 새 담당자의 사번. 알림 수신자를 <b>동명이인 없이</b> 가리키기 위해 받는다. 이름 없이 사번만 보내면 무시된다
 * @param assignedByStaffCode 변경하는 관리자의 사번. 알림에 "배정한 사람"으로 표시되고, 수신자와 같으면 알림을 만들지 않는 근거가 된다 (Manyfast F-JIEOJO exceptions)
 */
public record TaskReassignRequest(
		JobRole assigneeJobRole,
		@Size(max = 50, message = "담당자 이름은 50자까지 넣을 수 있습니다.") String assigneeName,
		@Size(max = 30, message = "담당자 사번은 30자까지 넣을 수 있습니다.") String assigneeStaffCode,
		@Size(max = 30, message = "변경자 사번은 30자까지 넣을 수 있습니다.") String assignedByStaffCode) {

	public String normalizedAssigneeName() {
		return trimToNull(assigneeName);
	}

	public String normalizedAssigneeStaffCode() {
		return trimToNull(assigneeStaffCode);
	}

	public String normalizedAssignedByStaffCode() {
		return trimToNull(assignedByStaffCode);
	}

	/** 담당자를 정했는지. 직종과 이름 중 하나만 있어도 된다. (Manyfast F-IVFNPC exceptions) */
	public boolean hasAssignee() {
		return assigneeJobRole != null || normalizedAssigneeName() != null;
	}

	/** 공백만 남은 칸은 지운 것으로 본다. 화면에서 지우다 만 공백이 담당자로 저장되면 안 된다. */
	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
