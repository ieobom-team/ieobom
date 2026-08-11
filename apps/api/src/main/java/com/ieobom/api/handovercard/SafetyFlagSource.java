package com.ieobom.api.handovercard;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 안전 관련 항목으로 잡힌 경로.
 *
 * <p>지정 키워드(낙상·발열·식사 저하·투약 변경)와 직원 직접 표시 중 하나에만 해당해도 우선 표시한다.
 * 키워드만 쓰면 표현이 다른 위험을 놓치고 직원 표시만 쓰면 바쁠 때 아무도 누르지 않으므로, 둘 중 하나로 잡히게 둔다.
 */
@Getter
@RequiredArgsConstructor
public enum SafetyFlagSource {
	KEYWORD("키워드 자동 판정"),
	STAFF("직원 직접 표시");

	private final String label;
}
