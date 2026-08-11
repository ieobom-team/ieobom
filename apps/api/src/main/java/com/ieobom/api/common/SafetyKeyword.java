package com.ieobom.api.common;

import java.util.Arrays;
import java.util.Optional;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 안전 항목으로 우선 표시할 지정 키워드.
 *
 * <p>Manyfast F-SNBVHR rules 의 4개(낙상 · 발열 · 식사 저하 · 투약 변경)로 시작한다. 확장은 별도 Issue 로 다룬다.
 *
 * <p>판정은 두 갈래를 합집합으로 쓴다. 하나는 여기 있는 표기를 원문에서 그대로 찾는 것이고, 다른 하나는 AI 가 같은 4개 범주 중 하나로 분류하는 것이다.
 * 문자열만 보면 "미끄러지실 뻔했어요" 같은 현장 표현을 놓치고, 분류만 믿으면 확실한 표기까지 모델 판단에 맡기게 된다. 둘 중 하나에만 걸려도 우선 표시하는 편이
 * 놓치는 쪽보다 낫다.
 */
@Getter
@RequiredArgsConstructor
public enum SafetyKeyword {
	FALL("낙상"),
	FEVER("발열"),
	POOR_INTAKE("식사 저하"),
	MEDICATION_CHANGE("투약 변경");

	private final String label;

	/**
	 * 주어진 글에서 지정 키워드를 찾는다.
	 *
	 * <p>띄어쓰기를 지우고 비교한다. "식사 저하"와 "식사저하"가 다른 것으로 갈리면 안 된다.
	 */
	public static Optional<SafetyKeyword> findIn(String text) {
		if (text == null || text.isBlank()) {
			return Optional.empty();
		}
		String compact = removeWhitespace(text);
		return Arrays.stream(values())
				.filter(keyword -> compact.contains(removeWhitespace(keyword.label)))
				.findFirst();
	}

	private static String removeWhitespace(String text) {
		return text.replaceAll("\\s", "");
	}
}
