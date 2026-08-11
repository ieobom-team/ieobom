package com.ieobom.api.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 담당 직종. 후속 업무 배정에만 쓰며, 앱 진입 시 고르는 역할(현장 근무자 / 관리자·센터장)과 별개다.
 *
 * <p>값은 Manyfast PRD 의 역할 목록 5종으로 한정한다. 목록에 없는 직종을 새로 만들지 않는다.
 * 기능회복훈련 인력(물리치료사·작업치료사) 포함 여부는 Manyfast F-IVFNPC 에 미결 질문으로 남아 있고,
 * 포함하기로 정해지면 PRD 역할 목록을 먼저 고친 뒤 여기에 반영한다.
 */
@Getter
@RequiredArgsConstructor
public enum JobRole {
	CAREGIVER("요양보호사"),
	NURSE_AIDE("간호조무사"),
	SOCIAL_WORKER("사회복지사"),
	DRIVER("운전원"),
	CENTER_HEAD("센터장");

	private final String label;
}
