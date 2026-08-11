package com.ieobom.api.ai;

import com.ieobom.api.ai.OpenAiFunctionCaller.FunctionCall;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OpenAI Chat Completions 로 두 문구를 만든다.
 *
 * <p>구조화 클라이언트와 같은 호출부를 쓴다. 다른 것은 스키마와 프롬프트뿐이다.
 *
 * <p>여기서는 <b>판정하지 않는다.</b> 받은 문구를 그대로 초안으로 옮기고, 무엇이 불완전한지는 {@code ExportPhraseVerifier} 가 정한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class OpenAiExportPhraseClient implements ExportPhraseClient {

	private static final String PURPOSE = "문구 생성";

	private final OpenAiFunctionCaller caller;

	@Override
	public ExportPhraseDraft generate(ExportInput input) {
		ExportPhraseDraft draft =
				caller.call(
						new FunctionCall(
								PURPOSE,
								ExportPhraseSchema.FUNCTION_NAME,
								ExportPhraseSchema.tool(),
								ExportPhraseSchema.systemPrompt(),
								ExportPhraseSchema.userPrompt(input)),
						ExportPhraseDraft.class);

		// 문구 자체는 남기지 않는다. 어르신의 상태 이야기가 로그 파일로 새어 나갈 이유가 없다.
		log.debug(
				"문구 생성 응답 — 기록 {}자, 보호자 {}자",
				length(draft.recordPhrase()),
				length(draft.guardianPhrase()));
		return draft;
	}

	private int length(String value) {
		return value == null ? 0 : value.length();
	}
}
