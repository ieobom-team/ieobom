package com.ieobom.api.ai;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.ObjectMapper;

/**
 * OpenAI {@code /audio/transcriptions} 호출부.
 *
 * <p>{@link OpenAiFunctionCaller} 와 같은 {@code RestClient} · 같은 키를 쓰지만 <b>본문 형식이 다르다.</b> 전사는
 * JSON 이 아니라 multipart 로 파일을 올린다. 그래서 함수 호출부에 끼워 넣지 않고 따로 뒀다.
 *
 * <p>키가 없어도 애플리케이션은 기동하고, 호출하는 이 시점에 {@link LlmUnavailableException} 을 던진다. 나머지 AI 클라이언트와 같은
 * 방식이다 — 키 없이 뜨지 못하면 CI 와 다른 개발자 로컬에서 테스트가 전부 막힌다.
 */
@Slf4j
@Component
class OpenAiTranscriptionClient implements TranscriptionClient {

	private static final String TRANSCRIPTIONS_PATH = "/audio/transcriptions";

	private static final String PURPOSE = "음성을 글로 바꾸기";

	/**
	 * 제공자가 <b>파일 확장자로</b> 형식을 가려 받는다. 그래서 mime type 을 확장자로 되돌려 이름을 붙여 보낸다. 이름 자체는 저장되지 않는다.
	 *
	 * <p>여기 없는 형식은 {@code webm} 으로 보낸다. 지금 화면이 쓰는 {@code MediaRecorder} 는 브라우저마다 다른 형식을 내고
	 * ({@code audio/webm} · {@code audio/mp4}) 앞으로 또 늘어날 수 있는데, 목록에 없다고 우리가 먼저 막으면 제공자가 받아 줄 음성까지
	 * 버리게 된다. 정말 못 받는 형식이면 제공자가 4xx 로 돌려주고 그때 아래 로그에 형식이 남는다.
	 */
	private static final Map<String, String> EXTENSIONS =
			Map.of(
					"audio/webm", "webm",
					"audio/mp4", "mp4",
					"audio/mpeg", "mp3",
					"audio/mpga", "mpga",
					"audio/m4a", "m4a",
					"audio/x-m4a", "m4a",
					"audio/ogg", "ogg",
					"audio/wav", "wav",
					"audio/x-wav", "wav",
					"audio/flac", "flac");

	private static final String DEFAULT_EXTENSION = "webm";

	private final RestClient restClient;
	private final LlmProperties properties;
	private final ObjectMapper objectMapper;

	OpenAiTranscriptionClient(
			RestClient llmRestClient, LlmProperties properties, ObjectMapper objectMapper) {
		this.restClient = llmRestClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	@Override
	public String transcribe(String mimeType, byte[] data) {
		if (!properties.hasApiKey()) {
			throw new LlmUnavailableException(
					"LLM_API_KEY 가 설정되지 않아 %s 을(를) 수행할 수 없습니다.".formatted(PURPOSE), null);
		}

		String raw = post(mimeType, data);
		TranscriptionResponse response = read(raw);
		return response.text() == null ? "" : response.text();
	}

	private String post(String mimeType, byte[] data) {
		MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
		body.add("file", new NamedResource(data, fileName(mimeType)));
		body.add("model", properties.transcriptionModel());
		body.add("response_format", "json");
		// 현장 발화는 한국어다. 언어를 비워 두면 짧은 발화에서 다른 언어로 잡아 엉뚱한 글이 나온다.
		body.add("language", "ko");

		try {
			return restClient
					.post()
					.uri(TRANSCRIPTIONS_PATH)
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.bearerToken())
					.contentType(MediaType.MULTIPART_FORM_DATA)
					.body(body)
					.retrieve()
					.body(String.class);
		} catch (RestClientResponseException e) {
			// 거부 이유는 응답 본문에 있다. 녹음 형식을 함께 남긴다 — 기기마다 다른 형식이 나오고,
			// 그중 어떤 것이 거부됐는지는 실기기에서만 드러난다. (#147)
			// 본문에는 우리가 올린 음성이 들어가지 않는다. 키는 제공자가 가려서 돌려준다.
			log.error(
					"{} 요청이 거부되었습니다 — status={}, model={}, mimeType={}, bytes={}, body={}",
					PURPOSE,
					e.getStatusCode(),
					properties.transcriptionModel(),
					mimeType,
					data.length,
					e.getResponseBodyAsString());
			throw new LlmUnavailableException(
					"%s 요청이 거부되었습니다. 설정을 확인해 주세요.".formatted(PURPOSE), e);
		} catch (Exception e) {
			throw new LlmUnavailableException(
					"%s 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.".formatted(PURPOSE), e);
		}
	}

	/** 실패해도 본문을 예외 메시지에 싣지 않는다. 응답에는 어르신 실명이 들어 있다. */
	private TranscriptionResponse read(String json) {
		if (json == null || json.isBlank()) {
			throw new LlmUnavailableException("%s 응답이 비어 있습니다.".formatted(PURPOSE), null);
		}
		try {
			return objectMapper.readValue(json, TranscriptionResponse.class);
		} catch (Exception e) {
			log.error("{} 응답을 읽지 못했습니다.", PURPOSE, e);
			throw new LlmUnavailableException("%s 응답을 읽지 못했습니다.".formatted(PURPOSE), e);
		}
	}

	/** {@code audio/webm;codecs=opus} 처럼 뒤에 붙는 매개변수를 떼고 확장자를 고른다. */
	private static String fileName(String mimeType) {
		String base = mimeType == null ? "" : mimeType.split(";", 2)[0].trim().toLowerCase();
		return "handover." + EXTENSIONS.getOrDefault(base, DEFAULT_EXTENSION);
	}

	/**
	 * 이름을 가진 바이트 묶음. multipart 의 {@code filename} 은 {@code Resource#getFilename()} 에서 나오는데,
	 * 맨 {@link ByteArrayResource} 는 그것이 {@code null} 이라 제공자가 형식을 판단하지 못한다.
	 */
	private static final class NamedResource extends ByteArrayResource {

		private final String fileName;

		private NamedResource(byte[] data, String fileName) {
			super(data);
			this.fileName = fileName;
		}

		@Override
		public String getFilename() {
			return fileName;
		}
	}

	/** OpenAI 응답 본문. 우리가 쓰는 것은 {@code text} 하나뿐이다. */
	record TranscriptionResponse(String text) {}
}
