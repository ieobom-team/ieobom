package com.ieobom.api.recipient.dto;

import java.util.List;

/**
 * 어르신 목록.
 *
 * <p>배열을 그대로 내리지 않고 한 겹 감싼다. 나중에 반 · 재원 여부 같은 조회 조건이 붙어도 응답 형태를 바꾸지 않기 위해서다.
 *
 * @param careRecipients 이름 가나다순. 이름이 같으면 식별번호순
 */
public record CareRecipientListResponse(List<CareRecipientResponse> careRecipients) {}
