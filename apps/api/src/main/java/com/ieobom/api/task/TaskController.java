package com.ieobom.api.task;

import com.ieobom.api.task.dto.TaskCompleteRequest;
import com.ieobom.api.task.dto.TaskCompleteResponse;
import com.ieobom.api.task.dto.TaskCreateRequest;
import com.ieobom.api.task.dto.TaskListResponse;
import com.ieobom.api.task.dto.TaskResponse;
import jakarta.validation.Valid;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 후속 업무 배정과 완료 처리. 계약은 {@code docs/contracts/task-api.md} 에 있다.
 *
 * <p>여기서 내려주는 목록은 그날 업무를 있는 그대로 나열한 것뿐이다. 건수 집계, 하원 미처리 브리핑,
 * 인계 카드·기록 문구로의 이동은 당일 현황을 종합하는 대시보드(Manyfast F-HQTFLK)의 몫이라 별도
 * Issue(#16)로 뗀다.
 */
@RestController
@RequiredArgsConstructor
public class TaskController {

	private final TaskService taskService;

	/**
	 * 카드의 다음 행동을 후속 업무로 만든다. (유저플로우 "새 플로우 3" n26 → n27 → n29)
	 *
	 * <p>AI 제안값(n28)을 내려주는 엔드포인트를 따로 두지 않는다. 카드 응답이 이미 {@code nextAction} · {@code
	 * suggestedJobRole} · {@code suggestedDueTime} 을 들고 있고, 배정 화면은 그것으로 미리 채운다.
	 */
	@PostMapping("/api/handover-cards/{cardId}/tasks")
	public ResponseEntity<TaskResponse> create(
			@PathVariable Long cardId, @Valid @RequestBody TaskCreateRequest request) {
		return ResponseEntity.status(201).body(taskService.create(cardId, request));
	}

	/** 업무 상세. (유저플로우 "새 플로우 3" n34) */
	@GetMapping("/api/tasks/{taskId}")
	public TaskResponse find(@PathVariable Long taskId) {
		return taskService.find(taskId);
	}

	/** 그날 업무 목록. {@code date} 를 생략하면 오늘이다. (유저플로우 "새 플로우 3" n31 · n32) */
	@GetMapping("/api/tasks")
	public TaskListResponse findByDate(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate date) {
		return taskService.findByDate(date == null ? LocalDate.now() : date);
	}

	/**
	 * 완료로 닫는다. 확인자가 담당자와 달라도 된다. (유저플로우 "새 플로우 3" n35)
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
