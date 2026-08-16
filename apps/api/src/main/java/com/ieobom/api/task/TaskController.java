package com.ieobom.api.task;

import com.ieobom.api.task.dto.TaskBriefingResponse;
import com.ieobom.api.task.dto.TaskClaimRequest;
import com.ieobom.api.task.dto.TaskClaimResponse;
import com.ieobom.api.task.dto.TaskCompleteRequest;
import com.ieobom.api.task.dto.TaskCompleteResponse;
import com.ieobom.api.task.dto.TaskCreateRequest;
import com.ieobom.api.task.dto.TaskListResponse;
import com.ieobom.api.task.dto.TaskReassignRequest;
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
 * 후속 업무 배정 · 완료 처리와, 당일 운영 현황이 읽는 업무 목록. 계약은 {@code docs/contracts/task-api.md} 에 있다.
 *
 * <p>목록 조회는 대시보드(Manyfast F-HQTFLK)와 현장 근무자 화면(Manyfast F-IVFNPC)이 함께 쓴다.
 * 돌려주는 것이 업무이고 경로도 {@code /api/tasks} 아래라, 같은 컨트롤러에서 관리한다.
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

	/**
	 * 당일 업무 목록. (유저플로우 "새 플로우 3" n31 · n32 / "AI 인계 도구 내비게이션 맵" n42 관리자 대시보드 · n43 당일 인계·업무 현황)
	 * {@code date} 를 생략하면 오늘이다.
	 *
	 * <p>인계 카드는 여기 담지 않는다. 대시보드가 인계와 업무를 따로 불러야 한쪽이 실패해도 성공한 쪽을 그대로 보여 줄 수 있다. (Manyfast
	 * F-HQTFLK exceptions)
	 */
	@GetMapping("/api/tasks")
	public TaskListResponse findByDate(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate date) {
		return taskService.findByDate(date == null ? LocalDate.now() : date);
	}

	/**
	 * 하원 미처리 브리핑. 그날 아직 닫히지 않은 업무만 준다. (유저플로우 "AI 인계 도구 내비게이션 맵" n48 브리핑 선택 → n44 하원 미처리 브리핑 · n45 미처리 건수·목록)
	 *
	 * <p><b>이 경로는 아래 {@code /api/tasks/{taskId}} 와 깊이가 같다.</b> Spring 은 경로 변수보다 리터럴을 먼저 맞추므로
	 * {@code pending-briefing} 이 {@code taskId} 로 흘러가지 않지만, 그것은 프레임워크의 매칭 규칙에 기대는 동작이다. 규칙이
	 * 바뀌거나 매핑을 손대는 순간 이 경로는 조용히 400 이 되므로 {@code TaskListApiTest} 가 그 매칭을 고정한다.
	 */
	@GetMapping("/api/tasks/pending-briefing")
	public TaskBriefingResponse briefing(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate date) {
		return taskService.briefing(date == null ? LocalDate.now() : date);
	}

	/** 업무 상세. (유저플로우 "새 플로우 3" n34) */
	@GetMapping("/api/tasks/{taskId}")
	public TaskResponse find(@PathVariable Long taskId) {
		return taskService.find(taskId);
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

	/**
	 * 직종에만 배정된 업무를 맡는다. (유저플로우 "새 플로우 5" n40 후속 업무 상세 → {@code '내가 처리할게요' 선택})
	 *
	 * <p>맡지 못했어도 {@code 200} 이다. 이미 다른 직원이 맡았거나 완료된 업무면 아무것도 바꾸지 않고 지금 상태를 돌려주며, 화면은
	 * {@code alreadyClaimed} · {@code alreadyCompleted} 로 안내를 가른다. {@code complete} 와 같은 패턴이다.
	 *
	 * <p><b>맡은 것을 다시 놓는 경로는 두지 않는다.</b> Manyfast 가 제공하지 않는 동작이고, 담당 변경은 관리자가 한다.
	 * (F-IVFNPC rules)
	 */
	@PatchMapping("/api/tasks/{taskId}/claim")
	public TaskClaimResponse claim(
			@PathVariable Long taskId, @Valid @RequestBody TaskClaimRequest request) {
		return taskService.claim(taskId, request.normalizedStaffCode());
	}

	/**
	 * 관리자가 후속 업무의 담당자를 변경한다. (Manyfast F-IVFNPC permissions)
	 */
	@PatchMapping("/api/tasks/{taskId}/assignee")
	public TaskResponse reassign(
			@PathVariable Long taskId, @Valid @RequestBody TaskReassignRequest request) {
		return taskService.reassign(taskId, request);
	}
}
