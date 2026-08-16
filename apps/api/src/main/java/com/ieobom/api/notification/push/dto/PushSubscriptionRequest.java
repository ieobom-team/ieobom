package com.ieobom.api.notification.push.dto;

import jakarta.validation.constraints.NotBlank;

public record PushSubscriptionRequest(
		@NotBlank(message = "사번은 필수입니다")
		String staffCode,

		@NotBlank(message = "endpoint 는 필수입니다")
		String endpoint,

		@NotBlank(message = "p256dh 키는 필수입니다")
		String p256dh,

		@NotBlank(message = "auth 키는 필수입니다")
		String auth
) {}
