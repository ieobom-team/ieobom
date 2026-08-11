package com.ieobom.api.export;

import com.ieobom.api.common.BaseTimeEntity;
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
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 검토 완료 카드에서 만든 출력 문구 하나. (Manyfast F-GUSOFG dataSpec)
 *
 * <p>카드 한 장이 문구 두 개를 갖는다. 유형별로 하나씩이므로 {@code (카드, 유형)} 에 유일 제약을 건다.
 *
 * <p><b>AI 가 만든 문구와 직원이 고친 문구를 따로 둔다.</b> 한 칸에 덮어쓰면 직원이 무엇을 고쳤는지, 원래 AI 가 뭐라고 했는지 더 이상 말할 수 없다.
 * 화면에 나가는 값은 고친 것이 있으면 그것이고, 없으면 AI 가 만든 것이다.
 */
@Getter
@Entity
@Table(
		name = "export_phrase",
		uniqueConstraints =
				@UniqueConstraint(
						name = "uk_export_phrase_card_type",
						columnNames = {"handover_card_id", "phrase_type"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExportPhrase extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/**
	 * 이 문구를 만든 카드.
	 *
	 * <p>문구에서 원본 인계 정보로 돌아가는 유일한 길이다. (Manyfast R-TUBGKD 수락기준) 카드가 근거 원문과 인계 원문을 들고 있으므로, 여기에 근거를
	 * 다시 복사해 두지 않는다. 복사해 두면 카드를 고쳤을 때 두 값이 조용히 갈라진다.
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "handover_card_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_export_phrase_handover_card"))
	private HandoverCard handoverCard;

	@Enumerated(EnumType.STRING)
	@Column(name = "phrase_type", nullable = false, length = 20)
	private ExportPhraseType phraseType;

	/** AI 가 만든 문구. 담을 내용이 없어 만들어지지 못했으면 비어 있다. */
	@Column(length = 1000)
	private String generatedText;

	/** 직원이 고친 문구. 고친 적이 없으면 비어 있다. */
	@Column(length = 1000)
	private String editedText;

	/**
	 * 복사 전에 검토가 필요한 이유. 없으면 비어 있다. (Manyfast F-GUSOFG exceptions)
	 *
	 * <p>생성 실패를 오류로 처리하지 않고 카드에 붙여 두는 이유는, 직원이 문구를 직접 써서 복사하는 길이 여전히 열려 있어야 하기 때문이다.
	 */
	@Column(length = 200)
	private String reviewNotice;

	/** 직원이 복사한 시점. 복사한 적이 없으면 비어 있다. (Manyfast F-GUSOFG outcome) */
	private LocalDateTime copiedAt;

	/**
	 * 이 문구를 카드와 대조한 시점. 그 뒤에 카드가 바뀌었으면 문구는 더 이상 그 카드를 말하고 있지 않다.
	 *
	 * <p><b>{@code updatedAt} 을 쓰지 않는 이유가 있다.</b> {@link #markCopied()} 도 {@code updatedAt} 을
	 * 올리므로, 그것을 기준으로 삼으면 직원이 복사하는 순간 "카드가 바뀌었다"는 안내가 조용히 사라진다. 여기는 문구 본문을 쓸 때만 움직인다.
	 *
	 * <p>옛 행에는 이 값이 없을 수 있어 {@code nullable} 이다. {@code ddl-auto: update} 로 굴러가는 로컬 DB 에 값이 있는
	 * 행을 두고 {@code NOT NULL} 컬럼을 밀어 넣으면 기동부터 깨진다. 비어 있으면 만든 시점을 기준으로 본다.
	 */
	private LocalDateTime verifiedAt;

	@Builder
	private ExportPhrase(
			HandoverCard handoverCard,
			ExportPhraseType phraseType,
			String generatedText,
			String reviewNotice) {
		this.handoverCard = handoverCard;
		this.phraseType = phraseType;
		this.generatedText = generatedText;
		this.reviewNotice = reviewNotice;
		this.verifiedAt = LocalDateTime.now();
	}

	/** 지금 화면에 나가고 복사될 문구. 고친 것이 있으면 그것이다. */
	public String text() {
		return editedText == null ? generatedText : editedText;
	}

	public boolean isEdited() {
		return editedText != null;
	}

	/**
	 * <b>저장된 안내가 있는지만 본다.</b> 카드가 그 뒤에 바뀌었는지는 여기서 알 수 없다.
	 *
	 * <p>응답에 나가는 값은 이것이 아니라 {@link ExportPhraseVerifier#reviewNoticeOf} 가 만든 것이다. 카드와 어긋났는지는
	 * 저장할 수 없고 읽는 시점에만 말할 수 있기 때문이다.
	 */
	public boolean needsReview() {
		return reviewNotice != null;
	}

	/**
	 * 이 문구를 만들거나 고친 뒤에 카드가 바뀌었는지.
	 *
	 * <p>바뀌었다면 문구는 얼어붙은 옛 내용이고 근거({@code evidenceText})는 카드에서 실시간으로 오므로, 화면에서 둘이 어긋난다. 그 상태가
	 * "검토를 거친 것"처럼 보이면 안 된다. (Manyfast F-GUSOFG exceptions)
	 *
	 * <p>카드의 {@code updatedAt} 은 검토 상태 전환과 안전 표시로도 움직인다. 내용이 그대로인데 안내가 붙을 수 있다는 뜻이지만, <b>한 번 더
	 * 확인하는 값과 어긋난 문구가 보호자에게 나가는 값이 같지 않으므로</b> 넓은 쪽으로 둔다.
	 */
	public boolean isStaleAgainst(HandoverCard card) {
		LocalDateTime cardChangedAt = card.getUpdatedAt();
		LocalDateTime baseline = verifiedAt == null ? getCreatedAt() : verifiedAt;
		return cardChangedAt != null && baseline != null && cardChangedAt.isAfter(baseline);
	}

	/** 복사할 문구가 있는지. AI 가 아무것도 만들지 못했고 직원도 아직 쓰지 않았으면 없다. */
	public boolean isCopyable() {
		return text() != null;
	}

	/**
	 * 직원이 고친 문구를 반영한다. (Manyfast F-GUSOFG action)
	 *
	 * <p>{@code generatedText} 는 건드리지 않는다. AI 가 원래 무엇을 만들었는지가 남아 있어야 "직원 검토를 거쳤다"를 나중에 말할 수 있다.
	 * 검토 안내는 고친 문구를 다시 확인한 결과로 갱신된다. 직원이 고쳐서 해소됐으면 사라지고, 여전히 걸리면 남는다.
	 */
	public void edit(String editedText, String reviewNotice) {
		this.editedText = editedText;
		this.reviewNotice = reviewNotice;
		// 방금 카드와 다시 대조했다. 그전에 카드가 바뀌어 붙어 있던 안내는 여기서 해소된다.
		this.verifiedAt = LocalDateTime.now();
	}

	/** 직원이 복사했다. 유형과 시점이 기록으로 남는다. */
	public void markCopied() {
		this.copiedAt = LocalDateTime.now();
	}
}
