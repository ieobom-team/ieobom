package com.ieobom.api.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 담당 확정 요청. (Manyfast F-IVFNPC action — "'내가 처리할게요'를 선택해 자신을 담당자로 확정한다")
 *
 * <p><b>받는 것은 사번 하나다.</b> 이름과 직종을 함께 받지 않는다. Manyfast 는 "배정된 직종에 속한 직원만 그 업무를 맡을 수 있다"고
 * 하는데 (F-IVFNPC permissions), 직종을 요청에서 받으면 그 검사는 <b>보낸 쪽이 스스로 신고한 값</b>을 보는 것이 되어 검사가 아니게
 * 된다. 사번으로 받으면 서버가 직원 명단에서 이름과 직종을 직접 읽는다.
 *
 * <p>완료 처리({@link TaskCompleteRequest})가 이름을 받는 것과 갈리는 지점이다. 완료는 <b>누구나</b> 대신 눌러도 되므로 검사할
 * 것이 없지만, 담당 확정은 직종을 본다.
 *
 * @param staffCode 맡는 직원의 사번. 진입 화면에서 고른 본인 값이 그대로 온다
 */
public record TaskClaimRequest(
		@NotBlank(message = "맡을 직원을 선택해 주세요.")
				@Size(max = 30, message = "사번은 30자까지 넣을 수 있습니다.")
				String staffCode) {

	public String normalizedStaffCode() {
		return staffCode == null ? null : staffCode.trim();
	}
}
