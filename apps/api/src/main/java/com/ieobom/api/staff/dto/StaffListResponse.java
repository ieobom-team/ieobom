package com.ieobom.api.staff.dto;

import java.util.List;

/**
 * 직원 명단.
 *
 * <p>배열을 그대로 내리지 않고 한 겹 감싼다. 나중에 재직 여부 같은 조회 조건이 붙어도 응답 형태를 바꾸지 않기 위해서다.
 *
 * @param staff 이름 가나다순. 이름이 같으면 사번순
 */
public record StaffListResponse(List<StaffResponse> staff) {}
