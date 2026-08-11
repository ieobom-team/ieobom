package com.ieobom.api.ai;

/**
 * 검토 완료 카드를 두 가지 문구로 바꾸는 경계.
 *
 * <p>{@link HandoverStructuringClient} 와 같은 이유로 인터페이스로 둔다. 테스트는 stub 을 끼워 검증 규칙만 확인하고, 실호출 확인은
 * {@code llmLiveTest} 태스크에서만 한다.
 *
 * <p><b>검증 책임은 여기 없다.</b> 구현체는 받은 것을 그대로 옮겨 담기만 하고, 무엇이 불완전한지는 {@code ExportPhraseVerifier} 가
 * 정한다.
 */
public interface ExportPhraseClient {

	/**
	 * @throws LlmUnavailableException 키가 없거나 호출이 실패했거나 응답이 스키마에 맞지 않을 때
	 */
	ExportPhraseDraft generate(ExportInput input);
}
