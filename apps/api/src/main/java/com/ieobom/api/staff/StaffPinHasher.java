package com.ieobom.api.staff;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.stereotype.Component;

/**
 * 직원 4~6자리 숫자 PIN 단방향 해시 및 일치 검증.
 *
 * <p>Manyfast F-YJJJUX dataSpec ("PIN은 4~6자리 숫자로만 구성되며, 평문은 저장하지 않고 단방향 해시값만 저장한다").
 *
 * <p>Spring Security 의존성을 추가하지 않고 Java 표준 PBKDF2WithHmacSHA256 및 Salted 해시를 사용한다.
 */
@Component
public class StaffPinHasher {

	private static final int SALT_BYTES = 16;
	private static final int ITERATIONS = 10_000;
	private static final int KEY_LENGTH_BITS = 256;
	private static final String ALGORITHM = "PBKDF2WithHmacSHA256";

	private final SecureRandom secureRandom = new SecureRandom();

	/**
	 * 평문 PIN 을 솔트와 함께 PBKDF2 로 단방향 해시한다.
	 *
	 * @param rawPin 4~6자리 숫자 PIN
	 * @return {@code {salt}:{hash}} 포맷의 Base64 인코딩 문자열
	 */
	public String encode(String rawPin) {
		if (rawPin == null || rawPin.isBlank()) {
			return null;
		}
		byte[] salt = new byte[SALT_BYTES];
		secureRandom.nextBytes(salt);
		byte[] hash = pbkdf2(rawPin.toCharArray(), salt, ITERATIONS, KEY_LENGTH_BITS);
		return Base64.getEncoder().encodeToString(salt) + ":" + Base64.getEncoder().encodeToString(hash);
	}

	/**
	 * 입력된 평문 PIN 과 저장된 해시값이 일치하는지 시간차 공격에 안전하게(constant-time) 검증한다.
	 *
	 * @param rawPin 검증할 평문 PIN
	 * @param storedHash 저장된 {@code {salt}:{hash}} 해시값
	 * @return 일치 여부
	 */
	public boolean matches(String rawPin, String storedHash) {
		if (rawPin == null || storedHash == null || storedHash.isBlank()) {
			return false;
		}
		String[] parts = storedHash.split(":");
		if (parts.length != 2) {
			return false;
		}
		try {
			byte[] salt = Base64.getDecoder().decode(parts[0]);
			byte[] expectedHash = Base64.getDecoder().decode(parts[1]);
			byte[] actualHash = pbkdf2(rawPin.toCharArray(), salt, ITERATIONS, KEY_LENGTH_BITS);
			return MessageDigest.isEqual(expectedHash, actualHash);
		} catch (IllegalArgumentException e) {
			return false;
		}
	}

	private byte[] pbkdf2(char[] password, byte[] salt, int iterations, int keyLengthBits) {
		try {
			PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, keyLengthBits);
			SecretKeyFactory skf = SecretKeyFactory.getInstance(ALGORITHM);
			return skf.generateSecret(spec).getEncoded();
		} catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
			throw new IllegalStateException("PIN 해시 생성 실패", e);
		}
	}
}
