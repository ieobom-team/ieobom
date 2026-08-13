package com.ieobom.api.staff.dto;

import com.ieobom.api.staff.Staff;

/**
 * 직원 한 명.
 *
 * <p>진입 화면이 본인을 고를 때 쓴다.
 *
 * <p>**서버 id 를 내리지 않는다.** 인계와 후속 업무는 직원을 {@code reporterName} · {@code assigneeName} ·
 * {@code completedByName} 같은 **이름 문자열**로 가리키므로(Manyfast F-YJJJUX dataSpec) 화면이 직원 id 를 넘길 곳이
 * 없다. 내려 두면 언젠가 저장해 두고 싶어지는데, 그 결정은 아직 하지 않았다. (#33)
 *
 * @param name 이름. 입력자·담당자 이름으로 그대로 쓰인다
 * @param code 사번. 동명이인을 화면에서 구분하고, 저장된 선택값을 되살릴 때 쓴다
 */
public record StaffResponse(String name, String code) {

	public static StaffResponse from(Staff staff) {
		return new StaffResponse(staff.getName(), staff.getCode());
	}
}
