package com.ieobom.api.staff;

import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.staff.dto.StaffResponse;
import com.ieobom.api.staff.dto.VerifyPinResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 직원 PIN 해시 관리 및 검증 서비스.
 *
 * <p>Manyfast R-LIEATL / F-YJJJUX (선택형 PIN, 5회 연속 실패 시 1분간 잠금, 관리자 1-Click 초기화).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StaffService {

	private static final int MAX_FAILED_ATTEMPTS = 5;
	private static final Duration LOCK_DURATION = Duration.ofMinutes(1);

	private final StaffRepository staffRepository;
	private final StaffPinHasher staffPinHasher;
	private final Clock clock = Clock.systemDefaultZone();

	/** 사번별 PIN 실패 횟수 및 잠금 상태 메모리 관리. */
	private final Map<String, AttemptInfo> attemptMap = new ConcurrentHashMap<>();

	private record AttemptInfo(int failedCount, Instant lockedUntil) {
		boolean isLocked(Instant now) {
			return lockedUntil != null && now.isBefore(lockedUntil);
		}
	}

	/**
	 * 사번으로 직원의 PIN 일치 여부를 검증한다.
	 *
	 * <p>5회 연속 실패 시 1분간 검증이 잠긴다. (Manyfast F-YJJJUX exceptions)
	 *
	 * @param code 직원 사번
	 * @param rawPin 평문 4~6자리 PIN
	 * @return 검증 결과 (valid, locked, remainingAttempts)
	 */
	@Transactional(readOnly = true)
	public VerifyPinResponse verifyPin(String code, String rawPin) {
		Staff staff = getStaffOrThrow(code);
		Instant now = clock.instant();

		if (!staff.hasPin()) {
			throw new RequestValidationException("pin", "PIN이 설정되지 않은 직원입니다.");
		}

		AttemptInfo currentAttempt = attemptMap.get(code);
		if (currentAttempt != null && currentAttempt.isLocked(now)) {
			log.warn("직원 [{}] PIN 검증 시도 거부 — 1분간 입력 잠금 상태", code);
			return VerifyPinResponse.ofLocked();
		}

		boolean matches = staffPinHasher.matches(rawPin, staff.getPinHash());
		if (matches) {
			attemptMap.remove(code);
			log.info("직원 [{}] PIN 검증 성공", code);
			return VerifyPinResponse.ofSuccess();
		}

		// 불일치 시 실패 횟수 증가
		int failedCount = (currentAttempt != null ? currentAttempt.failedCount() : 0) + 1;
		if (failedCount >= MAX_FAILED_ATTEMPTS) {
			Instant lockedUntil = now.plus(LOCK_DURATION);
			attemptMap.put(code, new AttemptInfo(failedCount, lockedUntil));
			log.warn("직원 [{}] PIN 5회 연속 실패 — 1분간 잠금 처리 (lockedUntil: {})", code, lockedUntil);
			return VerifyPinResponse.ofLocked();
		} else {
			attemptMap.put(code, new AttemptInfo(failedCount, null));
			int remaining = MAX_FAILED_ATTEMPTS - failedCount;
			log.info("직원 [{}] PIN 불일치 — 실패 횟수: {}/5, 잔여: {}", code, failedCount, remaining);
			return VerifyPinResponse.ofFailure(remaining);
		}
	}

	/**
	 * 직원의 PIN 을 신규 등록, 변경 또는 해제한다.
	 *
	 * <p>기존에 PIN 이 있는 경우 현재 PIN 검증 후 변경/해제한다.
	 *
	 * @param code 직원 사번
	 * @param currentPin 현재 PIN (기존 PIN 이 있는 경우 필수)
	 * @param newPin 새 4~6자리 PIN (null 또는 빈 문자열 시 PIN 해제)
	 * @return 갱신된 직원 정보
	 */
	@Transactional
	public StaffResponse updatePin(String code, String currentPin, String newPin) {
		Staff staff = getStaffOrThrow(code);

		if (staff.hasPin()) {
			if (currentPin == null || currentPin.isBlank()) {
				throw new RequestValidationException("currentPin", "기존 PIN을 입력해 주세요.");
			}
			if (!staffPinHasher.matches(currentPin, staff.getPinHash())) {
				throw new RequestValidationException("currentPin", "현재 PIN이 일치하지 않습니다.");
			}
		}

		if (newPin == null || newPin.isBlank()) {
			staff.clearPin();
			log.info("직원 [{}] PIN 해제 완료", code);
		} else {
			staff.updatePinHash(staffPinHasher.encode(newPin));
			log.info("직원 [{}] PIN 설정/변경 완료", code);
		}

		attemptMap.remove(code);
		return StaffResponse.from(staff);
	}

	/**
	 * 관리자가 해당 직원의 PIN 을 즉시 해제(초기화)한다.
	 *
	 * <p>Manyfast F-YJJJUX exceptions ("직원이 PIN을 분실한 경우 관리자/사회복지사가 관리 화면에서 해당 직원의 PIN을 초기화할 수 있다").
	 *
	 * @param code 직원 사번
	 * @return 갱신된 직원 정보
	 */
	@Transactional
	public StaffResponse resetPin(String code) {
		Staff staff = getStaffOrThrow(code);
		staff.clearPin();
		attemptMap.remove(code);
		log.info("직원 [{}] 관리자 1-Click PIN 초기화 완료", code);
		return StaffResponse.from(staff);
	}

	/** 테스트용: 실패 시도 및 잠금 상태 초기화. */
	void clearAttempts(String code) {
		attemptMap.remove(code);
	}

	private Staff getStaffOrThrow(String code) {
		return staffRepository
				.findByCode(code)
				.orElseThrow(() -> new NotFoundException("STAFF_NOT_FOUND", "직원을 찾을 수 없습니다: " + code));
	}
}
