package com.ieobom.api.recipient;

import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.recipient.dto.CareRecipientCreateRequest;
import com.ieobom.api.recipient.dto.CareRecipientListResponse;
import com.ieobom.api.recipient.dto.CareRecipientRenameRequest;
import com.ieobom.api.recipient.dto.CareRecipientResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 어르신 명단을 관리한다. (Manyfast F-LUDCWW)
 *
 * <p>여기서 만드는 것은 <b>가명처리의 대조표</b>다. 등록되는 것은 어르신(데이터)이지 근무자(계정)가 아니므로, 로그인·계정·권한 모델을 만들지 않는다는
 * 원칙의 예외가 아니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CareRecipientService {

	static final String CARE_RECIPIENT_NOT_FOUND = "CARE_RECIPIENT_NOT_FOUND";
	static final String DUPLICATE_RECIPIENT_NAME = "DUPLICATE_RECIPIENT_NAME";

	/**
	 * 20명 남짓한 한 센터 기준이라 페이지를 나누지 않는다.
	 *
	 * <p>이름 가나다순이고 이름이 같으면 내부 ID 순이다. id 순이 아니다 — 목록에서 사람을 눈으로 찾는 화면이다.
	 */
	private static final Sort BY_NAME = Sort.by("name", "code");

	private final CareRecipientRepository careRecipientRepository;
	private final RecipientCodeIssuer recipientCodeIssuer;

	/**
	 * 명단을 조회한다.
	 *
	 * @param includeDischarged 이용 종료한 어르신까지 포함할지. 명단 화면은 {@code true}, 현장 입력 화면은 {@code false} 다
	 */
	@Transactional(readOnly = true)
	public CareRecipientListResponse findAll(boolean includeDischarged) {
		List<CareRecipient> found =
				includeDischarged
						? careRecipientRepository.findAll(BY_NAME)
						: careRecipientRepository.findByDischargedAtIsNull(BY_NAME);

		return new CareRecipientListResponse(found.stream().map(CareRecipientResponse::from).toList());
	}

	/**
	 * 어르신을 등록하고 내부 ID 를 부여한다. (유저플로우 "AI 인계 도구 내비게이션 맵" n51 → n52 → n53)
	 *
	 * <p>동명이인이 있어도 <b>저장을 막지 않는다.</b> 주간보호센터에서 같은 이름은 실제로 있고, 막으면 관리자가 "김말순2" 같은 가짜 이름을 만들어
	 * 넣게 된다. 대신 한 번 확인시키고, 두 사람은 서로 다른 내부 ID 로 구분한다.
	 *
	 * @throws ConflictException 동명이인이 있는데 아직 확인하지 않았을 때
	 */
	@Transactional
	public CareRecipientResponse register(CareRecipientCreateRequest request) {
		String name = request.trimmedName();
		if (!request.isDuplicateNameConfirmed()) {
			verifyNoDuplicateName(name);
		}

		CareRecipient saved =
				careRecipientRepository.save(
						CareRecipient.builder().name(name).code(recipientCodeIssuer.issue()).build());

		log.info(
				"어르신 명단 등록 — careRecipientId={}, code={}, duplicateNameConfirmed={}",
				saved.getId(),
				saved.getCode(),
				request.isDuplicateNameConfirmed());
		return CareRecipientResponse.from(saved);
	}

	/** 어르신 이름을 고친다. (유저플로우 "AI 인계 도구 내비게이션 맵" n54) */
	@Transactional
	public CareRecipientResponse rename(Long id, CareRecipientRenameRequest request) {
		CareRecipient careRecipient = findById(id);
		String before = careRecipient.getName();

		careRecipient.rename(request.trimmedName());

		log.info(
				"어르신 이름 수정 — careRecipientId={}, code={}, 이름 바뀜={}",
				careRecipient.getId(),
				careRecipient.getCode(),
				!before.equals(careRecipient.getName()));
		return CareRecipientResponse.from(careRecipient);
	}

	/**
	 * 이용 종료로 표시한다. (유저플로우 "AI 인계 도구 내비게이션 맵" n55)
	 *
	 * <p>지우지 않는다. 기존 인계 기록과 카드가 이 어르신을 가리키고 있어서, 지우면 이미 남긴 기록이 대상을 잃는다. 대신 새 입력의 대상 목록에서만
	 * 빠진다.
	 *
	 * <p>이미 종료한 어르신을 다시 눌러도 오류로 만들지 않고 현재 상태를 그대로 돌려준다. 되돌릴 방법이 없는 동작이라 두 번 눌렀다고 벌을 줄 이유가 없다.
	 */
	@Transactional
	public CareRecipientResponse discharge(Long id) {
		CareRecipient careRecipient = findById(id);
		boolean changed = careRecipient.discharge(LocalDateTime.now());

		log.info(
				"어르신 이용 종료 표시 — careRecipientId={}, code={}, 상태 바뀜={}, dischargedAt={}",
				careRecipient.getId(),
				careRecipient.getCode(),
				changed,
				careRecipient.getDischargedAt());
		return CareRecipientResponse.from(careRecipient);
	}

	/** 이용 종료한 어르신도 이름을 차지한다. 종료 여부와 무관하게 같은 이름이면 확인시킨다. */
	private void verifyNoDuplicateName(String name) {
		List<CareRecipient> sameName = careRecipientRepository.findByName(name);
		if (sameName.isEmpty()) {
			return;
		}

		String codes = sameName.stream().map(CareRecipient::getCode).collect(Collectors.joining(", "));
		throw new ConflictException(
				DUPLICATE_RECIPIENT_NAME,
				"%s(%s)이(가) 이미 등록되어 있습니다. 다른 분이 맞으면 확인 후 등록해 주세요.".formatted(name, codes));
	}

	private CareRecipient findById(Long id) {
		return careRecipientRepository
				.findById(id)
				.orElseThrow(
						() ->
								new NotFoundException(
										CARE_RECIPIENT_NOT_FOUND, "대상 어르신을 찾을 수 없습니다. 목록에서 다시 선택해 주세요."));
	}
}
