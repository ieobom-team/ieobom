package com.ieobom.api.recipient.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 어르신 이름 수정 요청. 유저플로우 "AI 인계 도구 내비게이션 맵" n54.
 *
 * <p>내부 ID 는 바꾸지 않는다. 기존 인계 기록과 카드가 그 값으로 어르신을 가리키고 있다.
 *
 * @param name 고칠 이름
 */
public record CareRecipientRenameRequest(
		@NotBlank(message = "어르신 이름을 입력해 주세요.")
				@Size(max = 50, message = "이름은 50자까지 넣을 수 있습니다.")
				String name) {

	public String trimmedName() {
		return name == null ? null : name.strip();
	}
}
