package com.ieobom.api.handover.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 녹음한 음성을 글로 바꿔 달라는 요청.
 *
 * <p><b>아직 인계 기록이 없는 시점에 부른다.</b> 직원이 마이크를 멈춘 직후, 글을 확인하고 어르신을 고르기 전이다. 그래서 인계 id 를 받지 않는다.
 *
 * <p>{@code audioData} 는 등록 요청({@link HandoverCreateRequest#audioData()})과 <b>같은 형식</b>이다. 화면이 이미
 * 그 형식으로 녹음을 들고 있고, 서버도 같은 파서와 같은 크기 상한을 그대로 쓴다. (#147)
 *
 * @param audioData 녹음한 원본 음성. Base64 Data URL {@code data:audio/…;base64,…}
 */
public record HandoverTranscribeRequest(
		@NotBlank(message = "변환할 음성이 없습니다.") String audioData) {}
