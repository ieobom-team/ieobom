package com.ieobom.api.handover;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 서버 음성 인식 계약 확인. (#147 · Manyfast F-YJJJUX rules — 기기가 녹음만 하고 서버가 글로 바꿔 돌려준다)
 *
 * <p>여기서 지켜야 하는 것은 두 가지다. <b>글만 돌려주고 아무것도 저장하지 않는다</b> — 저장은 직원이 확인을 마친 뒤 별도 요청으로 일어난다. 그리고
 * <b>저장과 같은 파서·같은 상한을 쓴다</b> — 전사는 통과했는데 저장에서 막히는 음성이 생기면 직원이 되돌릴 방법이 없다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(StubTranscriptionClient.Config.class)
class HandoverTranscribeApiTest {

	private static final byte[] 음성_바이트 = "가짜-웹엠-바이트".getBytes(StandardCharsets.UTF_8);

	@Autowired private MockMvc mockMvc;
	@Autowired private HandoverRepository handovers;
	@Autowired private StubTranscriptionClient 인식;

	@Test
	void 녹음한_음성을_글로_바꿔_돌려준다() throws Exception {
		인식.willReturn("점심을 거의 안 드셨어요.");

		mockMvc
				.perform(요청("data:audio/webm;codecs=opus;base64," + base64(음성_바이트)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.text").value("점심을 거의 안 드셨어요."));
	}

	/** 형식은 브라우저마다 다르다. 우리가 고르지 않고 받은 것을 그대로 넘겨야 제공자가 판단할 수 있다. */
	@Test
	void 녹음_형식과_바이트를_그대로_인식에_넘긴다() throws Exception {
		인식.willReturn("네");

		mockMvc
				.perform(요청("data:audio/mp4;base64," + base64(음성_바이트)))
				.andExpect(status().isOk());

		assertThat(인식.lastMimeType()).isEqualTo("audio/mp4");
		assertThat(인식.lastData()).isEqualTo(음성_바이트);
	}

	@Test
	void 변환만_하고_인계를_저장하지_않는다() throws Exception {
		인식.willReturn("아무 말");
		long before = handovers.count();

		mockMvc
				.perform(요청("data:audio/webm;base64," + base64(음성_바이트)))
				.andExpect(status().isOk());

		assertThat(handovers.count()).isEqualTo(before);
	}

	/** 아무 말도 담기지 않은 녹음. 빈 글이라도 오류로 만들지 않는다 — 직원이 글 칸에 직접 쓸 수 있어야 한다. */
	@Test
	void 아무_말도_담기지_않았으면_빈_글을_돌려준다() throws Exception {
		인식.willReturn("");

		mockMvc
				.perform(요청("data:audio/webm;base64," + base64(음성_바이트)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.text").value(""));
	}

	@Test
	void 형식을_읽을_수_없는_음성은_400_이다() throws Exception {
		mockMvc
				.perform(요청("이건 Data URL 이 아니다"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("audioData"));
	}

	/** 저장과 같은 상한이다. 여기서 통과시키면 변환은 됐는데 저장에서 막히는 음성이 생긴다. */
	@Test
	void 상한을_넘는_음성은_400_이다() throws Exception {
		byte[] 너무_큰_음성 = new byte[HandoverService.AUDIO_MAX_BYTES + 1];

		mockMvc
				.perform(요청("data:audio/webm;base64," + base64(너무_큰_음성)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("audioData"));
	}

	@Test
	void 음성을_붙이지_않으면_400_이다() throws Exception {
		mockMvc
				.perform(요청(""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("audioData"));
	}

	/**
	 * 키가 없거나 제공자가 거부한 경우. 화면은 이 응답을 받고도 녹음한 원본 음성을 들고 있고, 글 칸에 직접 입력해 저장을 마칠 수 있다. (Manyfast
	 * F-YJJJUX rules)
	 */
	@Test
	void 인식이_실패하면_503_이다() throws Exception {
		인식.willFail();

		mockMvc
				.perform(요청("data:audio/webm;base64," + base64(음성_바이트)))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("LLM_UNAVAILABLE"));
	}

	private MockHttpServletRequestBuilder 요청(String dataUrl) {
		return post("/api/handovers/transcribe")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "audioData": "%s"
						}
						""".formatted(dataUrl));
	}

	private String base64(byte[] bytes) {
		return Base64.getEncoder().encodeToString(bytes);
	}
}
