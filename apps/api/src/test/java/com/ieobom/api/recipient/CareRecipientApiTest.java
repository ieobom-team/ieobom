package com.ieobom.api.recipient;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@code GET /api/care-recipients} 계약 확인.
 *
 * <p>어르신은 {@code CareRecipientSeeder} 가 기동 시 넣은 데모 20명을 그대로 쓴다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CareRecipientApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;

	@Test
	void 입력_화면이_고를_수_있게_어르신_전원을_내려준다() throws Exception {
		mockMvc
				.perform(get("/api/care-recipients"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.careRecipients.length()").value(20))
				.andExpect(jsonPath("$.careRecipients[0].id").isNumber())
				.andExpect(jsonPath("$.careRecipients[0].name").isNotEmpty())
				.andExpect(jsonPath("$.careRecipients[0].code").isNotEmpty());
	}

	@Test
	void 목록은_이름_가나다순으로_내려온다() throws Exception {
		List<String> 가나다순 =
				careRecipients.findAll().stream()
						.map(CareRecipient::getName)
						.sorted(Comparator.naturalOrder())
						.toList();

		mockMvc
				.perform(get("/api/care-recipients"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.careRecipients[0].name").value(가나다순.get(0)))
				.andExpect(jsonPath("$.careRecipients[19].name").value(가나다순.get(19)));
	}

	@Test
	void 저장에_그대로_쓸_수_있는_id_를_내려준다() throws Exception {
		Long 첫_어르신 =
				careRecipients.findAll().stream()
						.map(CareRecipient::getId)
						.min(Comparator.naturalOrder())
						.orElseThrow();

		mockMvc
				.perform(get("/api/care-recipients"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.careRecipients[?(@.id == %d)]".formatted(첫_어르신)).exists());
	}
}
