package com.ieobom.api.handover;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 대리 입력일 때 그 내용을 실제로 전한 사람.
 *
 * <p>입력자와 분리해 저장한다. 등원 시 보호자가 운전원에게 전한 내용을 데스크 근무자가 대신 남기는 것이 기본 경로이고,
 * 이 경로가 성립하려면 입력 지점과 정보 출처가 갈라져 있어야 한다.
 */
@Getter
@RequiredArgsConstructor
public enum InfoSource {
	GUARDIAN("보호자"),
	DRIVER("운전원"),
	COLLEAGUE("동료 근무자"),
	OTHER("그 외");

	private final String label;
}
