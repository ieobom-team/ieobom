package com.ieobom.api.handover;

import com.ieobom.api.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 음성으로 남긴 인계 한 건의 원본 녹음.
 *
 * <p>원문({@code Handover})과 1:1 이지만 <b>테이블을 나눈다.</b> 카드 조회는 원문을 {@code join fetch} 로 함께 읽는데, 바이트를
 * 원문 테이블에 두면 카드를 볼 때마다 음성 전체가 딸려 온다. 재생 화면에서만 읽으면 되는 데이터라 따로 둔다.
 *
 * <p>데모 규모여서 파일 스토리지를 두지 않고 DB 에 그대로 넣는다. 상한은 {@code HandoverService.AUDIO_MAX_BYTES} 다.
 */
@Getter
@Entity
@Table(name = "handover_audio")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HandoverAudio extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "handover_id",
			nullable = false,
			unique = true,
			foreignKey = @ForeignKey(name = "fk_handover_audio_handover"))
	private Handover handover;

	@Lob
	@Column(nullable = false, columnDefinition = "MEDIUMBLOB")
	private byte[] data;

	private HandoverAudio(Handover handover, byte[] data) {
		this.handover = handover;
		this.data = data;
	}

	static HandoverAudio of(Handover handover, byte[] data) {
		return new HandoverAudio(handover, data);
	}
}
