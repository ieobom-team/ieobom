package com.ieobom.api.handovercard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handover.InfoSource;
import com.ieobom.api.handover.InputMethod;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import com.ieobom.api.task.Task;
import com.ieobom.api.task.TaskRepository;
import com.ieobom.api.task.TaskStatus;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

/** 어르신 → 인계 원문 → 카드 → 후속 업무가 한 줄로 저장되고 다시 읽히는지 확인한다. */
@DataJpaTest
class HandoverGraphMappingTest {

	@Autowired private CareRecipientRepository careRecipients;
	@Autowired private HandoverRepository handovers;
	@Autowired private HandoverCardRepository cards;
	@Autowired private TaskRepository tasks;
	@Autowired private EntityManager em;

	@Test
	void 대리_입력에서_후속_업무까지_한_줄로_저장되고_다시_읽힌다() {
		CareRecipient recipient = 어르신을_저장한다("김말순", "T-001");

		Handover handover =
				handovers.save(
						Handover.builder()
								.careRecipient(recipient)
								.rawText("등원 차량에서 보호자가 어르신이 밤사이 잠을 못 주무셨다고 전해 주셨어요.")
								.inputMethod(InputMethod.TEXT)
								.occurredAt(LocalDateTime.of(2026, 8, 11, 9, 20))
								.reporterName("박데스크")
								.proxyInput(true)
								.infoSource(InfoSource.GUARDIAN)
								.build());

		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(handover)
								.careRecipient(recipient)
								.observedAt(LocalDateTime.of(2026, 8, 11, 9, 20))
								.statusChange("밤사이 수면 부족")
								.nextAction("오전 중 컨디션 확인")
								.evidenceText("밤사이 잠을 못 주무셨다고 전해 주셨어요")
								.safetyRelated(false)
								.reviewStatus(ReviewStatus.NEEDS_REVIEW)
								.suggestedJobRole(JobRole.NURSE_AIDE)
								.suggestedDueTime(LocalTime.of(11, 30))
								.build());

		Task task =
				tasks.save(
						Task.builder()
								.handoverCard(card)
								.content("오전 중 컨디션 확인")
								.assigneeJobRole(JobRole.NURSE_AIDE)
								.assigneeName("이간호")
								.dueTime(LocalTime.of(11, 30))
								.status(TaskStatus.PENDING)
								.build());

		비우고_다시_읽는다();

		Task found = tasks.findById(task.getId()).orElseThrow();
		assertThat(found.getDueTime()).isEqualTo(LocalTime.of(11, 30));
		assertThat(found.getStatus()).isEqualTo(TaskStatus.PENDING);
		assertThat(found.getAssigneeJobRole()).isEqualTo(JobRole.NURSE_AIDE);
		assertThat(found.getCompletedAt()).isNull();

		HandoverCard foundCard = found.getHandoverCard();
		assertThat(foundCard.getReviewStatus()).isEqualTo(ReviewStatus.NEEDS_REVIEW);
		assertThat(foundCard.getSuggestedDueTime()).isEqualTo(LocalTime.of(11, 30));
		assertThat(foundCard.getCareRecipient().getName()).isEqualTo("김말순");
		assertThat(foundCard.getCreatedAt()).isNotNull();

		Handover foundHandover = foundCard.getHandover();
		assertThat(foundHandover.isProxyInput()).isTrue();
		assertThat(foundHandover.getInfoSource()).isEqualTo(InfoSource.GUARDIAN);
		assertThat(foundHandover.getReporterName()).isEqualTo("박데스크");
		assertThat(foundHandover.getInputMethod()).isEqualTo(InputMethod.TEXT);
	}

	@Test
	void 대리_완료는_담당자와_다른_사람_이름으로_남는다() {
		HandoverCard card = 검토_완료_카드를_저장한다();

		Task task =
				tasks.save(
						Task.builder()
								.handoverCard(card)
								.content("보호자에게 낙상 위험 안내")
								.assigneeJobRole(JobRole.SOCIAL_WORKER)
								.assigneeName("이복지")
								.dueTime(LocalTime.of(16, 0))
								.status(TaskStatus.DONE)
								.completedAt(LocalDateTime.of(2026, 8, 11, 15, 40))
								.completedByName("정센터장")
								.build());

		비우고_다시_읽는다();

		Task found = tasks.findById(task.getId()).orElseThrow();
		assertThat(found.getAssigneeName()).isEqualTo("이복지");
		assertThat(found.getCompletedByName()).isEqualTo("정센터장");
		assertThat(found.getStatus()).isEqualTo(TaskStatus.DONE);
	}

	@Test
	void 안전_관련_항목은_판정_출처와_함께_저장된다() {
		CareRecipient recipient = 어르신을_저장한다("박순자", "T-002");
		Handover handover = 인계를_저장한다(recipient, "오후에 화장실 앞에서 미끄러지실 뻔했어요.");

		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(handover)
								.careRecipient(recipient)
								.statusChange("낙상 위험 상황")
								.evidenceText("화장실 앞에서 미끄러지실 뻔했어요")
								.safetyRelated(true)
								.safetyFlagSource(SafetyFlagSource.KEYWORD)
								.reviewStatus(ReviewStatus.NEEDS_REVIEW)
								.build());

		비우고_다시_읽는다();

		HandoverCard found = cards.findById(card.getId()).orElseThrow();
		assertThat(found.isSafetyRelated()).isTrue();
		assertThat(found.getSafetyFlagSource()).isEqualTo(SafetyFlagSource.KEYWORD);
	}

	@Test
	void 대상_어르신을_가릴_수_없는_카드는_어르신_없이_검토_대상으로_남는다() {
		CareRecipient recipient = 어르신을_저장한다("이영순", "T-003");
		Handover handover = 인계를_저장한다(recipient, "두 분 다 점심을 거의 안 드셨어요.");

		HandoverCard card =
				cards.save(
						HandoverCard.builder()
								.handover(handover)
								.statusChange("점심 식사량 저하")
								.evidenceText("두 분 다 점심을 거의 안 드셨어요")
								.safetyRelated(true)
								.safetyFlagSource(SafetyFlagSource.KEYWORD)
								.reviewStatus(ReviewStatus.NEEDS_REVIEW)
								.build());

		비우고_다시_읽는다();

		HandoverCard found = cards.findById(card.getId()).orElseThrow();
		assertThat(found.getCareRecipient()).isNull();
		assertThat(found.getReviewStatus()).isEqualTo(ReviewStatus.NEEDS_REVIEW);
	}

	@Test
	void 근거_원문이_없는_카드는_저장되지_않는다() {
		CareRecipient recipient = 어르신을_저장한다("최정자", "T-004");
		Handover handover = 인계를_저장한다(recipient, "오늘은 특별한 일이 없었어요.");

		HandoverCard 근거없는_카드 =
				HandoverCard.builder()
						.handover(handover)
						.careRecipient(recipient)
						.statusChange("특이사항 없음")
						.safetyRelated(false)
						.reviewStatus(ReviewStatus.NEEDS_REVIEW)
						.build();

		assertThatThrownBy(() -> cards.saveAndFlush(근거없는_카드))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	private CareRecipient 어르신을_저장한다(String name, String code) {
		return careRecipients.save(CareRecipient.builder().name(name).code(code).build());
	}

	private Handover 인계를_저장한다(CareRecipient recipient, String rawText) {
		return handovers.save(
				Handover.builder()
						.careRecipient(recipient)
						.rawText(rawText)
						.inputMethod(InputMethod.TEXT)
						.occurredAt(LocalDateTime.of(2026, 8, 11, 13, 10))
						.reporterName("김요양")
						.proxyInput(false)
						.build());
	}

	private HandoverCard 검토_완료_카드를_저장한다() {
		CareRecipient recipient = 어르신을_저장한다("정귀남", "T-005");
		Handover handover = 인계를_저장한다(recipient, "오늘 걸음이 많이 불안하셨어요. 보호자께 알려 드려야 할 것 같아요.");
		return cards.save(
				HandoverCard.builder()
						.handover(handover)
						.careRecipient(recipient)
						.statusChange("보행 불안정")
						.nextAction("보호자에게 낙상 위험 안내")
						.evidenceText("오늘 걸음이 많이 불안하셨어요")
						.safetyRelated(true)
						.safetyFlagSource(SafetyFlagSource.STAFF)
						.reviewStatus(ReviewStatus.REVIEWED)
						.suggestedJobRole(JobRole.SOCIAL_WORKER)
						.suggestedDueTime(LocalTime.of(16, 0))
						.build());
	}

	private void 비우고_다시_읽는다() {
		em.flush();
		em.clear();
	}
}
