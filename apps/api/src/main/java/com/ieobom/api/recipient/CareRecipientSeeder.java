package com.ieobom.api.recipient;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 데모용 어르신 목록을 채운다.
 *
 * <p>어르신 목록이 비어 있으면 입력 화면부터 열리지 않으므로 기동 시 한 번 확인한다. 식별번호 단위로 확인해서 넣기 때문에 여러 번 기동해도
 * 중복이 쌓이지 않는다.
 *
 * <p>이름은 모두 가상 인물이다. 실제 어르신 정보를 넣지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CareRecipientSeeder implements ApplicationRunner {

	private static final List<String> DEMO_NAMES =
			List.of(
					"김말순", "박순자", "이영순", "최정자", "정귀남",
					"강복순", "조명자", "윤옥례", "장금순", "임순덕",
					"한상철", "오병문", "신동수", "서갑수", "권태호",
					"황재구", "안종필", "송기영", "노만식", "배영달");

	private final CareRecipientRepository careRecipientRepository;

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		int inserted = 0;
		for (int i = 0; i < DEMO_NAMES.size(); i++) {
			String code = "IB-%03d".formatted(i + 1);
			if (careRecipientRepository.existsByCode(code)) {
				continue;
			}
			careRecipientRepository.save(
					CareRecipient.builder().name(DEMO_NAMES.get(i)).code(code).build());
			inserted++;
		}
		log.info(
				"어르신 시드 확인 — 새로 넣은 인원 {}명, 전체 {}명", inserted, careRecipientRepository.count());
	}
}
