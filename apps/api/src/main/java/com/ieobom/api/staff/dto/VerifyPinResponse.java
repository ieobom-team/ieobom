package com.ieobom.api.staff.dto;

/**
 * PIN 검증 결과 응답.
 *
 * @param valid PIN 일치 여부
 * @param locked 5회 연속 실패로 인한 잠금 여부 (Manyfast F-YJJJUX exceptions)
 * @param remainingAttempts 남은 시도 가능 횟수 (0~5)
 */
public record VerifyPinResponse(boolean valid, boolean locked, int remainingAttempts) {

	public static VerifyPinResponse ofSuccess() {
		return new VerifyPinResponse(true, false, 5);
	}

	public static VerifyPinResponse ofFailure(int remainingAttempts) {
		return new VerifyPinResponse(false, false, remainingAttempts);
	}

	public static VerifyPinResponse ofLocked() {
		return new VerifyPinResponse(false, true, 0);
	}
}
