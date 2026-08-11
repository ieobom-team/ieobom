package com.ieobom.api.export.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 직원이 고친 문구. (Manyfast F-GUSOFG action)
 *
 * <p>고칠 수 있는 것은 문구 본문 하나뿐이다. 유형과 연결 카드는 문구가 어디서 나왔는지를 말하는 값이라 요청으로 받지 않는다. 받으면 전산 기록 문구를 보호자
 * 문구로 바꿔치기하거나, 다른 어르신 카드에 문구를 옮겨 붙일 수 있다.
 *
 * @param text 고친 문구. 비워 보낼 수 없다. 지우는 것이 아니라 고치는 동작이다
 */
public record ExportPhraseUpdateRequest(@NotBlank(message = "문구를 입력해 주세요.") String text) {}
