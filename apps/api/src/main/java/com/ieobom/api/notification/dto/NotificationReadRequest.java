package com.ieobom.api.notification.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 알림 하나를 읽음으로 바꾸는 요청. (Manyfast F-JIEOJO action)
 *
 * <p><b>사번을 함께 받는다.</b> 알림 id 만으로 읽음 처리하면 남의 알림 id 를 아는 것만으로 그 사람의 알림함이 바뀐다. 인증이 없는
 * 제품이라 이 값도 화면이 신고하는 값이지만 (F-JIEOJO permissions), 받아 두면 적어도 <b>실수로</b> 남의 알림을 건드리는
 * 경로가 없어진다.
 */
public record NotificationReadRequest(
		@NotBlank(message = "직원 사번을 함께 보내 주세요.") String staffCode) {

	public String normalizedStaffCode() {
		return staffCode == null ? null : staffCode.trim();
	}
}
