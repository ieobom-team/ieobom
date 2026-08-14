package com.ieobom.api.staff;

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
 * {@code GET /api/staff} 계약 확인.
 *
 * <p>직원은 {@code StaffSeeder} 가 기동 시 넣은 데모 8명을 그대로 쓴다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StaffApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private StaffRepository staff;

	@Test
	void 진입_화면이_고를_수_있게_직원_전원을_내려준다() throws Exception {
		mockMvc
				.perform(get("/api/staff"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.staff.length()").value(8))
				.andExpect(jsonPath("$.staff[0].name").isNotEmpty())
				.andExpect(jsonPath("$.staff[0].code").isNotEmpty());
	}

	@Test
	void 목록은_이름_가나다순으로_내려온다() throws Exception {
		List<String> 가나다순 =
				staff.findAll().stream().map(Staff::getName).sorted(Comparator.naturalOrder()).toList();

		mockMvc
				.perform(get("/api/staff"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.staff[0].name").value(가나다순.get(0)))
				.andExpect(jsonPath("$.staff[7].name").value(가나다순.get(7)));
	}

	@Test
	void 이름_사번_직종을_내려주고_서버_id는_내리지_않는다() throws Exception {
		// 서버 id 는 저장할 곳이 없어 내리지 않는다. (#33)
		mockMvc
				.perform(get("/api/staff"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.staff[0].name").isNotEmpty())
				.andExpect(jsonPath("$.staff[0].code").isNotEmpty())
				.andExpect(jsonPath("$.staff[0].jobRole").isNotEmpty())
				.andExpect(jsonPath("$.staff[0].jobRoleLabel").isNotEmpty())
				.andExpect(jsonPath("$.staff[0].id").doesNotExist());
	}
}
