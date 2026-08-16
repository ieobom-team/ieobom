package com.ieobom.api.notification.push;

import com.ieobom.api.notification.push.dto.PushPublicKeyResponse;
import com.ieobom.api.notification.push.dto.PushSubscriptionRequest;
import com.ieobom.api.notification.push.dto.PushUnsubscribeRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 개인 기기 브라우저 웹 푸시 구독 엔드포인트. (Manyfast F-QPWGNS, #72)
 */
@RestController
@RequestMapping("/api/push-subscriptions")
@RequiredArgsConstructor
public class PushSubscriptionController {

	private final PushService pushService;

	/**
	 * VAPID 공개키 조회.
	 */
	@GetMapping("/public-key")
	public PushPublicKeyResponse getPublicKey() {
		return new PushPublicKeyResponse(pushService.getPublicKey());
	}

	/**
	 * 기기 구독 등록 / 갱신. (기기 단위 upsert)
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public void subscribe(@Valid @RequestBody PushSubscriptionRequest request) {
		pushService.subscribe(request);
	}

	/**
	 * 기기 구독 해제 / 연결 끊기.
	 */
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void unsubscribe(@Valid @RequestBody PushUnsubscribeRequest request) {
		pushService.unsubscribe(request.endpoint());
	}
}
