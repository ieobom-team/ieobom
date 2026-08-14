package com.ieobom.api.handover;

import com.ieobom.api.handover.dto.HandoverAudioContent;
import com.ieobom.api.handover.dto.HandoverCreateRequest;
import com.ieobom.api.handover.dto.HandoverResponse;
import jakarta.validation.Valid;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 현장 특이사항 입력. 계약은 {@code docs/contracts/handover-api.md} 에 있다. */
@RestController
@RequestMapping("/api/handovers")
@RequiredArgsConstructor
public class HandoverController {

	private final HandoverService handoverService;

	@PostMapping
	public ResponseEntity<HandoverResponse> register(
			@Valid @RequestBody HandoverCreateRequest request) {
		HandoverResponse response = handoverService.register(request);
		return ResponseEntity.created(URI.create("/api/handovers/" + response.id())).body(response);
	}

	/**
	 * 음성으로 남긴 입력의 원본 녹음. 카드 상세에서 재생할 때 부른다. (Manyfast F-SNBVHR)
	 *
	 * <p>음성이 없으면 {@code 404} 다. 인계 기록 자체가 없을 때와 구분하지 않는다 — 어느 쪽이든 화면이 할 일은 같고, 없는 id 를 넣어 보며 기록의
	 * 존재를 확인할 수 있게 둘 이유도 없다.
	 */
	@GetMapping("/{id}/audio")
	public ResponseEntity<byte[]> getAudio(@PathVariable Long id) {
		HandoverAudioContent audio = handoverService.findAudio(id);
		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType(audio.mimeType()))
				.contentLength(audio.data().length)
				.body(audio.data());
	}
}
