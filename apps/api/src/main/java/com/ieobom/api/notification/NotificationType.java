package com.ieobom.api.notification;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 알림 유형. <b>세 가지뿐이다.</b> (Manyfast F-JIEOJO dataSpec)
 *
 * <p>값을 늘리지 않는 것이 이 열거형의 요점이다. 기한 임박 재알림 · 미완료 반복 독촉 · 다음 교대 승계는 MVP 범위 밖이고, 그것들이
 * 들어오는 자리가 바로 여기다. 유형이 늘면 알림함은 "무엇을 해야 하는지"를 알리는 화면에서 "무슨 일이 있었는지"를 나열하는 화면이 된다.
 *
 * <p>{@link #ASSIGNEE_CHANGED} 는 <b>지금 생성되지 않는다.</b> 트리거인 관리자의 담당자 변경에 API 가 아직 없다.
 * ({@code docs/contracts/task-api.md} — "관리자의 담당자 변경: 아직 없다") 값을 미리 두는 이유는 Manyfast 가 유형을 셋으로
 * 고정했기 때문이고, 담당자 변경 API 가 생기면 발행 지점만 붙이면 된다.
 */
@Getter
@RequiredArgsConstructor
public enum NotificationType {
	/** 새 업무가 나에게, 또는 내 직종에 배정됐다. */
	TASK_ASSIGNED("새 업무 배정"),

	/** 내가 맡고 있던 업무의 담당자가 다른 사람으로 바뀌었다. */
	ASSIGNEE_CHANGED("담당 변경"),

	/** 내가 담당인 업무를 다른 사람이 대신 완료로 닫았다. */
	DELEGATED_COMPLETION("대리 완료");

	private final String label;
}
