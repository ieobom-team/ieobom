package com.ieobom.api.notification.push;

import tools.jackson.databind.ObjectMapper;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.notification.NotificationType;
import com.ieobom.api.notification.push.dto.PushSubscriptionRequest;
import com.ieobom.api.staff.Staff;
import com.ieobom.api.staff.StaffRepository;
import com.ieobom.api.task.Task;
import jakarta.annotation.PostConstruct;
import java.security.GeneralSecurityException;
import java.security.Security;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Subscription;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * VAPID 웹 푸시 발송 및 기기 구독 관리 서비스. (Manyfast F-QPWGNS, #72)
 *
 * <p><b>프라이버시 규칙</b>: 푸시 본문에는 어르신 실명, 증상, 투약, 낙상, 병원 일정, 인계 원문을 담지 않는다.
 * "새 후속 업무가 배정되었습니다" 까지만 담고, 상세는 앱에서 본다.
 *
 * <p><b>장애 격리</b>: 푸시 발송이 실패하거나 구독이 무효여도 앱 내 알림과 업무 흐름은 유지된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {

	private static final String STAFF_NOT_FOUND = "STAFF_NOT_FOUND";

	private final PushSubscriptionRepository pushSubscriptionRepository;
	private final StaffRepository staffRepository;
	private final ObjectMapper objectMapper;

	@Value("${ieobom.vapid.public-key:}")
	private String publicKey;

	@Value("${ieobom.vapid.private-key:}")
	private String privateKey;

	@Value("${ieobom.vapid.subject:mailto:admin@ieobom.com}")
	private String subject;

	private nl.martijndwars.webpush.PushService webPushClient;

	@PostConstruct
	public void init() {
		if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
			Security.addProvider(new BouncyCastleProvider());
		}

		if (publicKey != null && !publicKey.isBlank() && privateKey != null && !privateKey.isBlank()) {
			try {
				webPushClient = new nl.martijndwars.webpush.PushService();
				webPushClient.setPublicKey(publicKey);
				webPushClient.setPrivateKey(privateKey);
				webPushClient.setSubject(subject);
				log.info("VAPID PushService 초기화 완료 (subject={})", subject);
			} catch (GeneralSecurityException e) {
				log.warn("VAPID 키 파싱 실패 — 푸시 발송 비활성화", e);
				webPushClient = null;
			}
		} else {
			log.info("VAPID 키 미설정 — 푸시 발송 비활성화 (로컬 개발 모드)");
		}
	}

	public String getPublicKey() {
		return publicKey;
	}

	/**
	 * 기기 구독 등록 / 갱신 (기기 단위 upsert).
	 * 같은 기기(endpoint)에서 다시 등록하면 연결 직원만 덮어쓴다. (Manyfast F-QPWGNS action)
	 */
	@Transactional
	public void subscribe(PushSubscriptionRequest request) {
		Staff staff = staffRepository
				.findByCode(request.staffCode())
				.orElseThrow(() -> new NotFoundException(STAFF_NOT_FOUND, "직원을 찾을 수 없습니다: " + request.staffCode()));

		PushSubscription subscription = pushSubscriptionRepository
				.findByEndpoint(request.endpoint())
				.orElse(null);

		if (subscription == null) {
			subscription = new PushSubscription(
					staff,
					request.endpoint(),
					request.p256dh(),
					request.auth());
		} else {
			subscription.updateStaff(staff);
			subscription.updateKeys(request.p256dh(), request.auth());
		}

		pushSubscriptionRepository.save(subscription);
		log.info("푸시 구독 등록 완료 — staffCode={}, endpoint={}", staff.getCode(), maskEndpoint(request.endpoint()));
	}

	/**
	 * 기기 구독 해제 / 연결 끊기. (Manyfast F-QPWGNS action)
	 */
	@Transactional
	public void unsubscribe(String endpoint) {
		pushSubscriptionRepository.deleteByEndpoint(endpoint);
		log.info("푸시 구독 해제 완료 — endpoint={}", maskEndpoint(endpoint));
	}

	/**
	 * 업무 관련 사건 알림 시 푸시 발송. (Manyfast F-QPWGNS trigger & action)
	 *
	 * <p><b>어르신 실명, 증상, 인계 원문은 절대 넣지 않는다.</b>
	 */
	@Transactional
	public void sendTaskPush(Staff recipient, Task task, NotificationType type) {
		if (webPushClient == null) {
			log.debug("VAPID 클라이언트 미설정으로 푸시 발송 건너뜀");
			return;
		}

		List<PushSubscription> subscriptions = pushSubscriptionRepository.findAllByStaff(recipient);
		if (subscriptions.isEmpty()) {
			return;
		}

		String title = "이어봄";
		String body = switch (type) {
			case TASK_ASSIGNED -> "새 후속 업무가 배정되었습니다" + (task.getDueTime() != null ? " (기한: " + task.getDueTime() + ")" : "");
			case ASSIGNEE_CHANGED -> "담당 업무가 변경되었습니다";
			case DELEGATED_COMPLETION -> "담당 업무가 대리 완료되었습니다";
		};
		String url = "/tasks/" + task.getId();

		String payload;
		try {
			payload = objectMapper.writeValueAsString(Map.of(
					"title", title,
					"body", body,
					"url", url,
					"taskId", task.getId()));
		} catch (Exception e) {
			log.error("푸시 페이로드 직렬화 실패", e);
			return;
		}

		LocalDateTime now = LocalDateTime.now();
		for (PushSubscription sub : subscriptions) {
			try {
				Subscription webPushSub = new Subscription(
						sub.getEndpoint(),
						new Subscription.Keys(sub.getP256dh(), sub.getAuth()));

				Notification notification = new Notification(webPushSub, payload);
				HttpResponse response = webPushClient.send(notification);
				int statusCode = response.getStatusLine().getStatusCode();

				if (statusCode == 201) {
					sub.recordSuccess(now);
				} else if (statusCode == 404 || statusCode == 410) {
					log.info("무효 구독 자동 삭제 — status={}, endpoint={}", statusCode, maskEndpoint(sub.getEndpoint()));
					pushSubscriptionRepository.delete(sub);
				} else {
					log.warn("푸시 발송 실패 응답 — status={}, endpoint={}", statusCode, maskEndpoint(sub.getEndpoint()));
					sub.recordFailure("HTTP " + statusCode, now);
				}
			} catch (Exception e) {
				log.warn("푸시 발송 중 예외 발생 — endpoint={}, error={}", maskEndpoint(sub.getEndpoint()), e.getMessage());
				sub.recordFailure("ERROR: " + e.getClass().getSimpleName(), now);
			}
		}
	}

	private String maskEndpoint(String endpoint) {
		if (endpoint == null || endpoint.length() < 30) {
			return endpoint;
		}
		return endpoint.substring(0, 25) + "..." + endpoint.substring(endpoint.length() - 8);
	}
}
