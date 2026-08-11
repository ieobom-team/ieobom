package com.ieobom.api.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 완료 처리 요청. (Manyfast F-IVFNPC action · outcome)
 *
 * <p>받는 것은 <b>완료를 확인한 사람</b> 하나다. 상태를 요청으로 받지 않는 이유는 상태가 두 값뿐이고 이 엔드포인트가 그중 한 방향만 하기 때문이다.
 * 미처리로 되돌리는 동작은 Manyfast 에 없다.
 *
 * @param completedByName 완료를 확인한 사람. <b>담당자와 달라도 된다.</b> 수행자가 앱을 설치하지 않아도 확인한 사람이 대신 눌러 루프를
 *     닫는 것이 이 제품의 전제다
 */
public record TaskCompleteRequest(
		@NotBlank(message = "완료를 확인한 사람을 선택해 주세요.")
				@Size(max = 50, message = "이름은 50자까지 넣을 수 있습니다.")
				String completedByName) {

	public String normalizedCompletedByName() {
		return completedByName == null ? null : completedByName.trim();
	}
}
