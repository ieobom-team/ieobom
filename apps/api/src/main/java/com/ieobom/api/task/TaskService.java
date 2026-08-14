package com.ieobom.api.task;

import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.task.dto.TaskBriefingResponse;
import com.ieobom.api.task.dto.TaskCompleteResponse;
import com.ieobom.api.task.dto.TaskCreateRequest;
import com.ieobom.api.task.dto.TaskListResponse;
import com.ieobom.api.task.dto.TaskResponse;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 카드의 다음 행동을 담당자와 기한이 있는 업무로 바꾸고, 완료까지 닫는다. (Manyfast F-IVFNPC)
 *
 * <p>이 흐름에는 <b>지연 재알림도 다음 교대 자동 승계도 없다.</b> 당일 하원까지 닫히지 않은 업무는 다음 날로 넘어가지 않고 하원 미처리 브리핑에서
 * 사람이 확인한다. 그래서 기한이 당일 안에 있는지가 여기서 가장 중요한 검사다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

	static final String CARD_NOT_FOUND = "HANDOVER_CARD_NOT_FOUND";
	static final String NEXT_ACTION_MISSING = "CARD_NEXT_ACTION_MISSING";
	static final String RECIPIENT_NOT_RESOLVED = "CARE_RECIPIENT_NOT_RESOLVED";
	static final String TASK_ALREADY_CREATED = "TASK_ALREADY_CREATED";
	static final String TASK_NOT_FOUND = "TASK_NOT_FOUND";

	/**
	 * 미처리는 기한이 이른 것부터. 하원 전에 무엇부터 확인해야 하는지가 그대로 순서다.
	 *
	 * <p>기한이 같으면 먼저 만들어진 것을 앞에 둔다. 같은 값일 때의 순서를 정해 두지 않으면 새로고침할 때마다 목록이 흔들려서, 방금 본 항목을 다시 찾게
	 * 된다.
	 */
	private static final Comparator<Task> BY_DUE_TIME =
			Comparator.comparing(Task::getDueTime).thenComparing(Task::getId);

	/** 완료는 방금 닫힌 것부터. 관리자가 보는 것은 "무엇이 처리됐는가"이고 그 답은 최근에 있다. */
	private static final Comparator<Task> BY_COMPLETED_AT_DESC =
			Comparator.comparing(Task::getCompletedAt).reversed().thenComparing(Task::getId);

	private final TaskRepository taskRepository;
	private final HandoverCardRepository cardRepository;
	private final DueTimePolicy dueTimePolicy;

	/**
	 * 카드의 다음 행동을 후속 업무로 만든다. (Manyfast F-IVFNPC action)
	 *
	 * @throws NotFoundException 카드가 없을 때
	 * @throws RequestValidationException 담당자도 직종도 없거나, 기한이 당일 하원 시각을 넘을 때
	 * @throws ConflictException 카드에 다음 행동이 없거나, 대상 어르신을 가리지 못했거나, 이미 업무를 만든 카드일 때
	 */
	@Transactional
	public TaskResponse create(Long cardId, TaskCreateRequest request) {
		HandoverCard card =
				cardRepository
						.findWithCareRecipientAndHandover(cardId)
						.orElseThrow(() -> new NotFoundException(CARD_NOT_FOUND, "카드를 찾을 수 없습니다."));

		verifyAssignee(request);
		verifyDueTime(request);
		verifyCard(card);

		if (taskRepository.existsByHandoverCardId(cardId)) {
			throw new ConflictException(
					TASK_ALREADY_CREATED, "이 카드에서 이미 후속 업무를 만들었습니다. 업무 목록에서 확인해 주세요.");
		}

		Task task =
				taskRepository.save(
						Task.pending(
								card,
								request.normalizedContent(),
								request.assigneeJobRole(),
								request.normalizedAssigneeName(),
								request.dueTime()));

		logAssigned(task, card);
		return TaskResponse.from(task);
	}

	/** 업무 하나. (유저플로우 n34 업무 상세) */
	@Transactional(readOnly = true)
	public TaskResponse find(Long taskId) {
		return TaskResponse.from(findTask(taskId));
	}

	/**
	 * 그날 업무를 미처리와 완료로 나눠 돌려준다. (Manyfast F-HQTFLK action, 유저플로우 "AI 인계 도구 내비게이션 맵" n42 관리자 대시보드 ·
	 * n43 당일 인계·업무 현황)
	 *
	 * <p>이 파일의 배정·완료 쪽 번호(n21 · n34 등)는 아직 "새 플로우 3" 기준이다. 두 플로우에서 같은 번호가 다른 화면을 가리킨다.
	 *
	 * <p>인계 카드를 여기 같이 담지 않는다. 대시보드는 인계와 업무를 <b>따로</b> 불러서 한쪽이 실패해도 성공한 쪽을 그대로 보여 줘야 한다.
	 * (Manyfast F-HQTFLK exceptions) 한 응답으로 합치면 부분 실패를 구분할 자리가 사라진다.
	 */
	@Transactional(readOnly = true)
	public TaskListResponse findByDate(LocalDate date) {
		List<Task> tasks = findCreatedOn(date);

		List<TaskResponse> pending = sortedResponses(tasks, task -> !task.isDone(), BY_DUE_TIME);
		List<TaskResponse> done = sortedResponses(tasks, Task::isDone, BY_COMPLETED_AT_DESC);

		logDashboardViewed(date, pending.size(), done.size());
		return TaskListResponse.of(date, pending, done);
	}

	/**
	 * 그날 아직 닫히지 않은 업무. (Manyfast F-HQTFLK trigger · display, 유저플로우 n48 브리핑 선택 → n44 하원 미처리 브리핑 · n45 미처리
	 * 건수·목록)
	 *
	 * <p>대시보드 조회와 같은 데이터를 보지만 <b>엔드포인트를 나눈다.</b> Manyfast 가 대시보드 조회와 브리핑 확인을 서로 다른 이벤트로 남기라고
	 * 하는데, 같은 호출을 두 화면이 함께 쓰면 로그에서 둘을 가를 수 없다. (Manyfast F-HQTFLK outcome)
	 *
	 * <p><b>브리핑을 연 것을 확인으로 본다.</b> "확인했음" 버튼을 따로 두지 않는다. 이 화면은 누락을 막아 준다고 약속하지 않고 남은 것을 보여
	 * 주는 데서 멈추는데, 확인 버튼은 그것을 닫았다는 느낌으로 바꾼다.
	 */
	@Transactional(readOnly = true)
	public TaskBriefingResponse briefing(LocalDate date) {
		List<TaskResponse> pending =
				sortedResponses(findCreatedOn(date), task -> !task.isDone(), BY_DUE_TIME);

		logBriefingConfirmed(date, pending.size());
		return TaskBriefingResponse.of(date, pending);
	}

	/**
	 * 그날 <b>만들어진</b> 업무. (Manyfast F-HQTFLK dataSpec)
	 *
	 * <p>어제 만들어져 아직 미처리인 업무는 여기 걸리지 않는다. 당일만 보는 것이 명세이고 자동 승계도 없기 때문이다. (Manyfast F-HQTFLK
	 * rules) 그런 업무가 어느 화면에도 뜨지 않는다는 뜻이므로, 현장에서 문제가 되면 {@code propose-change} 로 올릴 지점이다.
	 */
	private List<Task> findCreatedOn(LocalDate date) {
		return taskRepository.findCreatedBetween(
				date.atStartOfDay(), date.plusDays(1).atStartOfDay());
	}

	private List<TaskResponse> sortedResponses(
			List<Task> tasks, Predicate<Task> filter, Comparator<Task> order) {
		return tasks.stream().filter(filter).sorted(order).map(TaskResponse::from).toList();
	}

	/**
	 * 완료로 닫는다. 확인자가 담당자와 달라도 된다. (Manyfast F-IVFNPC action · permissions)
	 *
	 * <p><b>이미 완료된 업무는 아무것도 바꾸지 않고 지금 상태를 돌려준다.</b> (Manyfast F-IVFNPC exceptions) 두 사람이 같은
	 * 업무를 닫으러 오는 것은 이 현장에서 정상이다 — 수행자가 처리했다고 말하고, 관리자가 하원 브리핑에서 같은 항목을 본다. 그때 나중에 누른 사람으로
	 * 완료 확인자가 바뀌면, 실제로 확인한 사람의 기록이 사라진다.
	 *
	 * @throws NotFoundException 업무가 없을 때
	 */
	@Transactional
	public TaskCompleteResponse complete(Long taskId, String completedByName) {
		Task task = findTask(taskId);

		if (task.isDone()) {
			log.info(
					"중복 완료 요청 — taskId={}, 바뀐 것 없음, 완료시점={}", task.getId(), task.getCompletedAt());
			return TaskCompleteResponse.duplicate(task);
		}

		task.complete(completedByName);

		logCompleted(task);
		return TaskCompleteResponse.completed(task);
	}

	private Task findTask(Long taskId) {
		return taskRepository
				.findWithCard(taskId)
				.orElseThrow(() -> new NotFoundException(TASK_NOT_FOUND, "업무를 찾을 수 없습니다."));
	}

	/**
	 * 담당이 정해졌는지. (Manyfast F-IVFNPC exceptions)
	 *
	 * <p>직종과 이름 중 하나면 된다. 수행자가 앱을 쓰지 않는 직종이면 사람을 특정하지 않고 직종으로만 배정하는 것이 현장의 기본 경로다. 두 항목을 모두
	 * 지목해 돌려주는 이유는, 어느 한쪽만 가리키면 화면이 엉뚱한 칸에 안내를 붙이기 때문이다.
	 */
	private void verifyAssignee(TaskCreateRequest request) {
		if (!request.hasAssignee()) {
			throw new RequestValidationException(
					"담당 직종 또는 담당자를 지정해 주세요.", List.of("assigneeJobRole", "assigneeName"));
		}
	}

	/**
	 * 기한이 당일 안에서 닫히는 값인지. (Manyfast F-IVFNPC rules)
	 *
	 * <p>이른 시각은 막지 않는다. 이미 지난 시각으로 들어오는 업무는 늦게 발견된 일이고, 그런 업무야말로 미처리로 떠 있어야 한다. 막으면 기록 자체가
	 * 남지 않는다.
	 */
	private void verifyDueTime(TaskCreateRequest request) {
		if (dueTimePolicy.isAfterDismissal(request.dueTime())) {
			throw new RequestValidationException("dueTime", dueTimePolicy.limitMessage());
		}
	}

	/**
	 * 업무를 만들 수 있는 카드인지. (Manyfast F-IVFNPC preconditions)
	 *
	 * <p>검토 완료까지는 요구하지 않는다. 유저플로우에서 카드 상세(n21)는 검토와 배정 두 갈래로 함께 열려 있고, Manyfast 도 "검토 가능한"
	 * 카드라고만 한다. 문구 생성과 다른 지점이다 — 문구는 보호자에게 나가지만 업무는 내부에서 닫힌다.
	 *
	 * <p>대상 어르신은 막는다. 누구의 일인지 모르는 업무는 담당자가 받아도 수행할 수 없고, 완료 확인은 더 못 한다.
	 */
	private void verifyCard(HandoverCard card) {
		if (card.getNextAction() == null || card.getNextAction().isBlank()) {
			throw new ConflictException(
					NEXT_ACTION_MISSING, "카드에 다음 행동이 없습니다. 카드를 먼저 검토해 다음 행동을 남겨 주세요.");
		}
		if (!card.isRecipientResolved()) {
			throw new ConflictException(RECIPIENT_NOT_RESOLVED, "대상 어르신을 먼저 지정해 주세요.");
		}
	}

	/**
	 * 업무 생성 이벤트. (Manyfast F-IVFNPC outcome)
	 *
	 * <p>카드 · 문구 쪽과 같은 이유로 별도 테이블 없이 애플리케이션 로그로 남긴다. <b>업무 내용과 담당자 이름은 남기지 않는다.</b> 어르신의 상태와
	 * 직원 이름이 로그 파일로 새어 나갈 이유가 없다. 대신 담당이 직종까지만 정해졌는지를 남긴다. 사람이 특정되지 않은 업무가 얼마나 되는지는 나중에
	 * 물을 값이다.
	 */
	private void logAssigned(Task task, HandoverCard card) {
		CareRecipient recipient = card.getCareRecipient();
		log.info(
				"후속 업무 배정 — taskId={}, cardId={}, careRecipientId={}, 담당직종={}, 담당자지정={}, 기한={}, 상태={}",
				task.getId(),
				card.getId(),
				recipient == null ? null : recipient.getId(),
				task.getAssigneeJobRole(),
				task.getAssigneeName() != null,
				task.getDueTime(),
				task.getStatus());
	}

	/** 완료 처리 이벤트. 대리 완료였는지를 함께 남긴다. (Manyfast F-IVFNPC outcome · display) */
	private void logCompleted(Task task) {
		log.info(
				"후속 업무 완료 — taskId={}, cardId={}, 기한={}, 완료시점={}, 대리완료={}",
				task.getId(),
				task.getHandoverCard().getId(),
				task.getDueTime(),
				task.getCompletedAt(),
				task.isDelegated());
	}

	/**
	 * 대시보드 조회 이벤트. (Manyfast F-HQTFLK outcome)
	 *
	 * <p>배정 · 완료 쪽과 같은 이유로 별도 테이블 없이 애플리케이션 로그로 남긴다. <b>업무 내용도 어르신도 담당자 이름도 남기지 않는다.</b>
	 * 목록 조회는 하루에 여러 번 도는 호출이라, 여기에 내용을 실으면 로그 파일이 그날 어르신들의 상태 기록이 된다. 남기는 것은 건수뿐이다.
	 */
	private void logDashboardViewed(LocalDate date, int pendingCount, int doneCount) {
		log.info("운영 현황 조회 — 기준일={}, 미처리={}건, 완료={}건", date, pendingCount, doneCount);
	}

	/**
	 * 하원 미처리 브리핑 확인 이벤트. (Manyfast F-HQTFLK outcome)
	 *
	 * <p>대시보드 조회와 <b>따로</b> 남긴다. Manyfast 가 두 이벤트를 구분해 요구하는 이유는, 관리자가 현황을 훑어본 것과 하원 전에 남은 것을
	 * 실제로 펴 본 것이 다른 행동이기 때문이다. 도입 효과를 나중에 물을 때 답이 되는 쪽은 뒤엣것이다.
	 */
	private void logBriefingConfirmed(LocalDate date, int pendingCount) {
		log.info("하원 미처리 브리핑 확인 — 기준일={}, 미처리={}건", date, pendingCount);
	}
}
