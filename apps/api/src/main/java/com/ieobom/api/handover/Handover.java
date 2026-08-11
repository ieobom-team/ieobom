package com.ieobom.api.handover;

import com.ieobom.api.common.BaseTimeEntity;
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
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 현장에서 들어온 인계 원문. 음성·텍스트·체크로 남긴 발화 한 덩어리를 손대지 않고 그대로 보관한다.
 *
 * <p>구조화 결과는 여기 두지 않고 {@code HandoverCard} 가 갖는다. 한 원문이 여러 어르신 카드로 갈라질 수 있다.
 */
@Getter
@Entity
@Table(name = "handover")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Handover extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/**
	 * 입력 시 고른 대상 어르신. 필수다.
	 *
	 * <p>여러 어르신이 섞인 발화는 이 값을 바꾸지 않고 카드 쪽에서 각자의 어르신으로 갈라 붙인다.
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "care_recipient_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_handover_care_recipient"))
	private CareRecipient careRecipient;

	/** 입력 원문. 요약하거나 다듬지 않는다. */
	@Column(nullable = false, length = 2000)
	private String rawText;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private InputMethod inputMethod;

	/** 입력 시점. 특이사항이 있었던 때를 가리키며 저장 시각과 다를 수 있다. */
	@Column(nullable = false)
	private LocalDateTime occurredAt;

	/** 입력자 이름. 로그인이 없으므로 진입 시 고른 직원 식별을 그대로 남긴다. */
	@Column(nullable = false, length = 50)
	private String reporterName;

	/** 직접 관찰이 아니라 다른 사람에게 들은 내용을 대신 남겼는지 여부. */
	@Column(nullable = false)
	private boolean proxyInput;

	/** 대리 입력일 때의 정보 출처. 직접 입력이면 비어 있다. */
	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private InfoSource infoSource;

	@Builder
	private Handover(
			CareRecipient careRecipient,
			String rawText,
			InputMethod inputMethod,
			LocalDateTime occurredAt,
			String reporterName,
			boolean proxyInput,
			InfoSource infoSource) {
		this.careRecipient = careRecipient;
		this.rawText = rawText;
		this.inputMethod = inputMethod;
		this.occurredAt = occurredAt;
		this.reporterName = reporterName;
		this.proxyInput = proxyInput;
		this.infoSource = infoSource;
	}
}
