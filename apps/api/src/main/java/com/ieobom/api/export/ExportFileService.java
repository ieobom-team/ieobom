package com.ieobom.api.export;

import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.export.dto.ExportBundleListResponse;
import com.ieobom.api.export.dto.ExportBundleResponse;
import com.ieobom.api.export.file.ExportDocument;
import com.ieobom.api.export.file.ExportFile;
import com.ieobom.api.export.file.ExportFileFormat;
import com.ieobom.api.export.file.ExportFileName;
import com.ieobom.api.export.file.ExportFileRenderer;
import com.ieobom.api.handovercard.HandoverCard;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이미 만들어 둔 문구를 파일로 다시 그린다. (Manyfast F-GUSOFG action)
 *
 * <p><b>모델을 부르지 않는다.</b> 여기서 하는 일은 같은 구조화 결과의 다른 렌더링이고, 파일이 늘어도 담기는 사실은 늘지 않는다. 다시 다듬으면 근거 연결이
 * 흐트러지고 호출 비용만 는다.
 *
 * <p><b>파일을 저장하지 않는다.</b> 내려받은 형식과 시점만 로그로 남긴다. (Manyfast F-GUSOFG dataSpec) 복사({@code
 * copied_at})는 건드리지 않는다 — 내려받기는 복사가 아니고, 파일을 받아 두고 붙여넣지 않을 수도 있다.
 */
@Slf4j
@Service
public class ExportFileService {

	/** 어르신을 가리지 못한 카드에는 문구가 만들어지지 않으므로 실제로는 쓰이지 않는다. 널로 파일 이름과 제목이 갈리지 않게만 둔다. */
	private static final String UNKNOWN_RECIPIENT = "미지정";

	private final ExportPhraseRepository phraseRepository;
	private final ExportBundleService bundleService;
	private final Map<ExportFileFormat, ExportFileRenderer> renderers;

	public ExportFileService(
			ExportPhraseRepository phraseRepository,
			ExportBundleService bundleService,
			List<ExportFileRenderer> renderers) {

		this.phraseRepository = phraseRepository;
		this.bundleService = bundleService;
		this.renderers =
				renderers.stream()
						.collect(
								Collectors.toMap(
										ExportFileRenderer::format,
										Function.identity(),
										(first, second) -> first,
										() -> new EnumMap<>(ExportFileFormat.class)));
	}

	/**
	 * 카드 한 장의 문구 하나를 파일로 만든다.
	 *
	 * <p>내려받는 글자는 <b>화면에서 복사되는 것과 같다.</b> 직원이 고친 문구가 있으면 그것이다. 저장하지 않은 편집은 서버가 알 수 없으므로 화면이
	 * 복사와 똑같이 막는다.
	 *
	 * @throws NotFoundException 문구가 없을 때
	 * @throws ConflictException 내려받을 문구가 아직 없을 때
	 */
	@Transactional(readOnly = true)
	public ExportFile ofPhrase(Long phraseId, ExportFileFormat format) {
		ExportPhrase phrase =
				phraseRepository
						.findWithCard(phraseId)
						.orElseThrow(
								() ->
										new NotFoundException(ExportPhraseService.PHRASE_NOT_FOUND, "문구를 찾을 수 없습니다."));

		if (!phrase.isCopyable()) {
			throw new ConflictException(
					ExportPhraseService.PHRASE_EMPTY, "내려받을 문구가 없습니다. 문구를 직접 작성한 뒤 내려받아 주세요.");
		}

		HandoverCard card = phrase.getHandoverCard();
		LocalDate date = card.getCreatedAt().toLocalDate();
		String recipientName = recipientNameOf(card);

		ExportDocument document =
				new ExportDocument(
						phrase.getPhraseType().label(),
						recipientName,
						date,
						phrase.text(),
						// 저장된 안내가 전부가 아니다. 문구를 만든 뒤 카드가 바뀌었는지는 읽는 지금에만 알 수 있다.
						ExportPhraseVerifier.reviewNoticeOf(phrase, card),
						List.of(new ExportDocument.Evidence(phrase.text(), card.getEvidenceText())));

		log.info(
				"파일 내려받기 — 단위=카드문구, phraseId={}, cardId={}, 유형={}, 형식={}, 문구=1개, 검토안내={}",
				phrase.getId(),
				card.getId(),
				phrase.getPhraseType(),
				format,
				document.notice() != null);

		return render(document, phrase.getPhraseType().fileLabel(), recipientName, date, format);
	}

	/**
	 * 어르신 한 명의 당일 묶음을 파일로 만든다.
	 *
	 * <p>무엇이 들어가고 어떤 순서로 붙는지는 {@link ExportBundleService} 가 정한다. 화면이 보여 준 묶음과 내려받은 파일이 갈리면 안 되므로
	 * 여기서 다시 고르지 않는다.
	 *
	 * @throws NotFoundException 어르신이 목록에 없을 때
	 * @throws ConflictException 묶음에 담을 문구가 없을 때
	 */
	@Transactional(readOnly = true)
	public ExportFile ofBundle(
			Long careRecipientId, ExportPhraseType phraseType, LocalDate date, ExportFileFormat format) {

		ExportBundleListResponse bundles =
				bundleService.findByRecipientAndDate(careRecipientId, date);

		ExportBundleResponse bundle =
				bundles.bundles().stream()
						.filter(candidate -> candidate.phraseType() == phraseType)
						.findFirst()
						.orElseThrow(
								() ->
										new IllegalStateException(
												"묶음은 언제나 유형별로 하나씩 있다: %s".formatted(phraseType)));

		if (bundle.empty()) {
			throw new ConflictException(
					ExportBundleService.BUNDLE_EMPTY, "내려받을 문구가 없습니다. 카드를 검토 완료로 올린 뒤 다시 확인해 주세요.");
		}

		ExportDocument document =
				new ExportDocument(
						"%s 묶음".formatted(phraseType.label()),
						bundles.careRecipientName(),
						date,
						bundle.text(),
						bundle.notice(),
						bundle.phrases().stream()
								.map(phrase -> new ExportDocument.Evidence(phrase.text(), phrase.evidenceText()))
								.toList());

		log.info(
				"파일 내려받기 — 단위=어르신묶음, careRecipientId={}, date={}, 유형={}, 형식={}, 문구={}개, 검토안내={}",
				careRecipientId,
				date,
				phraseType,
				format,
				bundle.phraseCount(),
				bundle.needsReview());

		return render(document, phraseType.fileLabel(), bundles.careRecipientName(), date, format);
	}

	private ExportFile render(
			ExportDocument document,
			String fileLabel,
			String recipientName,
			LocalDate date,
			ExportFileFormat format) {

		ExportFileRenderer renderer = renderers.get(format);
		if (renderer == null) {
			// 형식은 요청을 읽는 자리에서 이미 걸러진다. 여기까지 왔다면 렌더러 등록을 빠뜨린 것이다.
			throw new IllegalStateException("등록된 렌더러가 없는 형식입니다: %s".formatted(format));
		}

		return new ExportFile(
				ExportFileName.of(fileLabel, recipientName, date, format),
				format.contentType(),
				renderer.render(document));
	}

	/**
	 * 문구가 있는 카드에는 언제나 어르신이 있다. ({@code docs/contracts/export-api.md})
	 *
	 * <p>그래도 이름을 꺼내는 자리에서 널을 막아 둔다. 여기서 터지면 직원은 파일이 받아지지 않는 이유를 알 수 없다.
	 */
	private String recipientNameOf(HandoverCard card) {
		return card.getCareRecipient() == null ? UNKNOWN_RECIPIENT : card.getCareRecipient().getName();
	}
}
