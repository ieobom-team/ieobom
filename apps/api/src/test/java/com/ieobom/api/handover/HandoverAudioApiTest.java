package com.ieobom.api.handover;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Comparator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 원본 음성 저장과 재생 계약 확인. (#44 · Manyfast F-SNBVHR)
 *
 * <p>AI 요약이 담지 못한 뉘앙스를 원본 음성으로 받는 기능이라, "음성 없이도 텍스트는 남는다"와 "들을 음성이 없으면 재생 경로가 열리지 않는다" 두 가지가
 * 함께 지켜져야 한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class HandoverAudioApiTest {

	private static final byte[] 음성_바이트 = "가짜-웹엠-바이트".getBytes(StandardCharsets.UTF_8);

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverAudioRepository audios;

	@Test
	void 음성_입력은_인식된_텍스트와_원본_음성을_함께_저장하고_그대로_돌려준다() throws Exception {
		Long id = 음성으로_저장한다("data:audio/webm;codecs=opus;base64," + base64(음성_바이트));

		Handover saved = handovers.findById(id).orElseThrow();
		assertThat(saved.hasAudio()).isTrue();
		assertThat(saved.getAudioMimeType()).isEqualTo("audio/webm;codecs=opus");
		assertThat(saved.getRawText()).isNotBlank();
		assertThat(audios.findByHandoverId(id).orElseThrow().getData()).isEqualTo(음성_바이트);

		mockMvc
				.perform(get("/api/handovers/{id}/audio", id))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith("audio/webm"))
				.andExpect(content().bytes(음성_바이트));
	}

	@Test
	void 음성을_붙이지_않은_입력은_재생할_것이_없다() throws Exception {
		Long id = 저장한다("TEXT", null);

		assertThat(handovers.findById(id).orElseThrow().hasAudio()).isFalse();

		mockMvc
				.perform(get("/api/handovers/{id}/audio", id))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("HANDOVER_AUDIO_NOT_FOUND"));
	}

	/** 마이크 권한을 거부했거나 녹음을 지원하지 않는 브라우저의 음성 입력. 방식은 VOICE 지만 들을 음성은 없다. */
	@Test
	void 녹음하지_못한_음성_입력은_저장되지만_재생_경로가_열리지_않는다() throws Exception {
		Long id = 저장한다("VOICE", null);

		assertThat(handovers.findById(id).orElseThrow().hasAudio()).isFalse();

		mockMvc.perform(get("/api/handovers/{id}/audio", id)).andExpect(status().isNotFound());
	}

	@Test
	void 없는_인계의_음성을_찾으면_404_다() throws Exception {
		mockMvc.perform(get("/api/handovers/{id}/audio", 999999)).andExpect(status().isNotFound());
	}

	@Test
	void 음성_입력이_아닌데_음성이_붙으면_저장하지_않는다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(요청("TEXT", "data:audio/webm;base64," + base64(음성_바이트)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("audioData"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	@Test
	void 형식을_읽을_수_없는_음성은_저장하지_않는다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(요청("VOICE", "이건 Data URL 이 아니다"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("audioData"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	@Test
	void 상한을_넘는_음성은_저장하지_않는다() throws Exception {
		long before = handovers.count();
		byte[] 너무_큰_음성 = new byte[HandoverService.AUDIO_MAX_BYTES + 1];

		mockMvc
				.perform(요청("VOICE", "data:audio/webm;base64," + base64(너무_큰_음성)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("audioData"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	private Long 음성으로_저장한다(String dataUrl) throws Exception {
		return 저장한다("VOICE", dataUrl);
	}

	private Long 저장한다(String inputMethod, String dataUrl) throws Exception {
		mockMvc.perform(요청(inputMethod, dataUrl)).andExpect(status().isCreated());
		return handovers.findAll().stream()
				.max(Comparator.comparing(Handover::getId))
				.orElseThrow(() -> new IllegalStateException("저장된 인계가 없습니다."))
				.getId();
	}

	private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder 요청(
			String inputMethod, String dataUrl) {
		String audioField = dataUrl == null ? "" : ",\n  \"audioData\": \"%s\"".formatted(dataUrl);
		return post("/api/handovers")
				.contentType(MediaType.APPLICATION_JSON)
				.content(
						"""
						{
						  "careRecipientId": %d,
						  "rawText": "점심을 거의 안 드셨어요.",
						  "inputMethod": "%s",
						  "occurredAt": "2026-08-11T13:10:00",
						  "reporterName": "김요양"%s
						}
						"""
								.formatted(시드_어르신_id(), inputMethod, audioField));
	}

	private String base64(byte[] bytes) {
		return Base64.getEncoder().encodeToString(bytes);
	}

	private Long 시드_어르신_id() {
		return careRecipients.findAll().stream()
				.map(CareRecipient::getId)
				.findFirst()
				.orElseThrow(() -> new IllegalStateException("어르신 시드가 비어 있습니다."));
	}
}
