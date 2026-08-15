package com.ieobom.api.task;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 담당이 어떻게 정해졌는지. (Manyfast F-IVFNPC dataSpec)
 *
 * <p><b>상태가 아니다.</b> 후속 업무 상태는 {@link TaskStatus} 의 미처리 · 완료 두 값 그대로이고, 이 값은 담당자 정보의 일부다. "미처리인데
 * 이준호님이 맡음"이 정상적인 표현이다. (Manyfast F-IVFNPC rules)
 *
 * <p>담당자가 있을 때만 값을 가진다. 직종만 배정된 업무는 사람이 정해진 적이 없으므로 방식도 없다.
 */
@Getter
@RequiredArgsConstructor
public enum ClaimMethod {

	/** 배정할 때 화면에서 사람을 골라 정했다. */
	DIRECT_ASSIGN("직접 배정"),

	/** 직종에만 배정된 업무를 그 직종 직원이 스스로 맡았다. */
	SELF_CLAIM("직종에서 맡기");

	private final String label;
}
