package com.ieobom.api.export;

import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.export.file.ExportFile;
import com.ieobom.api.export.file.ExportFileFormat;
import com.ieobom.api.export.file.ExportFileName;
import com.ieobom.api.export.file.ExportSheet;
import com.ieobom.api.export.file.SheetExportRenderer;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import com.ieobom.api.task.Task;
import com.ieobom.api.task.TaskRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 어르신 한 명의 그날 인계 항목을 표로 만든다. (Manyfast F-GUSOFG action)
 *
 * <p><b>문구가 아니라 카드와 후속 업무를 읽는다.</b> 표의 열 가운데 시각·상태 변화·조치는 {@link HandoverCard} 의 값이고 담당·기한·처리
 * 상태는 {@link Task} 의 값이다. 문구 하나에서 나오지 않으므로 {@link ExportFileService} 와 단위가 갈린다.
 *
 * <p><b>담을 카드를 고르는 기준은 묶음과 같다.</b> 그날 만들어진 검토 완료 카드다. 같은 화면에서 내려받는 두 파일이 서로 다른 카드를 담으면, 파일만 받은
 * 사람은 어느 쪽이 그날의 전부인지 알 수 없다.
 *
 * <p><b>파일을 저장하지 않는다.</b> 내려받은 형식과 시점만 로그로 남긴다. (Manyfast F-GUSOFG dataSpec)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportSheetService {

	static final String SHEET_EMPTY = "EXPORT_SHEET_EMPTY";

	/** 파일 이름에 들어갈 짧은 이름. 문구가 아니라 표라는 것이 이름에서 갈린다. */
	private static final String FILE_LABEL = "인계표";

	/**
	 * 배정되지 않은 담당.
	 *
	 * <p>카드에는 담당 직종 제안값({@code suggestedJobRole})이 있지만 <b>쓰지 않는다.</b> AI 가 제안했을 뿐 사람이 배정한 적이 없는
	 * 값이고, 표의 담당 칸에 적히는 순간 배정된 것으로 읽힌다. 비어 있다는 사실 자체가 "아직 아무도 맡지 않았다"는 정보다.
	 */
	private static final String UNASSIGNED = "미배정";

	/** 뽑지 못한 값과 존재하지 않는 값은 빈 칸이다. 없는 것을 있는 것처럼 채우지 않는다. */
	private static final String BLANK = "";

	private static final DateTimeFormatter HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm");

	/**
	 * 안전 관련 항목을 먼저 두고, 그다음 관찰 시각 순. ({@code ExportBundleService} 와 같은 규칙)
	 *
	 * <p>관찰 시각은 원문에서 뽑지 못하면 비어 있으므로 뒤로 보내고, 같은 시각이면 카드가 만들어진 순서를 따른다.
	 */
	private static final Comparator<HandoverCard> SAFETY_FIRST_THEN_OBSERVED =
			Comparator.comparing(HandoverCard::isSafetyRelated)
					.reversed()
					.thenComparing(
							HandoverCard::getObservedAt, Comparator.nullsLast(Comparator.naturalOrder()))
					.thenComparing(HandoverCard::getId);

	private final CareRecipientRepository careRecipientRepository;
	private final HandoverCardRepository cardRepository;
	private final TaskRepository taskRepository;
	private final SheetExportRenderer renderer;

	/**
	 * 어르신 한 명의 당일 표를 만든다.
	 *
	 * @throws NotFoundException 어르신이 목록에 없을 때
	 * @throws ConflictException 그날 담을 항목이 없을 때
	 */
	@Transactional(readOnly = true)
	public ExportFile ofRecipient(Long careRecipientId, LocalDate date) {
		CareRecipient recipient =
				careRecipientRepository
						.findById(careRecipientId)
						.orElseThrow(
								() ->
										new NotFoundException(
												ExportBundleService.CARE_RECIPIENT_NOT_FOUND,
												"대상 어르신을 찾을 수 없습니다. 목록에서 다시 선택해 주세요."));

		List<HandoverCard> cards =
				cardRepository
						.findReviewedByRecipientAndCreatedBetween(
								careRecipientId, date.atStartOfDay(), date.plusDays(1).atStartOfDay())
						.stream()
						.sorted(SAFETY_FIRST_THEN_OBSERVED)
						.toList();

		if (cards.isEmpty()) {
			throw new ConflictException(SHEET_EMPTY, "내려받을 인계 항목이 없습니다. 카드를 검토 완료로 올린 뒤 다시 확인해 주세요.");
		}

		Map<Long, Task> tasksByCard = tasksOf(cards);

		ExportSheet sheet =
				new ExportSheet(
						recipient.getName(),
						date,
						cards.stream()
								.map(card -> row(recipient, card, tasksByCard.get(card.getId())))
								.toList());

		// 내려받은 형식과 시점, 몇 줄이었는지만 남긴다. 표의 내용은 남기지 않는다.
		log.info(
				"파일 내려받기 — 단위=어르신표, careRecipientId={}, date={}, 형식={}, 항목={}개, 업무연결={}개",
				recipient.getId(),
				date,
				ExportFileFormat.XLSX,
				cards.size(),
				tasksByCard.size());

		return new ExportFile(
				ExportFileName.of(FILE_LABEL, recipient.getName(), date, ExportFileFormat.XLSX),
				ExportFileFormat.XLSX.contentType(),
				renderer.render(sheet));
	}

	/**
	 * 카드마다 붙은 업무. 카드 한 장에서 업무는 두 번 만들어지지 않으므로({@code
	 * TaskRepository#existsByHandoverCardId}) 카드당 하나다.
	 */
	private Map<Long, Task> tasksOf(List<HandoverCard> cards) {
		return taskRepository
				.findByCardIds(cards.stream().map(HandoverCard::getId).toList())
				.stream()
				.collect(
						Collectors.toMap(
								task -> task.getHandoverCard().getId(),
								Function.identity(),
								// 규칙상 오지 않는 두 번째 업무가 와도 먼저 만든 것을 남긴다.
								(first, second) -> first));
	}

	/** 후속 업무가 없는 항목은 담당만 {@code 미배정} 이고 기한·처리 상태는 빈 칸이다. 없는 업무에는 기한도 상태도 없다. */
	private ExportSheet.Row row(CareRecipient recipient, HandoverCard card, Task task) {
		return new ExportSheet.Row(
				recipient.getName(),
				card.getObservedAt() == null ? BLANK : card.getObservedAt().toLocalTime().format(HOUR_MINUTE),
				text(card.getStatusChange()),
				text(card.getActionTaken()),
				assigneeOf(task),
				task == null ? BLANK : dueTime(task.getDueTime()),
				task == null ? BLANK : task.getStatus().getLabel(),
				card.getEvidenceText());
	}

	/**
	 * 담당. 사람 이름이 있으면 이름, 직종만 정해졌으면 직종이다.
	 *
	 * <p>직종만 배정된 업무가 정상이다. ({@code Task#assigneeName} 은 선택) 그때 표에 아무것도 적지 않으면 배정되지 않은 항목과 구별되지
	 * 않는다.
	 */
	private String assigneeOf(Task task) {
		if (task == null) {
			return UNASSIGNED;
		}
		if (task.getAssigneeName() != null && !task.getAssigneeName().isBlank()) {
			return task.getAssigneeName();
		}
		return task.getAssigneeJobRole() == null ? UNASSIGNED : task.getAssigneeJobRole().getLabel();
	}

	private String dueTime(LocalTime due) {
		return due == null ? BLANK : due.format(HOUR_MINUTE);
	}

	private String text(String value) {
		return value == null ? BLANK : value;
	}
}
