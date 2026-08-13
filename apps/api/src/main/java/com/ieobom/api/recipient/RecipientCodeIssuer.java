package com.ieobom.api.recipient;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 어르신 내부 ID 를 발급한다. (Manyfast F-LUDCWW dataSpec — "내부 ID 는 접두어와 순번을 붙인 형식으로 부여한다")
 *
 * <p>접두어는 {@code CareRecipientSeeder} 가 데모 20명에 붙인 것과 같은 {@code IB-} 다. 시드와 형식이 갈리면 명단 화면에
 * 두 가지 모양이 섞여 보인다.
 *
 * <p>순번은 <b>이미 쓰인 최대 순번 + 1</b> 이다. 개수 + 1 이 아니다. 어르신을 지우지는 않지만, 지금 개수를 세면 시드 20명과 새 등록이 겹칠
 * 여지가 남는다.
 */
@Component
@RequiredArgsConstructor
public class RecipientCodeIssuer {

	static final String PREFIX = "IB-";

	/** 시드가 {@code IB-001} 로 시작하므로 최소 세 자리를 유지한다. 999 를 넘으면 자릿수가 자연히 늘어난다. */
	private static final String FORMAT = PREFIX + "%03d";

	private static final Pattern SEQUENCE = Pattern.compile("^" + PREFIX + "(\\d+)$");

	private final CareRecipientRepository careRecipientRepository;

	/** 다음 내부 ID. */
	public String issue() {
		return FORMAT.formatted(maxSequence() + 1);
	}

	/**
	 * 지금까지 쓰인 가장 큰 순번. 하나도 없으면 {@code 0}.
	 *
	 * <p>{@code IB-} 로 시작해도 뒤가 숫자가 아니면 건너뛴다. 손으로 넣은 값이 섞여도 발급이 멈추지 않아야 한다.
	 */
	private int maxSequence() {
		return careRecipientRepository.findByCodeStartingWith(PREFIX).stream()
				.map(CareRecipient::getCode)
				.map(SEQUENCE::matcher)
				.filter(Matcher::matches)
				.mapToInt(matcher -> Integer.parseInt(matcher.group(1)))
				.max()
				.orElse(0);
	}
}
