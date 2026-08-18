package com.ieobom.api.ai;

/**
 * 녹음된 음성을 글로 바꾸는 경계.
 *
 * <p>구현을 갈아끼울 수 있게 인터페이스로 둔다. 테스트는 실제 호출 없이 stub 을 끼우고, 실호출 확인은 {@code llmLiveTest} 태스크에서만 한다.
 *
 * <p><b>여기서 다듬거나 버리는 판단을 하지 않는다.</b> 받은 글을 그대로 올려 보낸다 — 원문을 고치지 않는 것이 이 서비스의 원칙이고, 인식이 틀렸을
 * 때 고치는 것은 화면에서 직원이 한다. (Manyfast F-YJJJUX rules)
 *
 * <p><b>어르신 명단을 힌트로 넘기지 않는다.</b> 이름 오인식을 줄일 수 있는 카드지만 {@code F-LUDCWW} rules 의 "어르신 실명은 LLM
 * 요청에 포함하지 않는다" 와 문구상 부딪힌다. 넣으려면 명세를 먼저 고쳐야 한다. (#147)
 */
public interface TranscriptionClient {

	/**
	 * @param mimeType 녹음한 브라우저가 알려 준 형식. 제공자가 형식을 가려 받으므로 그대로 실어 보낸다
	 * @param data 음성 바이트
	 * @return 인식된 글. 아무 말도 담기지 않았으면 빈 문자열일 수 있다
	 * @throws LlmUnavailableException 키가 없거나, 호출이 실패했거나, 응답을 읽지 못했을 때
	 */
	String transcribe(String mimeType, byte[] data);
}
