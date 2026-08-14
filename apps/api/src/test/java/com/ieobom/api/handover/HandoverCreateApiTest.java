package com.ieobom.api.handover;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.hamcrest.Matchers.nullValue;

import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.util.Comparator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@code POST /api/handovers} 계약 확인.
 *
 * <p>어르신은 {@code CareRecipientSeeder} 가 기동 시 넣은 데모 20명을 그대로 쓴다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class HandoverCreateApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;

	@Test
	void 필수값을_모두_채우면_원문_그대로_저장된다() throws Exception {
		Long recipientId = 시드_어르신_id();
		String rawText = "점심 드시고 나서 오른쪽 다리를 계속 주무르셨어요.";

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "%s",
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T13:10:00",
										  "reporterName": "김요양"
										}
										"""
												.formatted(recipientId, rawText)))
				.andExpect(status().isCreated())
				.andExpect(header().exists("Location"))
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.careRecipientId").value(recipientId))
				.andExpect(jsonPath("$.careRecipientName").isNotEmpty())
				.andExpect(jsonPath("$.rawText").value(rawText))
				.andExpect(jsonPath("$.inputMethod").value("TEXT"))
				.andExpect(jsonPath("$.reporterName").value("김요양"))
				.andExpect(jsonPath("$.proxyInput").value(false))
				.andExpect(jsonPath("$.infoSource").value(nullValue()))
				.andExpect(jsonPath("$.createdAt").isNotEmpty());

		Handover saved = 마지막_인계();
		assertThat(saved.getRawText()).isEqualTo(rawText);
		assertThat(saved.isProxyInput()).isFalse();
		assertThat(saved.getInfoSource()).isNull();
	}

	@Test
	void 대리_입력은_입력자와_정보_출처가_갈라져_저장된다() throws Exception {
		Long recipientId = 시드_어르신_id();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "등원 차량에서 보호자가 어르신이 밤사이 잠을 못 주무셨다고 전해 주셨어요.",
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T09:20:00",
										  "reporterName": "박데스크",
										  "proxyInput": true,
										  "infoSource": "GUARDIAN"
										}
										"""
												.formatted(recipientId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.proxyInput").value(true))
				.andExpect(jsonPath("$.reporterName").value("박데스크"))
				.andExpect(jsonPath("$.infoSource").value("GUARDIAN"));

		Handover saved = 마지막_인계();
		assertThat(saved.isProxyInput()).isTrue();
		assertThat(saved.getReporterName()).isEqualTo("박데스크");
		assertThat(saved.getInfoSource()).isEqualTo(InfoSource.GUARDIAN);
	}

	@Test
	void 어르신과_원문이_없으면_저장하지_않고_두_항목을_모두_알려_준다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T13:10:00",
										  "reporterName": "김요양"
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields.length()").value(2))
				.andExpect(jsonPath("$.fields[0].field").value("careRecipientId"))
				.andExpect(jsonPath("$.fields[0].reason").isNotEmpty())
				.andExpect(jsonPath("$.fields[1].field").value("rawText"))
				.andExpect(jsonPath("$.fields[1].reason").isNotEmpty());

		assertThat(handovers.count()).isEqualTo(before);
	}

	@Test
	void 입력_방식과_입력_시점과_입력자가_없으면_보완할_항목으로_돌아온다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "오후 내내 기침을 하셨어요."
										}
										"""
												.formatted(시드_어르신_id())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields.length()").value(3))
				.andExpect(jsonPath("$.fields[0].field").value("inputMethod"))
				.andExpect(jsonPath("$.fields[1].field").value("occurredAt"))
				.andExpect(jsonPath("$.fields[2].field").value("reporterName"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	@Test
	void 대리_입력인데_정보_출처가_없으면_보완을_안내한다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "다른 선생님께 들었는데 오전에 어지럽다고 하셨대요.",
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T11:00:00",
										  "reporterName": "박데스크",
										  "proxyInput": true
										}
										"""
												.formatted(시드_어르신_id())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("infoSource"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	@Test
	void 직접_입력인데_정보_출처가_붙으면_저장하지_않는다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "제가 직접 봤어요.",
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T11:00:00",
										  "reporterName": "김요양",
										  "infoSource": "DRIVER"
										}
										"""
												.formatted(시드_어르신_id())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("proxyInput"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	@Test
	void 없는_어르신을_가리키면_404_로_알려_준다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": 999999,
										  "rawText": "오후 내내 기침을 하셨어요.",
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T13:10:00",
										  "reporterName": "김요양"
										}
										"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_FOUND"))
				.andExpect(jsonPath("$.fields.length()").value(0));

		assertThat(handovers.count()).isEqualTo(before);
	}

	@Test
	void 정의되지_않은_입력_방식은_그_항목을_짚어_돌려준다() throws Exception {
		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "오후 내내 기침을 하셨어요.",
										  "inputMethod": "SIGN_LANGUAGE",
										  "occurredAt": "2026-08-11T13:10:00",
										  "reporterName": "김요양"
										}
										"""
												.formatted(시드_어르신_id())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("inputMethod"));
	}

	@Test
	void 원문이_2000자를_넘으면_저장하지_않는다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "%s",
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T13:10:00",
										  "reporterName": "김요양"
										}
										"""
												.formatted(시드_어르신_id(), "가".repeat(2001))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("rawText"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	/**
	 * 입력자 이름 상한. 계약({@code docs/contracts/handover-api.md})과 {@code Handover.reporterName} 의 컬럼
	 * 길이가 모두 50 이다. 검증이 빠지면 안내 대신 DB 예외(500)가 나간다.
	 */
	@Test
	void 입력자_이름이_50자를_넘으면_저장하지_않는다() throws Exception {
		long before = handovers.count();

		mockMvc
				.perform(
						post("/api/handovers")
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "careRecipientId": %d,
										  "rawText": "오후 내내 기침을 하셨어요.",
										  "inputMethod": "TEXT",
										  "occurredAt": "2026-08-11T13:10:00",
										  "reporterName": "%s"
										}
										"""
												.formatted(시드_어르신_id(), "김".repeat(51))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("reporterName"));

		assertThat(handovers.count()).isEqualTo(before);
	}

	private Long 시드_어르신_id() {
		return careRecipients.findAll().stream()
				.map(CareRecipient::getId)
				.findFirst()
				.orElseThrow(() -> new IllegalStateException("어르신 시드가 비어 있습니다."));
	}

	private Handover 마지막_인계() {
		return handovers.findAll().stream()
				.max(Comparator.comparing(Handover::getId))
				.orElseThrow(() -> new IllegalStateException("저장된 인계가 없습니다."));
	}
}
