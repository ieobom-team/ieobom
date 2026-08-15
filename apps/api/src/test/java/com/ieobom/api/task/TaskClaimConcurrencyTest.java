package com.ieobom.api.task;

import static org.assertj.core.api.Assertions.assertThat;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.handovercard.ReviewStatus;
import com.ieobom.api.notification.NotificationRepository;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import com.ieobom.api.staff.Staff;
import com.ieobom.api.staff.StaffRepository;
import com.ieobom.api.task.dto.TaskClaimResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 담당 확정 경합. (Manyfast F-IVFNPC action — "여러 직원이 동시에 선택하면 먼저 도달한 한 명에게만 적용한다")
 *
 * <p>직종에만 배정된 업무는 그 직종 직원 전원의 목록에 함께 뜬다. 그래서 <b>두 사람이 같은 순간에 누르는 것이 이 화면의 정상적인 사용</b>이고,
 * 그때 나중 사람이 담당자를 덮어쓰면 먼저 맡은 사람은 자기가 맡은 줄 알고 일하는데 화면에는 다른 이름이 뜬다.
 *
 * <p>이 테스트가 실제로 고정하는 것은 <b>경합 판정이 어디에 있는가</b>다. 조건을 자바에서 보고 저장하면 두 요청이 같은 "비어 있음"을 읽고 둘 다
 * 저장한다. 조건을 {@code UPDATE ... where assignee_name is null} 안에 두면 그 구조 자체가 불가능해진다.
 *
 * <p><b>테스트 DB 는 H2 이고 배포는 MySQL 이다.</b> 그래서 여기서 확인되는 것은 InnoDB 의 잠금 동작이 아니라 <b>애플리케이션이
 * 판정을 DB 에 맡겼는지</b>다. 두 엔진 모두 한 행의 조건부 UPDATE 를 원자적으로 평가하므로 이 구조는 옮겨 가지만, MySQL 에서 직접
 * 확인한 것은 아니다. (실제 엔진 확인이 필요해지면 Testcontainers 도입이 별도 Issue 다 — {@code src/test/resources/application.yml})
 */
@SpringBootTest
class TaskClaimConcurrencyTest {

	private static final int ATTEMPTS = 2;

	@Autowired private TaskService taskService;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private NotificationRepository notifications;
	@Autowired private TaskRepository tasks;
	@Autowired private StaffRepository staffs;

	private Handover 인계;

	@BeforeEach
	void setUp() {
		notifications.deleteAll();
		tasks.deleteAll();
		cards.deleteAll();
		handovers.deleteAll();

		CareRecipient 김말순 = careRecipients.findAll().get(0);
		인계 =
				handovers.save(
						Handover.builder()
								.careRecipient(김말순)
								.rawText("점심을 거의 안 드셨어요.")
								.inputMethod(InputMethod.TEXT)
								.occurredAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(13, 10)))
								.reporterName("김요양")
								.proxyInput(false)
								.build());
	}

	@AfterEach
	void tearDown() {
		notifications.deleteAll();
		tasks.deleteAll();
	}

	@Test
	void 두_직원이_동시에_맡아도_한_명만_담당자가_된다() throws Exception {
		Task task = 직종만_배정된_업무();
		List<Staff> 간호조무사들 = 직종_직원(JobRole.NURSE_AIDE);

		List<TaskClaimResponse> results = 동시에_맡는다(task.getId(), 간호조무사들);

		List<TaskClaimResponse> 성공 = results.stream().filter(TaskClaimResponse::claimed).toList();
		assertThat(성공).hasSize(1);
		assertThat(results).filteredOn(TaskClaimResponse::alreadyClaimed).hasSize(1);

		// 진 쪽이 받은 응답에도 이긴 쪽 이름이 들어 있어야 "이미 누가 맡았습니다"를 그릴 수 있다.
		String 담당자 = 성공.get(0).task().assigneeName();
		assertThat(results).allSatisfy(result -> assertThat(result.task().assigneeName()).isEqualTo(담당자));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(
						saved -> {
							assertThat(saved.getAssigneeName()).isEqualTo(담당자);
							assertThat(saved.getClaimMethod()).isEqualTo(ClaimMethod.SELF_CLAIM);
							// 담당이 정해져도 업무는 미처리로 남는다. (Manyfast F-IVFNPC rules)
							assertThat(saved.getStatus()).isEqualTo(TaskStatus.PENDING);
						});
	}

	/**
	 * 두 요청을 같은 순간에 출발시킨다.
	 *
	 * <p>{@link CountDownLatch} 로 문을 열어 주는 이유는 순서대로 부르면 경합이 아예 일어나지 않아 이 테스트가 아무것도 확인하지 못하기
	 * 때문이다. 스레드를 만드는 시간이 서로 달라서, 만들자마자 부르면 사실상 순차 호출이 된다.
	 */
	private List<TaskClaimResponse> 동시에_맡는다(Long taskId, List<Staff> 직원들) throws Exception {
		CountDownLatch 출발 = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(ATTEMPTS);
		try {
			List<Future<TaskClaimResponse>> futures =
					직원들.stream()
							.limit(ATTEMPTS)
							.map(
									staff ->
											pool.submit(
													(Callable<TaskClaimResponse>)
															() -> {
																출발.await();
																return taskService.claim(taskId, staff.getCode());
															}))
							.toList();

			출발.countDown();
			List<TaskClaimResponse> results = futures.stream().map(TaskClaimConcurrencyTest::결과).toList();
			assertThat(results).hasSize(ATTEMPTS);
			return results;
		} finally {
			pool.shutdown();
			pool.awaitTermination(10, TimeUnit.SECONDS);
		}
	}

	/**
	 * 스레드에서 나온 결과.
	 *
	 * <p>예외를 삼키지 않고 그대로 터뜨린다. 경합에서 진 요청은 <b>예외가 아니라 {@code alreadyClaimed} 응답</b>이어야 하므로,
	 * 여기서 예외가 나면 그 자체가 이 테스트가 잡아야 할 실패다.
	 */
	private static TaskClaimResponse 결과(Future<TaskClaimResponse> future) {
		try {
			return future.get(10, TimeUnit.SECONDS);
		} catch (Exception e) {
			throw new IllegalStateException("담당 확정 요청이 응답 대신 예외로 끝났다", e);
		}
	}

	/** 담당자 없이 직종에만 배정된 업무. 이런 업무만 맡을 수 있다. */
	private Task 직종만_배정된_업무() {
		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(인계)
								.careRecipient(인계.getCareRecipient())
								.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
								.statusChange("점심 식사량 저하")
								.nextAction("저녁 식사량 확인")
								.evidenceText("점심을 거의 안 드셨어요")
								.safetyRelated(false)
								.reviewStatus(ReviewStatus.NEEDS_REVIEW)
								.build());

		return tasks.save(
				Task.pending(card, "저녁 식사량 확인", JobRole.NURSE_AIDE, null, null, LocalTime.of(17, 30)));
	}

	private List<Staff> 직종_직원(JobRole jobRole) {
		List<Staff> found =
				staffs.findAll().stream().filter(staff -> staff.getJobRole() == jobRole).toList();
		assertThat(found).hasSizeGreaterThanOrEqualTo(ATTEMPTS);
		return found;
	}
}
