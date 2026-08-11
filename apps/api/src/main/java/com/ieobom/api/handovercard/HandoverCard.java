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
 */
@Getter
@Entity
@Table(name = "handover_card")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HandoverCard extends BaseTimeEntity {

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
}
