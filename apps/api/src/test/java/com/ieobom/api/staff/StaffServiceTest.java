package com.ieobom.api.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.staff.dto.StaffResponse;
import com.ieobom.api.staff.dto.VerifyPinResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class StaffServiceTest {

	@Autowired private StaffService staffService;
	@Autowired private StaffRepository staffRepository;
	@Autowired private StaffPinHasher staffPinHasher;

	private Staff testStaff;

	@BeforeEach
	void setUp() {
		testStaff =
				staffRepository.save(
						Staff.builder()
								.name("홍길동")
								.code("ST-999")
								.jobRole(JobRole.CAREGIVER)
								.pinHash(null)
								.build());
		staffService.clearAttempts("ST-999");
	}

	@Nested
	@DisplayName("PIN 검증 (verifyPin)")
	class VerifyPinTest {

		@Test
		@DisplayName("PIN이 설정되지 않은 직원은 검증 요청 시 예외가 발생한다")
		void pinNotSet() {
			assertThatThrownBy(() -> staffService.verifyPin("ST-999", "1234"))
					.isInstanceOf(RequestValidationException.class)
					.hasMessageContaining("PIN이 설정되지 않은");
		}

		@Test
		@DisplayName("존재하지 않는 사번으로 검증 요청 시 NotFoundException 발생")
		void staffNotFound() {
			assertThatThrownBy(() -> staffService.verifyPin("ST-UNKNOWN", "1234"))
					.isInstanceOf(NotFoundException.class);
		}

		@Test
		@DisplayName("올바른 PIN 입력 시 성공 응답을 반환한다")
		void correctPin() {
			staffService.updatePin("ST-999", null, "123456");

			VerifyPinResponse response = staffService.verifyPin("ST-999", "123456");

			assertThat(response.valid()).isTrue();
			assertThat(response.locked()).isFalse();
			assertThat(response.remainingAttempts()).isEqualTo(5);
		}

		@Test
		@DisplayName("틀린 PIN 입력 시 실패 카운트가 증가하고 잔여 횟수가 감소한다")
		void incorrectPin() {
			staffService.updatePin("ST-999", null, "1234");

			VerifyPinResponse res1 = staffService.verifyPin("ST-999", "0000");
			assertThat(res1.valid()).isFalse();
			assertThat(res1.locked()).isFalse();
			assertThat(res1.remainingAttempts()).isEqualTo(4);

			VerifyPinResponse res2 = staffService.verifyPin("ST-999", "0000");
			assertThat(res2.valid()).isFalse();
			assertThat(res2.remainingAttempts()).isEqualTo(3);
		}

		@Test
		@DisplayName("5회 연속 실패 시 1분간 잠금(locked=true)된다")
		void lockAfter5Failures() {
			staffService.updatePin("ST-999", null, "1234");

			for (int i = 0; i < 4; i++) {
				VerifyPinResponse res = staffService.verifyPin("ST-999", "0000");
				assertThat(res.locked()).isFalse();
			}

			// 5회째 실패
			VerifyPinResponse res5 = staffService.verifyPin("ST-999", "0000");
			assertThat(res5.valid()).isFalse();
			assertThat(res5.locked()).isTrue();
			assertThat(res5.remainingAttempts()).isEqualTo(0);

			// 6회째 시도: 올바른 PIN을 입력해도 잠금 상태이므로 거부됨
			VerifyPinResponse res6 = staffService.verifyPin("ST-999", "1234");
			assertThat(res6.locked()).isTrue();
		}
	}

	@Nested
	@DisplayName("PIN 등록 / 변경 / 해제 (updatePin)")
	class UpdatePinTest {

		@Test
		@DisplayName("PIN이 없던 직원은 이전 PIN 없이 신규 등록할 수 있다")
		void registerNewPin() {
			StaffResponse response = staffService.updatePin("ST-999", null, "5678");

			assertThat(response.hasPin()).isTrue();

			Staff updated = staffRepository.findByCode("ST-999").orElseThrow();
			assertThat(staffPinHasher.matches("5678", updated.getPinHash())).isTrue();
		}

		@Test
		@DisplayName("기존 PIN이 있는 직원은 이전 PIN이 일치해야 변경할 수 있다")
		void changePinWithVerification() {
			staffService.updatePin("ST-999", null, "1111");

			// 이전 PIN 불일치 시 실패
			assertThatThrownBy(() -> staffService.updatePin("ST-999", "9999", "2222"))
					.isInstanceOf(RequestValidationException.class)
					.hasMessageContaining("현재 PIN이 일치하지 않습니다");

			// 이전 PIN 일치 시 성공
			StaffResponse response = staffService.updatePin("ST-999", "1111", "2222");
			assertThat(response.hasPin()).isTrue();

			Staff updated = staffRepository.findByCode("ST-999").orElseThrow();
			assertThat(staffPinHasher.matches("2222", updated.getPinHash())).isTrue();
		}

		@Test
		@DisplayName("새 PIN에 빈 문자열 또는 null 전달 시 PIN이 해제된다")
		void clearPin() {
			staffService.updatePin("ST-999", null, "1111");

			StaffResponse response = staffService.updatePin("ST-999", "1111", "");
			assertThat(response.hasPin()).isFalse();

			Staff updated = staffRepository.findByCode("ST-999").orElseThrow();
			assertThat(updated.hasPin()).isFalse();
			assertThat(updated.getPinHash()).isNull();
		}
	}

	@Nested
	@DisplayName("관리자 1-Click PIN 초기화 (resetPin)")
	class ResetPinTest {

		@Test
		@DisplayName("관리자가 직원의 PIN을 즉시 해제하고 잠금 상태도 초기화한다")
		void resetPinSuccessfully() {
			staffService.updatePin("ST-999", null, "1234");
			// 5회 실패로 잠금 유발
			for (int i = 0; i < 5; i++) {
				staffService.verifyPin("ST-999", "0000");
			}

			// 관리자 초기화
			StaffResponse response = staffService.resetPin("ST-999");
			assertThat(response.hasPin()).isFalse();

			Staff updated = staffRepository.findByCode("ST-999").orElseThrow();
			assertThat(updated.hasPin()).isFalse();
			assertThat(updated.getPinHash()).isNull();

			// 다시 새 PIN 등록 후 즉시 검증 가능 (잠금 해제 확인)
			staffService.updatePin("ST-999", null, "9999");
			VerifyPinResponse verifyRes = staffService.verifyPin("ST-999", "9999");
			assertThat(verifyRes.valid()).isTrue();
			assertThat(verifyRes.locked()).isFalse();
		}
	}
}
