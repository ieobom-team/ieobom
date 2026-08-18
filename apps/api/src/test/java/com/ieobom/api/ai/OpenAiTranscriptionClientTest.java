package com.ieobom.api.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * 전사 호출부가 무엇을 보내고 무엇을 읽는지. (#147)
 *
 * <p>실제 인식 품질은 여기서 볼 수 없다. 실기기 녹음이 제공자에게 받아들여지는지도 배포 뒤에만 확인된다. 여기서 고정하는 것은 <b>키가 없을 때 기동을
 * 막지 않고 호출 시점에 던진다</b>와 <b>거부·오류를 모두 {@link LlmUnavailableException} 하나로 모은다</b>이다.
 */
class OpenAiTranscriptionClientTest {

	private static final byte[] 음성 = "가짜-음성".getBytes(StandardCharsets.UTF_8);

	private static final String 응답 = "{\"text\": \"점심을 거의 안 드셨어요.\"}";

	private final ObjectMapper objectMapper = JsonMapper.builder().build();

	@Test
	void 인식된_글을_그대로_돌려준다() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://llm.test/v1");
		MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
		server
				.expect(requestTo("https://llm.test/v1/audio/transcriptions"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("Authorization", "Bearer test-key"))
				.andRespond(withSuccess(응답, MediaType.APPLICATION_JSON));

		String text = client(builder, "test-key").transcribe("audio/webm;codecs=opus", 음성);

		assertThat(text).isEqualTo("점심을 거의 안 드셨어요.");
		server.verify();
	}

	/** 키가 비어도 애플리케이션은 기동한다. 막는 것은 호출하는 이 시점이다. */
	@Test
	void 키가_없으면_호출하지_않고_던진다() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://llm.test/v1");
		MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

		assertThatThrownBy(() -> client(builder, "").transcribe("audio/webm", 음성))
				.isInstanceOf(LlmUnavailableException.class)
				.hasMessageContaining("LLM_API_KEY");

		// 요청을 하나도 기대하지 않았으므로, 실제로 나갔다면 여기서 걸린다.
		server.verify();
	}

	@Test
	void 제공자가_거부하면_모두_같은_예외로_모은다() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://llm.test/v1");
		MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
		server
				.expect(requestTo("https://llm.test/v1/audio/transcriptions"))
				.andRespond(
						withStatus(HttpStatus.BAD_REQUEST)
								.body("{\"error\": {\"message\": \"Unrecognized file format.\"}}")
								.contentType(MediaType.APPLICATION_JSON));

		assertThatThrownBy(() -> client(builder, "test-key").transcribe("audio/aiff", 음성))
				.isInstanceOf(LlmUnavailableException.class);

		server.verify();
	}

	@Test
	void 제공자가_죽어_있어도_같은_예외로_모은다() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://llm.test/v1");
		MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
		server.expect(requestTo("https://llm.test/v1/audio/transcriptions")).andRespond(withServerError());

		assertThatThrownBy(() -> client(builder, "test-key").transcribe("audio/webm", 음성))
				.isInstanceOf(LlmUnavailableException.class);

		server.verify();
	}

	@Test
	void 스키마에_맞지_않는_응답도_같은_예외로_모은다() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://llm.test/v1");
		MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
		server
				.expect(requestTo("https://llm.test/v1/audio/transcriptions"))
				.andRespond(withSuccess("글자가 아닌 것", MediaType.APPLICATION_JSON));

		assertThatThrownBy(() -> client(builder, "test-key").transcribe("audio/webm", 음성))
				.isInstanceOf(LlmUnavailableException.class);

		server.verify();
	}

	/** 아무 말도 담기지 않은 녹음. 빈 글은 오류가 아니다 — 직원이 글 칸에 직접 쓸 수 있어야 한다. */
	@Test
	void 글이_비어_있어도_오류로_만들지_않는다() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://llm.test/v1");
		MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
		server
				.expect(requestTo("https://llm.test/v1/audio/transcriptions"))
				.andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

		assertThat(client(builder, "test-key").transcribe("audio/webm", 음성)).isEmpty();

		server.verify();
	}

	private OpenAiTranscriptionClient client(RestClient.Builder builder, String apiKey) {
		LlmProperties properties =
				new LlmProperties(
						"https://llm.test/v1",
						"gpt-4.1-mini",
						"gpt-4o-transcribe",
						apiKey,
						Duration.ofSeconds(60));
		return new OpenAiTranscriptionClient(builder.build(), properties, objectMapper);
	}
}
