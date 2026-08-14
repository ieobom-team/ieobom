package com.ieobom.api.recipient.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 어르신 등록 요청. 이름 하나만 받는다. (Manyfast F-LUDCWW dataSpec — "어르신 등록은 이름만 받고 그 외 개인정보는 받지 않는다")
 *
 * <p>내부 ID 는 요청에 없다. 서버가 부여한다. 클라이언트가 정하게 두면 시드와 순번이 겹친다.
 *
 * @param name 어르신 이름
 * @param confirmDuplicateName 동명이인이 있다는 안내를 보고도 등록하겠다는 확인. 유저플로우 "AI 인계 도구 내비게이션 맵" n53
 */
public record CareRecipientCreateRequest(
		@NotBlank(message = "어르신 이름을 입력해 주세요.")
				@Size(max = 50, message = "이름은 50자까지 넣을 수 있습니다.")
				String name,
		Boolean confirmDuplicateName) {

	/** 이름 앞뒤 공백은 저장하지 않는다. 목록에서 눈으로 찾는 값이라 보이지 않는 차이를 남기지 않는다. */
	public String trimmedName() {
		return name == null ? null : name.strip();
	}

	/** 생략된 확인은 확인하지 않은 것으로 본다. */
	public boolean isDuplicateNameConfirmed() {
		return Boolean.TRUE.equals(confirmDuplicateName);
	}
}
