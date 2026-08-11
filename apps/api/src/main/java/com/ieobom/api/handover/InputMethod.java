package com.ieobom.api.handover;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 현장에서 특이사항을 남긴 방식. 상시 녹음은 제공하지 않고, 음성은 사용자가 시작한 세션 단위만 허용한다. */
@Getter
@RequiredArgsConstructor
public enum InputMethod {
	VOICE("음성"),
	TEXT("텍스트"),
	CHECK("체크");

	private final String label;
}
