package com.ieobom.api.handovercard;

import com.ieobom.api.common.BaseTimeEntity;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.recipient.CareRecipient;
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
 * 인계 원문을 어르신별로 구조화한 카드.
 *
 * <p>모든 항목은 근거가 된 원문 구간을 함께 갖는다. 근거가 없으면 항목을 만들지 않으므로 {@code evidenceText} 는 필수다.
 *
 * <p>AI 가 만든 뒤에는 직원이 검토하고 고친다. 그 변경은 전부 이 클래스의 메서드를 거친다. 서비스가 필드를 직접 바꾸는 경로를 두면 "검토 완료
 * 카드에는 대상 어르신이 반드시 있다" 같은 규칙이 여러 군데로 흩어진다.
 */
@Getter
@Entity
@Table(name = "handover_card")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HandoverCard extends BaseTimeEntity {

	/** 직원이 화면에서 그대로 볼 문장이다. 왜 버튼이 눌리지 않는지 알 수 없으면 검토 단계에서 막힌 채로 끝난다. */
	private static final String EXPORT_BLOCKED_REASON = "검토 완료 후 생성할 수 있습니다.";

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "handover_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_handover_card_handover"))
	private Handover handover;

	/**
	 * 카드가 가리키는 어르신.
	 *
	 * <p>대상을 분리할 수 없는 원문은 확정 카드로 만들지 않고 사람에게 넘기므로, 이 값이 비고 검토 상태가 {@code NEEDS_REVIEW} 인
	 * 카드가 나올 수 있다.
	 */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(
			name = "care_recipient_id",
			foreignKey = @ForeignKey(name = "fk_handover_card_care_recipient"))
	private CareRecipient careRecipient;

	/** 카드가 가리키는 상황이 있었던 시각. 원문에서 뽑지 못하면 비워 둔다. */
	private LocalDateTime observedAt;

	/** 변화 — 어르신 상태가 어떻게 달라졌는지. */
	@Column(length = 500)
	private String statusChange;

	/** 조치 — 현장에서 이미 무엇을 했는지. */
	@Column(length = 500)
	private String actionTaken;

	/** 다음 행동 — 아직 남아 있는 후속 행동. 여기서 {@code Task} 가 만들어진다. */
	@Column(length = 500)
	private String nextAction;

	/** 근거 원문 문장. 필수다. 비면 항목 자체를 만들지 않는다. */
	@Column(nullable = false, length = 1000)
	private String evidenceText;

	/** 안전 관련 여부. 참이면 카드 상단에 우선 표시한다. */
	@Column(nullable = false)
	private boolean safetyRelated;

	/** 안전 관련으로 잡힌 경로. 안전 항목이 아니면 비어 있다. */
	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private SafetyFlagSource safetyFlagSource;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ReviewStatus reviewStatus;

	/** 다음 행동에 붙일 담당 직종 제안값. 판단 근거가 부족하면 비워 두고 직원이 지정한다. */
	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private JobRole suggestedJobRole;

	/** 다음 행동에 붙일 기한 제안값. 당일 시각만 쓴다. */
	private LocalTime suggestedDueTime;

	@Builder
	private HandoverCard(
			Handover handover,
			CareRecipient careRecipient,
			LocalDateTime observedAt,
			String statusChange,
			String actionTaken,
			String nextAction,
			String evidenceText,
			boolean safetyRelated,
			SafetyFlagSource safetyFlagSource,
			ReviewStatus reviewStatus,
			JobRole suggestedJobRole,
			LocalTime suggestedDueTime) {
		this.handover = handover;
		this.careRecipient = careRecipient;
		this.observedAt = observedAt;
		this.statusChange = statusChange;
		this.actionTaken = actionTaken;
		this.nextAction = nextAction;
		this.evidenceText = evidenceText;
		this.safetyRelated = safetyRelated;
		this.safetyFlagSource = safetyFlagSource;
		this.reviewStatus = reviewStatus;
		this.suggestedJobRole = suggestedJobRole;
		this.suggestedDueTime = suggestedDueTime;
	}

	/**
	 * 직원이 검토하며 고친 내용을 반영한다. (Manyfast F-SNBVHR action)
	 *
	 * <p><b>근거 원문과 관찰 시각은 여기서 바꾸지 않는다.</b> 근거는 원문에서 뽑아 원문과 대조해 통과시킨 값이다. 사람이 근거를 고칠 수 있으면
	 * {@link CardDraftVerifier} 의 대조가 의미를 잃고, "이 카드가 원문의 어디서 나왔는지"를 더 이상 말할 수 없게 된다. 원문이 잘못됐으면
	 * 카드가 아니라 원문을 다시 남기는 것이 맞다.
	 *
	 * @param careRecipient 직원이 지정한 어르신. 아직 가릴 수 없으면 {@code null} 이다
	 */
	public void edit(
			CareRecipient careRecipient,
			String statusChange,
			String actionTaken,
			String nextAction,
			JobRole suggestedJobRole,
			LocalTime suggestedDueTime) {
		this.careRecipient = careRecipient;
		this.statusChange = statusChange;
		this.actionTaken = actionTaken;
		this.nextAction = nextAction;
		this.suggestedJobRole = suggestedJobRole;
		this.suggestedDueTime = suggestedDueTime;
	}

	public void changeReviewStatus(ReviewStatus reviewStatus) {
		this.reviewStatus = reviewStatus;
	}

	/**
	 * 직원이 안전 관련 표시를 켜거나 끈다. (Manyfast F-SNBVHR rules)
	 *
	 * <p>켜면 판정 출처가 {@link SafetyFlagSource#STAFF} 로 바뀐다. 키워드로 이미 잡혀 있던 카드라도 마지막에 켠 사람이 직원이면 출처는
	 * 직원이다. 끄면 안전 항목이 아니게 되므로 출처를 비운다. 직원이 껐다는 사실은 이벤트 로그에 남는다.
	 */
	public void markSafety(boolean safetyRelated) {
		this.safetyRelated = safetyRelated;
		this.safetyFlagSource = safetyRelated ? SafetyFlagSource.STAFF : null;
	}

	/** 대상 어르신을 가린 카드인지. 아니면 검토 대상으로 남아 있는 카드다. */
	public boolean isRecipientResolved() {
		return careRecipient != null;
	}

	/**
	 * 이 카드로 출력 문구를 만들어도 되는지. (Manyfast F-GUSOFG preconditions)
	 *
	 * <p>판정을 카드 쪽에 두는 이유는 문구 생성 쪽에서 같은 조건을 다시 적지 않게 하기 위해서다. 조건이 두 군데에 있으면 한쪽만 고쳐진 채로
	 * 검토되지 않은 내용이 보호자에게 나가는 일이 생긴다.
	 *
	 * <p>"근거 원문이 연결된 검토 완료 카드"가 조건인데 근거는 저장 시점에 이미 보장되므로, 실제로 볼 것은 검토 상태 하나다. 어르신이 없는 카드는
	 * 애초에 검토 완료가 되지 못한다.
	 */
	public boolean canGenerateExport() {
		return reviewStatus == ReviewStatus.REVIEWED;
	}

	/** 문구를 만들 수 없는 이유. 만들 수 있으면 {@code null}. */
	public String exportBlockedReason() {
		return canGenerateExport() ? null : EXPORT_BLOCKED_REASON;
	}
}
