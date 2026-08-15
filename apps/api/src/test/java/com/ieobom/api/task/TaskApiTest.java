package com.ieobom.api.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 후속 업무 배정 · 완료 처리 계약 확인. (Manyfast F-IVFNPC)
 *
 * <p>여기서 보는 것은 세 가지다. <b>당일 시각 기한</b>이 실제로 강제되는가, 담당자나 기한이 빠졌을 때 업무가 만들어지지 않는가, 그리고
 * <b>대리 완료와 중복 완료</b>가 기록을 덮어쓰지 않는가.
 *
 * <p>하원 시각은 설정하지 않고 기본값 {@code 18:00} 으로 돈다. 상한이 실제로 그 값으로 걸리는지도 함께 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TaskApiTest {

	@Autowired private MockMvc mockMvc;
	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private NotificationRepository notifications;
	@Autowired private TaskRepository tasks;
	@Autowired private StaffRepository staffs;

	private CareRecipient 김말순;
	private Handover 인계;

	@BeforeEach
	void setUp() {
		notifications.deleteAll();
		tasks.deleteAll();
		cards.deleteAll();
		handovers.deleteAll();

		List<CareRecipient> seeded = careRecipients.findAll();
		김말순 = seeded.get(0);

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

	/**
	 * 업무를 남겨 두면 다른 테스트 클래스의 {@code cards.deleteAll()} 이 외래키에 걸린다. 실행 순서는 정해져 있지 않으므로 이 클래스가
	 * 끝날 때 스스로 치운다.
	 */
	@AfterEach
	void tearDown() {
		notifications.deleteAll();
		tasks.deleteAll();
	}

	@Test
	void 다음_행동이_담당자와_당일_기한이_있는_미처리_업무가_된다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{
						  "content": "저녁 식사량 확인",
						  "assigneeJobRole": "NURSE_AIDE",
						  "assigneeName": "박간호",
						  "dueTime": "17:30"
						}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.handoverCardId").value(card.getId()))
				.andExpect(jsonPath("$.careRecipientId").value(김말순.getId()))
				.andExpect(jsonPath("$.careRecipientName").value(김말순.getName()))
				.andExpect(jsonPath("$.content").value("저녁 식사량 확인"))
				.andExpect(jsonPath("$.assigneeJobRole").value("NURSE_AIDE"))
				.andExpect(jsonPath("$.assigneeJobRoleLabel").value("간호조무사"))
				.andExpect(jsonPath("$.assigneeName").value("박간호"))
				// 기한은 날짜 없이 당일 시각만, 초도 붙이지 않는다. (Manyfast F-IVFNPC rules)
				.andExpect(jsonPath("$.dueTime").value("17:30"))
				.andExpect(jsonPath("$.status").value("PENDING"))
				.andExpect(jsonPath("$.statusLabel").value("미처리"))
				.andExpect(jsonPath("$.delegated").value(false));

		assertThat(tasks.findAll())
				.singleElement()
				.satisfies(
						saved -> {
							assertThat(saved.getStatus()).isEqualTo(TaskStatus.PENDING);
							assertThat(saved.getDueTime()).isEqualTo(LocalTime.of(17, 30));
							assertThat(saved.getCompletedAt()).isNull();
						});
	}

	@Test
	void 담당_직종도_담당자도_없으면_보완할_항목을_모아_알려_준다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeName": "   ", "dueTime": "17:30"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields.length()").value(2));

		assertThat(tasks.findAll()).isEmpty();
	}

	@Test
	void 기한이_없으면_업무를_만들지_않는다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("dueTime"));

		assertThat(tasks.findAll()).isEmpty();
	}

	@Test
	void 날짜_단위_기한은_받지_않는다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		// 기한을 당일 시각으로만 받으므로 날짜가 섞인 값은 본문을 읽는 단계에서 걸린다.
		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "2026-08-12"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("dueTime"));

		assertThat(tasks.findAll()).isEmpty();
	}

	@Test
	void 하원_시각을_넘긴_기한은_거부한다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "18:30"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("dueTime"))
				// 상한이 몇 시인지 말해 주지 않으면 무엇으로 고쳐야 할지 알 수 없다.
				.andExpect(jsonPath("$.fields[0].reason").value(containsString("18:00")));

		assertThat(tasks.findAll()).isEmpty();
	}

	@Test
	void 하원_시각_정각은_기한으로_쓸_수_있다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "18:00"}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.dueTime").value("18:00"));
	}

	@Test
	void 없는_카드에서는_업무를_만들_수_없다() throws Exception {
		mockMvc
				.perform(배정(999_999L, """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
						"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("HANDOVER_CARD_NOT_FOUND"));
	}

	@Test
	void 다음_행동이_없는_카드에서는_업무를_만들지_않는다() throws Exception {
		HandoverCard card = 카드(김말순, null);

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
						"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("CARD_NEXT_ACTION_MISSING"));

		assertThat(tasks.findAll()).isEmpty();
	}

	@Test
	void 대상_어르신을_가리지_못한_카드에서는_업무를_만들지_않는다() throws Exception {
		HandoverCard card = 카드(null, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
						"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("CARE_RECIPIENT_NOT_RESOLVED"));

		assertThat(tasks.findAll()).isEmpty();
	}

	@Test
	void 카드_한_장에서_업무를_두_번_만들지_않는다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");
		업무(card, "박간호");

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 다시 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
						"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TASK_ALREADY_CREATED"));

		assertThat(tasks.findAll()).hasSize(1);
	}

	@Test
	void 담당자가_아닌_사람이_대신_완료_처리할_수_있다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), "박간호");

		mockMvc
				.perform(완료(task.getId(), """
						{"completedByName": "이복지"}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.alreadyCompleted").value(false))
				.andExpect(jsonPath("$.notice").doesNotExist())
				.andExpect(jsonPath("$.task.status").value("DONE"))
				.andExpect(jsonPath("$.task.statusLabel").value("완료"))
				.andExpect(jsonPath("$.task.completedByName").value("이복지"))
				// 확인자가 담당자와 다르다. 수행자가 앱을 쓰지 않아도 루프가 닫혀야 한다.
				.andExpect(jsonPath("$.task.delegated").value(true))
				.andExpect(jsonPath("$.task.completedAt").exists());

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(
						saved -> {
							assertThat(saved.getStatus()).isEqualTo(TaskStatus.DONE);
							assertThat(saved.getCompletedByName()).isEqualTo("이복지");
							assertThat(saved.getCompletedAt()).isNotNull();
						});
	}

	@Test
	void 이미_완료된_업무를_다시_완료하면_확인자와_시각이_바뀌지_않는다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), "박간호");
		mockMvc.perform(완료(task.getId(), """
				{"completedByName": "이복지"}
				""")).andExpect(status().isOk());

		Task 처음완료 = tasks.findById(task.getId()).orElseThrow();

		mockMvc
				.perform(완료(task.getId(), """
						{"completedByName": "최센터장"}
						"""))
				// 오류가 아니다. 화면이 보여 줘야 하는 것은 지금 이 업무가 어떤 상태인지다. (유저플로우 "새 플로우 3" n36 → n37)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.alreadyCompleted").value(true))
				.andExpect(jsonPath("$.notice").value(containsString("이미 완료")))
				.andExpect(jsonPath("$.task.completedByName").value("이복지"));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(
						saved -> {
							assertThat(saved.getCompletedByName()).isEqualTo(처음완료.getCompletedByName());
							assertThat(saved.getCompletedAt()).isEqualTo(처음완료.getCompletedAt());
						});
	}

	@Test
	void 완료_확인자가_없으면_완료_처리하지_않는다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), "박간호");

		mockMvc
				.perform(완료(task.getId(), """
						{"completedByName": "   "}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("completedByName"));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getStatus()).isEqualTo(TaskStatus.PENDING));
	}

	@Test
	void 당일_업무_목록은_미처리를_먼저_기한_순으로_준다() throws Exception {
		Task 늦은미처리 = 업무(카드(김말순, "저녁 식사량 확인"), "박간호", LocalTime.of(17, 30));
		Task 이른완료 = 업무(카드(김말순, "물리치료 확인"), "이재활", LocalTime.of(10, 0));
		Task 이른미처리 = 업무(카드(김말순, "투약 확인"), "박간호", LocalTime.of(9, 0));
		완료로_만든다(이른완료.getId(), "박간호");

		mockMvc
				.perform(get("/api/tasks").param("date", LocalDate.now().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tasks.length()").value(3))
				.andExpect(jsonPath("$.tasks[0].id").value(이른미처리.getId()))
				.andExpect(jsonPath("$.tasks[0].status").value("PENDING"))
				.andExpect(jsonPath("$.tasks[1].id").value(늦은미처리.getId()))
				.andExpect(jsonPath("$.tasks[1].status").value("PENDING"))
				.andExpect(jsonPath("$.tasks[2].id").value(이른완료.getId()))
				.andExpect(jsonPath("$.tasks[2].status").value("DONE"));
	}

	@Test
	void 다른_날짜를_지정하면_그날_업무만_준다() throws Exception {
		업무(카드(김말순, "저녁 식사량 확인"), "박간호", LocalTime.of(17, 30));

		mockMvc
				.perform(get("/api/tasks").param("date", LocalDate.now().minusDays(1).toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tasks.length()").value(0));
	}

	@Test
	void 날짜를_생략하면_오늘로_본다() throws Exception {
		업무(카드(김말순, "저녁 식사량 확인"), "박간호", LocalTime.of(17, 30));

		mockMvc
				.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.date").value(LocalDate.now().toString()))
				.andExpect(jsonPath("$.tasks.length()").value(1));
	}

	@Test
	void 업무_상세는_담당과_기한과_상태를_함께_준다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), "박간호");

		mockMvc
				.perform(get("/api/tasks/{id}", task.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.assigneeName").value("박간호"))
				.andExpect(jsonPath("$.assigneeJobRole").value("NURSE_AIDE"))
				.andExpect(jsonPath("$.dueTime").value("17:30"))
				.andExpect(jsonPath("$.status").value("PENDING"))
				.andExpect(jsonPath("$.careRecipientName").value(김말순.getName()));
	}

	@Test
	void 없는_업무는_완료_처리할_수_없다() throws Exception {
		mockMvc
				.perform(완료(999_999L, """
						{"completedByName": "이복지"}
						"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
	}

	@Test
	void 배정할_때_담당자를_고르면_확정_방식이_직접_배정이다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{
						  "content": "저녁 식사량 확인",
						  "assigneeJobRole": "NURSE_AIDE",
						  "assigneeName": "박간호",
						  "dueTime": "17:30"
						}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.claimMethod").value("DIRECT_ASSIGN"))
				.andExpect(jsonPath("$.claimMethodLabel").value("직접 배정"))
				.andExpect(jsonPath("$.claimedAt").exists())
				// 사람이 이미 정해진 업무에는 '내가 처리할게요'를 띄우지 않는다. (Manyfast F-IVFNPC display)
				.andExpect(jsonPath("$.claimable").value(false));
	}

	@Test
	void 직종만_배정된_업무는_확정_방식이_없고_맡을_수_있는_상태다() throws Exception {
		HandoverCard card = 카드(김말순, "저녁 식사량 확인");

		mockMvc
				.perform(배정(card.getId(), """
						{"content": "저녁 식사량 확인", "assigneeJobRole": "NURSE_AIDE", "dueTime": "17:30"}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.assigneeName").doesNotExist())
				// 방식은 담당자가 있을 때만 값을 가진다. (Manyfast F-IVFNPC dataSpec)
				.andExpect(jsonPath("$.claimMethod").doesNotExist())
				.andExpect(jsonPath("$.claimedAt").doesNotExist())
				.andExpect(jsonPath("$.claimable").value(true));
	}

	@Test
	void 배정된_직종_직원이_맡으면_담당자가_되고_상태는_미처리로_남는다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), null);
		Staff 간호조무사 = 직원(JobRole.NURSE_AIDE);

		mockMvc
				.perform(담당확정(task.getId(), 사번본문(간호조무사)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.claimed").value(true))
				.andExpect(jsonPath("$.alreadyClaimed").value(false))
				.andExpect(jsonPath("$.alreadyCompleted").value(false))
				.andExpect(jsonPath("$.notice").doesNotExist())
				.andExpect(jsonPath("$.task.assigneeName").value(간호조무사.getName()))
				.andExpect(jsonPath("$.task.claimMethod").value("SELF_CLAIM"))
				.andExpect(jsonPath("$.task.claimMethodLabel").value("직종에서 맡기"))
				.andExpect(jsonPath("$.task.claimedAt").exists())
				// 담당 확정은 담당자 정보의 변경이지 상태 추가가 아니다. (Manyfast F-IVFNPC rules)
				.andExpect(jsonPath("$.task.status").value("PENDING"))
				.andExpect(jsonPath("$.task.statusLabel").value("미처리"))
				.andExpect(jsonPath("$.task.claimable").value(false));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(
						saved -> {
							assertThat(saved.getAssigneeName()).isEqualTo(간호조무사.getName());
							assertThat(saved.getClaimMethod()).isEqualTo(ClaimMethod.SELF_CLAIM);
							assertThat(saved.getClaimedAt()).isNotNull();
							assertThat(saved.getStatus()).isEqualTo(TaskStatus.PENDING);
						});
	}

	@Test
	void 이미_다른_직원이_맡은_업무는_담당이_바뀌지_않는다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), null);
		Staff 먼저 = 직원(JobRole.NURSE_AIDE);
		mockMvc.perform(담당확정(task.getId(), 사번본문(먼저))).andExpect(status().isOk());

		Task 확정직후 = tasks.findById(task.getId()).orElseThrow();
		Staff 나중 = 다른_직원(JobRole.NURSE_AIDE, 먼저);

		mockMvc
				.perform(담당확정(task.getId(), 사번본문(나중)))
				// 오류가 아니다. 화면이 그려야 하는 것은 누가 언제 맡았는지다. (Manyfast F-IVFNPC exceptions)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.claimed").value(false))
				.andExpect(jsonPath("$.alreadyClaimed").value(true))
				.andExpect(jsonPath("$.notice").value(containsString(먼저.getName())))
				.andExpect(jsonPath("$.task.assigneeName").value(먼저.getName()))
				.andExpect(jsonPath("$.task.claimedAt").exists());

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(
						saved -> {
							assertThat(saved.getAssigneeName()).isEqualTo(확정직후.getAssigneeName());
							assertThat(saved.getClaimedAt()).isEqualTo(확정직후.getClaimedAt());
						});
	}

	@Test
	void 이미_완료된_업무는_맡을_수_없고_완료_상태를_돌려준다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), null);
		완료로_만든다(task.getId(), "이복지");

		mockMvc
				.perform(담당확정(task.getId(), 사번본문(직원(JobRole.NURSE_AIDE))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.claimed").value(false))
				.andExpect(jsonPath("$.alreadyCompleted").value(true))
				.andExpect(jsonPath("$.notice").value(containsString("이미 완료")))
				.andExpect(jsonPath("$.task.status").value("DONE"))
				.andExpect(jsonPath("$.task.completedByName").value("이복지"));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getAssigneeName()).isNull());
	}

	@Test
	void 배정된_직종이_아닌_직원은_맡을_수_없다() throws Exception {
		// 업무는 간호조무사에게 배정돼 있고 요청하는 사람은 요양보호사다.
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), null);

		mockMvc
				.perform(담당확정(task.getId(), 사번본문(직원(JobRole.CAREGIVER))))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TASK_JOB_ROLE_MISMATCH"));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getAssigneeName()).isNull());
	}

	@Test
	void 명단에_없는_사번으로는_맡을_수_없다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), null);

		mockMvc
				.perform(담당확정(task.getId(), """
						{"staffCode": "ST-999"}
						"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("STAFF_NOT_FOUND"));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getAssigneeName()).isNull());
	}

	@Test
	void 사번이_비어_있으면_담당을_확정하지_않는다() throws Exception {
		Task task = 업무(카드(김말순, "저녁 식사량 확인"), null);

		mockMvc
				.perform(담당확정(task.getId(), """
						{"staffCode": "   "}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fields[0].field").value("staffCode"));

		assertThat(tasks.findById(task.getId()))
				.get()
				.satisfies(saved -> assertThat(saved.getAssigneeName()).isNull());
	}

	@Test
	void 없는_업무는_맡을_수_없다() throws Exception {
		mockMvc
				.perform(담당확정(999_999L, 사번본문(직원(JobRole.NURSE_AIDE))))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
	}

	private MockHttpServletRequestBuilder 배정(Long cardId, String body) {
		return post("/api/handover-cards/{cardId}/tasks", cardId)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private MockHttpServletRequestBuilder 완료(Long taskId, String body) {
		return patch("/api/tasks/{taskId}/complete", taskId)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private MockHttpServletRequestBuilder 담당확정(Long taskId, String body) {
		return patch("/api/tasks/{taskId}/claim", taskId)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private String 사번본문(Staff staff) {
		return """
				{"staffCode": "%s"}
				""".formatted(staff.getCode());
	}

	/**
	 * 시드 명단에서 그 직종의 직원 하나. 사번을 테스트에 박아 두지 않는 이유는 시드가 바뀌면 여기가 함께 깨지기 때문이다. 이 테스트가 보려는 것은
	 * 특정 사번이 아니라 <b>직종이 맞는가</b>다.
	 */
	private Staff 직원(JobRole jobRole) {
		return staffs.findAll().stream()
				.filter(staff -> staff.getJobRole() == jobRole)
				.findFirst()
				.orElseThrow();
	}

	private Staff 다른_직원(JobRole jobRole, Staff 제외) {
		return staffs.findAll().stream()
				.filter(staff -> staff.getJobRole() == jobRole)
				.filter(staff -> !staff.getCode().equals(제외.getCode()))
				.findFirst()
				.orElseThrow();
	}

	/** 검토 단계를 거치지 않고 카드를 직접 만든다. 무엇이 카드가 되는지는 카드 쪽 테스트가 본다. */
	private HandoverCard 카드(CareRecipient recipient, String nextAction) {
		return cards.save(
				HandoverCard.builder()
						.handover(인계)
						.careRecipient(recipient)
						.observedAt(LocalDateTime.of(LocalDate.now(), LocalTime.of(12, 40)))
						.statusChange("점심 식사량 저하")
						.nextAction(nextAction)
						.evidenceText("점심을 거의 안 드셨어요")
						.safetyRelated(false)
						.reviewStatus(ReviewStatus.NEEDS_REVIEW)
						.build());
	}

	private Task 업무(HandoverCard card, String assigneeName) {
		return 업무(card, assigneeName, LocalTime.of(17, 30));
	}

	private Task 업무(HandoverCard card, String assigneeName, LocalTime dueTime) {
		return tasks.save(Task.pending(card, "저녁 식사량 확인", JobRole.NURSE_AIDE, assigneeName, null, dueTime));
	}

	/** API 를 거치지 않고 완료 상태로 만든다. 완료 처리 자체는 다른 테스트가 이미 본다. */
	private void 완료로_만든다(Long taskId, String completedByName) {
		Task task = tasks.findById(taskId).orElseThrow();
		task.complete(completedByName);
		tasks.save(task);
	}
}
