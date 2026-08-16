package com.ieobom.api.notification.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import tools.jackson.databind.ObjectMapper;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.notification.push.dto.PushSubscriptionRequest;
import com.ieobom.api.notification.push.dto.PushUnsubscribeRequest;
import com.ieobom.api.staff.Staff;
import com.ieobom.api.staff.StaffRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PushSubscriptionControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private StaffRepository staffRepository;

	@Autowired
	private PushSubscriptionRepository pushSubscriptionRepository;

	private Staff staff1;
	private Staff staff2;

	@BeforeEach
	void setUp() {
		pushSubscriptionRepository.deleteAll();
		staff1 = staffRepository.findByCode("ST-001").orElseThrow();
		staff2 = staffRepository.findByCode("ST-002").orElseThrow();
	}

	@Test
	@DisplayName("GET /api/push-subscriptions/public-key — 공개키 응답")
	void getPublicKey() throws Exception {
		mockMvc.perform(get("/api/push-subscriptions/public-key"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.publicKey").exists());
	}

	@Test
	@DisplayName("POST /api/push-subscriptions — 신규 구독 등록 201")
	void subscribeNew() throws Exception {
		PushSubscriptionRequest request = new PushSubscriptionRequest(
				staff1.getCode(),
				"https://fcm.googleapis.com/fcm/send/sample-endpoint-1",
				"sample-p256dh-key",
				"sample-auth-key");

		mockMvc.perform(
						post("/api/push-subscriptions")
								.contentType(MediaType.APPLICATION_JSON)
								.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isCreated());

		PushSubscription saved = pushSubscriptionRepository
				.findByEndpoint("https://fcm.googleapis.com/fcm/send/sample-endpoint-1")
				.orElseThrow();
		assertThat(saved.getStaff().getCode()).isEqualTo(staff1.getCode());
		assertThat(saved.getP256dh()).isEqualTo("sample-p256dh-key");
	}

	@Test
	@DisplayName("POST /api/push-subscriptions — 같은 기기에서 다른 직원으로 재등록 시 덮어쓰기 (upsert)")
	void subscribeUpsert() throws Exception {
		String endpoint = "https://fcm.googleapis.com/fcm/send/shared-tablet-endpoint";

		// 직원 1 등록
		pushSubscriptionRepository.save(new PushSubscription(staff1, endpoint, "key1", "auth1"));

		// 직원 2로 재등록
		PushSubscriptionRequest request = new PushSubscriptionRequest(
				staff2.getCode(),
				endpoint,
				"key2",
				"auth2");

		mockMvc.perform(
						post("/api/push-subscriptions")
								.contentType(MediaType.APPLICATION_JSON)
								.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isCreated());

		PushSubscription updated = pushSubscriptionRepository.findByEndpoint(endpoint).orElseThrow();
		assertThat(updated.getStaff().getCode()).isEqualTo(staff2.getCode());
		assertThat(updated.getP256dh()).isEqualTo("key2");
		assertThat(pushSubscriptionRepository.findAll()).hasSize(1);
	}

	@Test
	@DisplayName("POST /api/push-subscriptions — 필수값 누락 시 400")
	void subscribeValidationFailed() throws Exception {
		PushSubscriptionRequest request = new PushSubscriptionRequest(
				"",
				"https://fcm.googleapis.com/fcm/send/sample-endpoint",
				"key",
				"auth");

		mockMvc.perform(
						post("/api/push-subscriptions")
								.contentType(MediaType.APPLICATION_JSON)
								.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
	}

	@Test
	@DisplayName("POST /api/push-subscriptions — 명단에 없는 사번이면 404")
	void subscribeStaffNotFound() throws Exception {
		PushSubscriptionRequest request = new PushSubscriptionRequest(
				"ST-999",
				"https://fcm.googleapis.com/fcm/send/sample-endpoint",
				"key",
				"auth");

		mockMvc.perform(
						post("/api/push-subscriptions")
								.contentType(MediaType.APPLICATION_JSON)
								.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("STAFF_NOT_FOUND"));
	}

	@Test
	@DisplayName("DELETE /api/push-subscriptions — 구독 해제 204")
	void unsubscribe() throws Exception {
		String endpoint = "https://fcm.googleapis.com/fcm/send/sample-endpoint";
		pushSubscriptionRepository.save(new PushSubscription(staff1, endpoint, "key", "auth"));

		PushUnsubscribeRequest request = new PushUnsubscribeRequest(endpoint);

		mockMvc.perform(
						delete("/api/push-subscriptions")
								.contentType(MediaType.APPLICATION_JSON)
								.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isNoContent());

		assertThat(pushSubscriptionRepository.findByEndpoint(endpoint)).isEmpty();
	}
}
