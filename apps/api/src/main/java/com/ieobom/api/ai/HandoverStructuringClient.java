package com.ieobom.api.ai;

import java.util.List;

/**
 * 인계 원문을 카드 초안으로 바꾸는 경계.
 *
 * <p>구현을 갈아끼울 수 있게 인터페이스로 둔다. 테스트는 실제 호출 없이 stub 을 끼워 검증 규칙만 확인하고, 실호출 확인은 {@code llmLiveTest}
 * 태스크에서만 한다.
 *
 * <p><b>검증 책임은 여기 없다.</b> 구현체는 받은 것을 그대로 옮겨 담기만 하고, 무엇을 버릴지는 {@code CardDraftVerifier} 가 정한다.
 */
public interface HandoverStructuringClient {

	/**
	 * @throws LlmUnavailableException 키가 없거나 호출이 실패했거나 응답이 스키마에 맞지 않을 때
	 */
	List<StructuredCardDraft> structure(StructuringInput input);
}
