package com.ieobom.api.handover;

import com.ieobom.api.handover.dto.HandoverAudioContent;
import com.ieobom.api.handover.dto.HandoverCreateRequest;
import com.ieobom.api.handover.dto.HandoverResponse;
import com.ieobom.api.handover.dto.HandoverTranscribeRequest;
import com.ieobom.api.handover.dto.HandoverTranscribeResponse;
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
	 * 녹음한 음성을 글로 바꾼다. (Manyfast F-YJJJUX rules — 기기가 녹음만 하고 서버가 글로 바꿔 돌려준다)
	 *
	 * <p><b>인계 id 를 받지 않는다.</b> 직원이 마이크를 멈춘 직후, 아직 아무것도 저장되지 않은 시점에 부르기 때문이다. 여기서도 저장하지 않고
	 * 글만 돌려준다 — 음성은 직원이 확인을 마친 뒤 {@code POST /api/handovers} 로 함께 올라온다.
	 *
	 * <p>변환이 실패하면 {@code 503} 이다. 화면은 그때도 녹음한 원본 음성을 들고 있고 글 칸에 직접 입력해 저장을 마칠 수 있다. (#147)
	 */
	@PostMapping("/transcribe")
	public HandoverTranscribeResponse transcribe(
			@Valid @RequestBody HandoverTranscribeRequest request) {
		return handoverService.transcribe(request);
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
