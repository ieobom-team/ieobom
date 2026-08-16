package com.ieobom.api.notification.push.dto;

import jakarta.validation.constraints.NotBlank;

public record PushUnsubscribeRequest(
		@NotBlank(message = "endpoint 는 필수입니다")
		String endpoint
) {}
