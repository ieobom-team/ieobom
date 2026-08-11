package com.ieobom.api.export.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 어르신 한 명의 당일 묶음 전부.
 *
 * @param bundles 전산 기록 묶음과 보호자 전달 묶음. <b>언제나 두 개다.</b> 한쪽에 담을 문구가 없어도 자리는 남는다. 화면이 "묶음 칸이 아예
 *     없는 상태"와 "묶을 문구가 없는 상태"를 구분하지 못하면 안 된다
 */
public record ExportBundleListResponse(
		Long careRecipientId,
		String careRecipientName,
		LocalDate date,
		List<ExportBundleResponse> bundles) {}
