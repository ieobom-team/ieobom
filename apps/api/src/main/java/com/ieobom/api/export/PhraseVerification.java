package com.ieobom.api.export;

/**
 * 문구 판정 결과.
 *
 * @param text 저장하고 화면에 내보낼 문구. 담을 내용이 없으면 {@code null}
 * @param reviewNotice 복사 전에 확인할 것. 없으면 {@code null}
 */
public record PhraseVerification(String text, String reviewNotice) {

	public boolean needsReview() {
		return reviewNotice != null;
	}
}
