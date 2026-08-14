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

	/**
	 * 함께 저장한 원본 음성의 형식. 음성을 남기지 않았으면 비어 있다. (Manyfast F-SNBVHR — 요약이 담지 못한 뉘앙스는 원본 음성으로 받는다)
	 *
	 * <p>음성 <b>바이트는 여기 두지 않고</b> {@code HandoverAudio} 가 갖는다. 카드 목록 조회는 원문을 {@code join fetch}
	 * 로 함께 읽으므로(HandoverCardRepository), 바이트를 이 엔티티에 두면 카드를 한 장 볼 때마다 그날의 음성 전부가 메모리로 올라온다. 반대로
	 * "음성이 있는지"는 카드마다 그려야 하므로, 그 판단에 필요한 이 값만 원문 쪽에 남긴다.
	 *
	 * <p>브라우저마다 녹음 형식이 다르다(Chrome 은 {@code audio/webm;codecs=opus}). 재생할 때 그대로 돌려줘야 해서 형식을 고정하지
	 * 않고 저장한다.
	 */
	@Column(length = 100)
	private String audioMimeType;

	@Builder
	private Handover(
			CareRecipient careRecipient,
			String rawText,
			InputMethod inputMethod,
			LocalDateTime occurredAt,
			String reporterName,
			boolean proxyInput,
			InfoSource infoSource,
			String audioMimeType) {
		this.careRecipient = careRecipient;
		this.rawText = rawText;
		this.inputMethod = inputMethod;
		this.occurredAt = occurredAt;
		this.reporterName = reporterName;
		this.proxyInput = proxyInput;
		this.infoSource = infoSource;
		this.audioMimeType = audioMimeType;
	}

	/**
	 * 원본 음성이 함께 저장돼 있는지. 카드가 재생 버튼을 그릴지 정할 때 쓴다.
	 *
	 * <p>입력 방식이 {@code VOICE} 인 것과 같지 않다. 마이크 권한을 거부했거나 녹음을 지원하지 않는 브라우저에서도 인식된 텍스트는 {@code VOICE}
	 * 로 저장되므로, 방식으로 판단하면 들을 음성이 없는 카드에 재생 버튼이 붙는다.
	 */
	public boolean hasAudio() {
		return audioMimeType != null;
	}
}
