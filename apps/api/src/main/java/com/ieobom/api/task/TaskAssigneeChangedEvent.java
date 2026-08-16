package com.ieobom.api.task;

/**
 * 후속 업무의 담당자가 변경됐다. 알림은 이 사건을 듣고 만들어진다. (Manyfast F-JIEOJO trigger)
 *
 * <p>관리자가 담당자를 바꾸면 새 담당자에게 업무 배정 알림을, 이전 담당자에게 담당 변경 알림을 만든다. (Manyfast F-JIEOJO action)
 *
 * @param taskId 대상 업무 ID
 * @param oldAssigneeStaffCode 이전 담당자 사번. 이전 담당자가 없었으면 {@code null}
 * @param newAssigneeStaffCode 새 담당자 사번. 새 담당자가 지정되지 않았거나 사번이 없으면 {@code null}
 * @param assignedByStaffCode 담당자를 변경한 직원의 사번. 화면이 보내지 않았으면 {@code null}
 */
public record TaskAssigneeChangedEvent(
		Long taskId,
		String oldAssigneeStaffCode,
		String newAssigneeStaffCode,
		String assignedByStaffCode) {}
