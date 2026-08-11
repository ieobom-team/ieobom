package com.ieobom.api.task;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 후속 업무 상태. 두 값만 쓴다.
 *
 * <p>진행 중·접수·확인 같은 중간 상태를 추가하지 않는다.
 */
@Getter
@RequiredArgsConstructor
public enum TaskStatus {
	PENDING("미처리"),
	DONE("완료");

	private final String label;
}
