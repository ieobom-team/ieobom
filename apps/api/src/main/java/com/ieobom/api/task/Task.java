package com.ieobom.api.task;

import com.ieobom.api.common.BaseTimeEntity;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.handovercard.HandoverCard;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.time.LocalTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 카드의 다음 행동에서 나온 후속 업무.
 *
 * <p>어르신이 당일 귀가하므로 기한은 날짜가 아니라 당일 시각이고, 기본 상한은 당일 하원 시각이다. 하원까지 남은 업무는 다음 날로 자동
 * 승계하지 않고 하원 미처리 브리핑에서 사람이 닫는다.
 */
@Getter
@Entity
@Table(name = "task")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Task extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "handover_card_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_task_handover_card"))
	private HandoverCard handoverCard;

	/** 업무 내용. */
	@Column(nullable = false, length = 500)
	private String content;

	/** 담당 직종. 판단 근거가 부족하면 비워 두고 직원이 지정한다. */
	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private JobRole assigneeJobRole;

	/** 담당자 이름. 직종만 정하고 사람을 특정하지 않을 수 있다. */
	@Column(length = 50)
	private String assigneeName;

	/**
	 * 담당자의 사번. 알림을 <b>누구에게</b> 보낼지가 이 값으로 갈린다. (Manyfast F-JIEOJO action)
	 *
	 * <p>이름을 두고 사번을 따로 두는 이유는 <b>동명이인</b>이다. 알림 수신자는 직원 명단의 한 행이어야 하는데 이름으로 되짚으면 같은
	 * 이름이 둘일 때 누구에게 보낼지 정할 수 없고, 그때 조용히 안 보내면 배정 사실이 닿지 않는다. 담당 확정 API 가 이름이 아니라 사번을
	 * 받는 것과 같은 이유다.
	 *
	 * <p><b>직원 테이블 외래키가 아니라 문자열이다.</b> 담당자 이름을 문자열로 둔 결정을 뒤집지 않는다 — 이 제품에는 계정·권한 모델이
	 * 없고, 앱을 쓰지 않는 직종에 배정된 업무는 가리킬 직원 행 자체가 없다. 사번은 <b>알림을 보낼 수 있을 때만</b> 채워지는 보조
	 * 값이고, 비어 있어도 업무는 온전하다.
	 */
	@Column(length = 30)
	private String assigneeStaffCode;

	/**
	 * 담당이 정해진 시각. 담당자가 없으면 비어 있다. (Manyfast F-IVFNPC dataSpec)
	 *
	 * <p>생성 시각과 따로 두는 이유는 두 값이 갈릴 수 있기 때문이다. 직종에만 배정된 업무는 만들어진 뒤 한참 지나 누군가 맡는다.
	 */
	private LocalDateTime claimedAt;

	/** 담당 확정 방식. 담당자가 있을 때만 값을 가진다. (Manyfast F-IVFNPC dataSpec) */
	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private ClaimMethod claimMethod;

	/** 기한. 날짜 단위나 익일 기한을 쓰지 않으므로 당일 시각만 담는다. */
	@Column(nullable = false)
	private LocalTime dueTime;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private TaskStatus status;

	private LocalDateTime completedAt;

	/**
	 * 완료를 기록한 사람.
	 *
	 * <p>담당자와 달라도 된다. 현장에서 확인한 사람이 대신 눌러도 루프가 닫혀야 전원이 앱을 설치하지 않고도 동작한다.
	 */
	@Column(length = 50)
	private String completedByName;

	@Builder
	private Task(
			HandoverCard handoverCard,
			String content,
			JobRole assigneeJobRole,
			String assigneeName,
			String assigneeStaffCode,
			LocalDateTime claimedAt,
			ClaimMethod claimMethod,
			LocalTime dueTime,
			TaskStatus status,
			LocalDateTime completedAt,
			String completedByName) {
		this.handoverCard = handoverCard;
		this.content = content;
		this.assigneeJobRole = assigneeJobRole;
		this.assigneeName = assigneeName;
		this.assigneeStaffCode = assigneeStaffCode;
		this.claimedAt = claimedAt;
		this.claimMethod = claimMethod;
		this.dueTime = dueTime;
		this.status = status;
		this.completedAt = completedAt;
		this.completedByName = completedByName;
	}

	/**
	 * 새 후속 업무. 언제나 미처리로 시작한다. (Manyfast F-IVFNPC action)
	 *
	 * <p>생성 시점에 상태를 고를 자리를 두지 않는다. 만들자마자 완료인 업무는 이 흐름에 없고, 그 자리를 열어 두면 "확인하지 않고 닫힌 업무"가 만들어질
	 * 수 있다.
	 */
	public static Task pending(
			HandoverCard handoverCard,
			String content,
			JobRole assigneeJobRole,
			String assigneeName,
			String assigneeStaffCode,
			LocalTime dueTime) {

		boolean assigned = assigneeName != null;
		return Task.builder()
				.handoverCard(handoverCard)
				.content(content)
				.assigneeJobRole(assigneeJobRole)
				.assigneeName(assigneeName)
				.assigneeStaffCode(assigned ? assigneeStaffCode : null)
				.claimedAt(assigned ? LocalDateTime.now() : null)
				.claimMethod(assigned ? ClaimMethod.DIRECT_ASSIGN : null)
				.dueTime(dueTime)
				.status(TaskStatus.PENDING)
				.build();
	}

	public boolean isDone() {
		return status == TaskStatus.DONE;
	}

	/**
	 * 담당이 사람 단위로 정해졌는지. (Manyfast F-IVFNPC display)
	 *
	 * <p>직접 배정과 직종에서 맡기를 가리지 않는다. 하원 브리핑이 묻는 것은 "누가 맡았는가"가 아니라 <b>"맡은 사람이 있는가"</b>이고, 그 답은
	 * 담당자 이름 하나로 난다.
	 */
	public boolean isClaimed() {
		return assigneeName != null;
	}

	/**
	 * 지금 맡을 수 있는 업무인지. (Manyfast F-IVFNPC display — "'내가 처리할게요'를 표시한다")
	 *
	 * <p>화면이 버튼을 그릴지 말지를 이 값으로 정한다. <b>이 판정으로 담당 확정을 허용하지는 않는다.</b> 화면이 값을 받은 뒤 누르기까지 사이에
	 * 다른 직원이 맡을 수 있어서, 실제로 막는 것은 조건부 UPDATE 다. ({@code TaskRepository#claimIfUnclaimed})
	 */
	public boolean isClaimable() {
		return !isDone() && !isClaimed();
	}

	/**
	 * 완료로 닫는다. (Manyfast F-IVFNPC action · outcome)
	 *
	 * <p><b>이미 완료된 업무에는 부르지 않는다.</b> 완료 확인자와 완료 시각은 "누가 언제 확인했는가"를 말하는 값이라, 두 번째 호출이 덮어쓰면 실제로
	 * 확인한 사람의 기록이 나중에 버튼을 누른 사람으로 바뀐다. 중복 완료를 걸러내는 것은 {@code TaskService} 다.
	 *
	 * @param completedByName 완료를 확인한 사람. 담당자와 달라도 된다 (대리 완료)
	 */
	public void complete(String completedByName) {
		this.status = TaskStatus.DONE;
		this.completedAt = LocalDateTime.now();
		this.completedByName = completedByName;
	}

	/**
	 * 대리 완료인지. (Manyfast F-IVFNPC display)
	 *
	 * <p>담당자 이름이 있을 때만 판정할 수 있다. 직종만 배정된 업무는 누가 맡았는지 사람 단위로 정해진 적이 없으므로, 확인자가 담당자와 다른지를 말할 수
	 * 없다. 그때는 거짓이다 — "대리 완료가 아니다"가 아니라 "대리라고 말할 근거가 없다"에 가깝고, 화면은 확인자 이름을 그대로 보여 주면 된다.
	 */
	public boolean isDelegated() {
		return isDone() && assigneeName != null && !assigneeName.equals(completedByName);
	}

	/**
	 * 담당자를 변경한다. (Manyfast F-IVFNPC permissions — "사회복지사와 센터장은 이미 담당이 확정된 업무의 담당자를 바꿀 수 있다")
	 *
	 * @param assigneeJobRole 변경할 담당 직종
	 * @param assigneeName 변경할 담당자 이름
	 * @param assigneeStaffCode 변경할 담당자 사번
	 */
	public void reassign(JobRole assigneeJobRole, String assigneeName, String assigneeStaffCode) {
		boolean assigned = assigneeName != null;
		this.assigneeJobRole = assigneeJobRole;
		this.assigneeName = assigneeName;
		this.assigneeStaffCode = assigned ? assigneeStaffCode : null;
		this.claimedAt = assigned ? LocalDateTime.now() : null;
		this.claimMethod = assigned ? ClaimMethod.DIRECT_ASSIGN : null;
	}
}
