package com.ieobom.api.task;

import com.ieobom.api.task.dto.TaskCompleteRequest;
import com.ieobom.api.task.dto.TaskCompleteResponse;
import com.ieobom.api.task.dto.TaskCreateRequest;
import com.ieobom.api.task.dto.TaskResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 후속 업무 배정과 완료 처리. 계약은 {@code docs/contracts/task-api.md} 에 있다.
 *
 * <p>미처리 업무 <b>목록</b>은 여기 없다. 하원 미처리 브리핑과 당일 현황은 대시보드(Manyfast F-HQTFLK)의 몫이라 별도 Issue 로 뗀다.
 */
@RestController
@RequiredArgsConstructor
public class TaskController {

	private final TaskService taskService;

	/**
	 * 카드의 다음 행동을 후속 업무로 만든다. (유저플로우 n26 → n27 → n29)
	 *
	 * <p>AI 제안값(n28)을 내려주는 엔드포인트를 따로 두지 않는다. 카드 응답이 이미 {@code nextAction} · {@code
	 * suggestedJobRole} · {@code suggestedDueTime} 을 들고 있고, 배정 화면은 그것으로 미리 채운다.
	 */
	@PostMapping("/api/handover-cards/{cardId}/tasks")
	public ResponseEntity<TaskResponse> create(
			@PathVariable Long cardId, @Valid @RequestBody TaskCreateRequest request) {
		return ResponseEntity.status(201).body(taskService.create(cardId, request));
	}

	/** 업무 상세. (유저플로우 n34) */
	@GetMapping("/api/tasks/{taskId}")
	public TaskResponse find(@PathVariable Long taskId) {
		return taskService.find(taskId);
	}

	/**
	 * 완료로 닫는다. 확인자가 담당자와 달라도 된다. (유저플로우 n35)
	 *
	 * <p>이미 완료된 업무여도 {@code 200} 이다. 아무것도 바꾸지 않고 지금 상태를 돌려주며, 화면은 {@code alreadyCompleted} 로
	 * 중복 완료 안내(n37)를 띄운다.
	 */
	@PatchMapping("/api/tasks/{taskId}/complete")
	public TaskCompleteResponse complete(
			@PathVariable Long taskId, @Valid @RequestBody TaskCompleteRequest request) {
		return taskService.complete(taskId, request.normalizedCompletedByName());
	}
}
