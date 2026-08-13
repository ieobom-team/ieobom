package com.ieobom.api.recipient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 어르신 명단 등록 · 수정 계약 확인. (Manyfast F-LUDCWW, 기준 버전 v0.4-recipient-directory)
 *
 * <p>{@code @Transactional} 로 각 테스트를 되돌린다. {@code CareRecipientSeeder} 가 넣은 데모 20명을 세는 {@link
 * CareRecipientApiTest} 와 같은 DB 를 쓰기 때문에, 여기서 넣은 어르신이 남으면 그쪽 개수 단언이 깨진다.
 *
 * <p>새 어르신의 내부 ID 를 {@code IB-021} 로 못박아 확인한다. 시드가 {@code IB-020} 까지 쓰고 있으므로, 이 값이 나온다는 것이
 * 곧 "시드 다음 순번부터 이어진다" 는 뜻이다.
 */
@Transactional
@SpringBootTest
@AutoConfigureMockMvc
class CareRecipientDirectoryApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private ObjectMapper objectMapper;
	@Autowired private CareRecipientRepository careRecipients;

	@Test
	void 이름을_등록하면_내부_ID를_부여한다() throws Exception {
		mockMvc
				.perform(register("""
						{ "name": "홍길동" }
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.name").value("홍길동"))
				.andExpect(jsonPath("$.code").value("IB-021"))
				.andExpect(jsonPath("$.dischargedAt").doesNotExist());
	}

	@Test
	void 내부_ID는_시드_다음_순번부터_이어진다() throws Exception {
		String 첫번째 = codeOf(register("""
				{ "name": "홍길동" }
				"""));
		String 두번째 = codeOf(register("""
				{ "name": "성춘향" }
				"""));

		assertThat(첫번째).isEqualTo("IB-021");
		assertThat(두번째).isEqualTo("IB-022");
	}

	@Test
	void 이름_앞뒤_공백은_저장하지_않는다() throws Exception {
		mockMvc
				.perform(register("""
						{ "name": "  홍길동  " }
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("홍길동"));
	}

	@Test
	void 이름이_비어_있으면_저장하지_않고_이름을_입력하도록_안내한다() throws Exception {
		mockMvc
				.perform(register("""
						{ "name": "   " }
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("name"))
				.andExpect(jsonPath("$.fields[0].reason").value("어르신 이름을 입력해 주세요."));
	}

	@Test
	void 동명이인이_있으면_저장을_막지_않고_확인을_요구한다() throws Exception {
		mockMvc
				.perform(register("""
						{ "name": "김말순" }
						"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DUPLICATE_RECIPIENT_NAME"))
				.andExpect(jsonPath("$.message").value(containsString("IB-001")));
	}

	@Test
	void 동명이인을_확인하면_다른_내부_ID로_저장한다() throws Exception {
		mockMvc
				.perform(register("""
						{ "name": "김말순", "confirmDuplicateName": true }
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("김말순"))
				.andExpect(jsonPath("$.code").value("IB-021"));

		assertThat(careRecipients.findByName("김말순")).hasSize(2);
	}

	@Test
	void 이름을_수정해도_내부_ID는_그대로다() throws Exception {
		Long id = idOf(register("""
				{ "name": "홍길동" }
				"""));

		mockMvc
				.perform(rename(id, """
						{ "name": "홍길순" }
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("홍길순"))
				.andExpect(jsonPath("$.code").value("IB-021"));
	}

	@Test
	void 수정할_이름이_비어_있으면_안내한다() throws Exception {
		Long id = idOf(register("""
				{ "name": "홍길동" }
				"""));

		mockMvc
				.perform(rename(id, """
						{ "name": "" }
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields[0].field").value("name"));
	}

	@Test
	void 없는_어르신을_수정하면_404다() throws Exception {
		mockMvc
				.perform(rename(999_999L, """
						{ "name": "홍길순" }
						"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_FOUND"));
	}

	@Test
	void 이용_종료로_표시하면_새_입력의_대상_목록에서_빠진다() throws Exception {
		Long id = idOf(register("""
				{ "name": "홍길동" }
				"""));

		mockMvc
				.perform(discharge(id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.dischargedAt").isNotEmpty());

		mockMvc
				.perform(get("/api/care-recipients"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.careRecipients[?(@.code == 'IB-021')]").isEmpty());
	}

	@Test
	void 이용_종료한_어르신도_명단_화면에는_상태와_함께_남는다() throws Exception {
		Long id = idOf(register("""
				{ "name": "홍길동" }
				"""));
		mockMvc.perform(discharge(id)).andExpect(status().isOk());

		mockMvc
				.perform(get("/api/care-recipients").param("includeDischarged", "true"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.careRecipients[?(@.code == 'IB-021')].dischargedAt").isNotEmpty());
	}

	@Test
	void 이미_이용_종료한_어르신을_다시_눌러도_오류가_아니다() throws Exception {
		Long id = idOf(register("""
				{ "name": "홍길동" }
				"""));

		String 처음 = fieldOf(discharge(id), "dischargedAt");
		String 다시 = fieldOf(discharge(id), "dischargedAt");

		assertThat(다시).isEqualTo(처음);
	}

	@Test
	void 삭제_API는_없다() throws Exception {
		Long id = idOf(register("""
				{ "name": "홍길동" }
				"""));

		mockMvc
				.perform(delete("/api/care-recipients/{id}", id))
				.andExpect(status().isMethodNotAllowed());
	}

	private MockHttpServletRequestBuilder register(String body) {
		return post("/api/care-recipients").contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private MockHttpServletRequestBuilder rename(Long id, String body) {
		return patch("/api/care-recipients/{id}", id)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private MockHttpServletRequestBuilder discharge(Long id) {
		return post("/api/care-recipients/{id}/discharge", id);
	}

	private JsonNode responseOf(MockHttpServletRequestBuilder request) throws Exception {
		return objectMapper.readTree(
				mockMvc.perform(request).andReturn().getResponse().getContentAsString());
	}

	private Long idOf(MockHttpServletRequestBuilder request) throws Exception {
		return responseOf(request).get("id").asLong();
	}

	private String codeOf(MockHttpServletRequestBuilder request) throws Exception {
		return responseOf(request).get("code").asString();
	}

	private String fieldOf(MockHttpServletRequestBuilder request, String field) throws Exception {
		return responseOf(request).get(field).asString();
	}
}
