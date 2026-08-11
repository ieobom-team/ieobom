package com.ieobom.api.export.dto;

import com.ieobom.api.export.ExportPhraseType;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * 묶음 복사 기록 요청. (Manyfast F-GUSOFG outcome)
 *
 * <p><b>복사할 문구의 식별자를 받지 않는다.</b> 서버가 조회와 같은 규칙으로 묶음을 다시 만들어 그 안의 문구에 기록을 남긴다. 클라이언트가 목록을
 * 정하게 하면 화면이 보여 준 묶음과 복사 기록이 갈릴 수 있다.
 *
 * @param phraseType 어느 묶음을 복사했는지. 유형이 없으면 무엇이 복사됐는지 기록할 수 없다
 * @param date 어느 날의 묶음인지. 생략하면 오늘이다
 */
public record ExportBundleCopyRequest(
		@NotNull(message = "복사한 문구 유형을 선택해 주세요.") ExportPhraseType phraseType, LocalDate date) {}
