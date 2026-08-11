package com.ieobom.api.ai;

import com.ieobom.api.ai.OpenAiFunctionCaller.FunctionCall;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OpenAI Chat Completions 로 구조화한다.
 *
 * <p>부르는 방법은 {@link OpenAiFunctionCaller} 가, 무엇을 받을지는 {@link HandoverStructuringSchema} 가 정한다.
 * 함수 호출이 강제되므로 모델이 자유 텍스트로 답할 수 없고, 응답은 함수 인자 JSON 하나뿐이다.
 *
 * <p>여기서는 <b>버리는 판단을 하지 않는다.</b> 받은 항목을 그대로 초안으로 옮기고, 무엇을 폐기할지는 {@code CardDraftVerifier} 가 정한다.
 * 판정이 두 곳에 흩어지면 "근거 없는 항목은 나가지 않는다"를 한 곳에서 증명할 수 없게 된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class OpenAiHandoverStructuringClient implements HandoverStructuringClient {

	private static final String PURPOSE = "구조화";

	private final OpenAiFunctionCaller caller;

	@Override
	public List<StructuredCardDraft> structure(StructuringInput input) {
		CardsEnvelope envelope =
				caller.call(
						new FunctionCall(
								PURPOSE,
								HandoverStructuringSchema.FUNCTION_NAME,
								HandoverStructuringSchema.tool(),
								HandoverStructuringSchema.systemPrompt(),
								HandoverStructuringSchema.userPrompt(input)),
						CardsEnvelope.class);

		List<StructuredCardDraft> cards = envelope.cards() == null ? List.of() : envelope.cards();
		log.debug("구조화 응답 — 항목 {}개", cards.size());
		return cards;
	}

	/** 함수 인자의 최상위 모양. {@link HandoverStructuringSchema#CARDS_PROPERTY} 와 이름이 같아야 한다. */
	record CardsEnvelope(List<StructuredCardDraft> cards) {}
}
