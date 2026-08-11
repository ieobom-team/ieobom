package com.ieobom.api.handover;

import com.ieobom.api.handover.dto.HandoverCreateRequest;
import com.ieobom.api.handover.dto.HandoverResponse;
import jakarta.validation.Valid;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
}
