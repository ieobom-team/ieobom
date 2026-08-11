package com.ieobom.api.handovercard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 키가 없을 때의 동작.
 *
 * <p>키를 비운 채로도 애플리케이션이 떠야 한다. 기동 시점에 막아 버리면 키를 가진 사람만 테스트를 돌릴 수 있게 된다. 대신 구조화를 호출하는 순간
 * 503 으로 알리고 카드는 하나도 만들지 않는다.
 *
 * <p>{@code properties} 로 키를 비우는 이유는 개발자 환경에 {@code LLM_API_KEY} 가 잡혀 있어도 이 테스트가 실제 호출로 새지 않게
 * 하기 위해서다.
 */
@SpringBootTest(properties = "ieobom.llm.api-key=")
@AutoConfigureMockMvc
class LlmUnavailableTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;

	@Test
	void 키가_없으면_카드를_만들지_않고_503_으로_알린다() throws Exception {
		Handover handover =
				handovers.save(
						Handover.builder()
								.careRecipient(careRecipients.findAll().get(0))
								.rawText("점심을 거의 안 드셨어요.")
								.inputMethod(InputMethod.TEXT)
								.occurredAt(LocalDateTime.now())
								.reporterName("김요양")
								.proxyInput(false)
								.build());

		mockMvc
				.perform(post("/api/handovers/{id}/cards", handover.getId()))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("LLM_UNAVAILABLE"))
				.andExpect(jsonPath("$.fields.length()").value(0));

		assertThat(cards.findByHandoverIdOrderByIdAsc(handover.getId())).isEmpty();
	}
}
