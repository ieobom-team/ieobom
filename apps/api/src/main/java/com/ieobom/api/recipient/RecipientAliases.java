package com.ieobom.api.recipient;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 실명과 내부 ID의 대조표. <b>LLM 경계에서 이름을 가리고 되돌리는 유일한 지점이다.</b>
 *
 * <p>돌봄 기록은 어르신의 건강 상태를 담으므로 실명을 LLM에 보내지 않는다. 그런데 AI의 첫 역할이 "여러 어르신이 섞인 발화를 어르신별로 분리"라서 이름을
 * 그냥 지우면 분리 단서가 사라진다. 그래서 지우는 대신 <b>사전 등록 명단과의 룰 기반 문자열 대조로 내부 ID로 바꿔</b> 넣고, LLM은 그 ID를 어르신
 * 식별자로 그대로 쓴다. (Manyfast F-LUDCWW rules · F-SNBVHR rules)
 *
 * <p><b>이 표 자체는 LLM 요청에 넣지 않는다.</b> 나가는 것은 언제나 치환이 끝난 문자열과 내부 ID 목록뿐이다. (F-LUDCWW dataSpec)
 *
 * <p>치환은 AI가 아니라 여기서 한다. 사전 등록 명단과 문자열을 대조하는 일에 모델이 필요하지 않고, 모델에 맡기면 "실명을 보내지 않으려고 실명을 보내는" 꼴이
 * 된다.
 *
 * <h2>이 표가 하지 못하는 것</h2>
 *
 * <p><b>명단에 없는 이름은 찾지 못한다.</b> 룰 기반 문자열 대조라 등록된 이름만 걸린다. 원문에 등록되지 않은 사람 이름이 섞여 있으면 그대로 나간다. 이것을
 * 잡으려면 이름을 알아보는 모델이 필요한데, 그건 "치환을 LLM에 맡기지 않는다"와 정면으로 어긋난다. 명단 등록이 이 장치의 전제다.
 */
public final class RecipientAliases {

	/** 이름 → 내부 ID. 긴 이름이 앞에 온다. */
	private final Map<String, String> codeByName;

	/** 내부 ID → 이름. 복원에 쓴다. */
	private final Map<String, String> nameByCode;

	/** 내부 ID → 어르신. 같은 이름을 쓰는 어르신이 둘 이상이면 그 ID는 여기 없다. */
	private final Map<String, CareRecipient> recipientByCode;

	private RecipientAliases(
			Map<String, String> codeByName,
			Map<String, String> nameByCode,
			Map<String, CareRecipient> recipientByCode) {

		this.codeByName = codeByName;
		this.nameByCode = nameByCode;
		this.recipientByCode = recipientByCode;
	}

	/**
	 * 명단으로 대조표를 만든다.
	 *
	 * <p><b>이용 종료한 어르신도 넣는다.</b> 이용 종료는 새 입력의 대상 선택 목록에서만 빠지는 것이고, 발화를 어르신별로 분리할 때 쓰는 이름 대조
	 * 후보에는 남는다. (Manyfast F-LUDCWW rules) 어제까지 다니던 어르신 이야기가 오늘 원문에 나오면 그 이름도 가려야 한다.
	 *
	 * @param recipients 등록된 어르신 전체
	 */
	public static RecipientAliases of(List<CareRecipient> recipients) {
		Map<String, Integer> countsByName = new HashMap<>();
		for (CareRecipient recipient : recipients) {
			countsByName.merge(recipient.getName(), 1, Integer::sum);
		}

		// 긴 이름부터 치환해야 짧은 이름이 긴 이름 안을 먼저 파먹지 않는다.
		List<CareRecipient> byNameLengthDesc =
				recipients.stream()
						.sorted(Comparator.comparingInt((CareRecipient r) -> r.getName().length()).reversed()
								.thenComparing(CareRecipient::getCode))
						.toList();

		Map<String, String> codeByName = new LinkedHashMap<>();
		Map<String, String> nameByCode = new LinkedHashMap<>();
		Map<String, CareRecipient> recipientByCode = new LinkedHashMap<>();

		for (CareRecipient recipient : byNameLengthDesc) {
			String name = recipient.getName();
			String code = recipient.getCode();

			nameByCode.put(code, name);
			// 이름이 겹치는 어르신은 ID 로 되짚어도 누구인지 확정할 수 없다. 임의로 한 명 고르면
			// 다른 어르신의 기록이 된다. 그 카드는 대상 없이 남아 직원 검토를 받는다.
			if (countsByName.get(name) == 1) {
				recipientByCode.put(code, recipient);
			}
			// 같은 이름이 여럿이어도 치환은 반드시 한다. 누구인지 못 가리는 것과 실명이 나가는 것은 다른 문제다.
			// 먼저 등록된(순번이 앞선) 어르신의 ID 하나로 모아 두고, 되돌릴 때 어르신을 확정하지 않는다.
			codeByName.putIfAbsent(name, code);
		}

		return new RecipientAliases(
				Map.copyOf(codeByName), Map.copyOf(nameByCode), Map.copyOf(recipientByCode));
	}

	/** LLM 에 보낼 후보 목록. <b>실명이 아니라 내부 ID다.</b> */
	public List<String> codes() {
		return nameByCode.keySet().stream().sorted().toList();
	}

	/**
	 * 등록된 실명을 내부 ID로 바꾼 문자열. LLM 으로 나가는 값은 전부 이 함수를 거친다.
	 *
	 * <p>긴 이름부터 바꾼다. "김말"과 "김말순"이 함께 등록돼 있을 때 짧은 쪽을 먼저 바꾸면 "김말순"이 "IB-001순"이 되어 긴 이름이 영영 걸리지
	 * 않는다.
	 */
	public String mask(String text) {
		if (text == null || text.isEmpty()) {
			return text;
		}
		String masked = text;
		for (Map.Entry<String, String> entry : sortedByNameLengthDesc(codeByName)) {
			masked = masked.replace(entry.getKey(), entry.getValue());
		}
		return masked;
	}

	/**
	 * 내부 ID를 실명으로 되돌린 문자열.
	 *
	 * <p><b>LLM 응답을 받은 자리에서 곧바로 되돌린다.</b> 마스킹은 LLM 경계에서만 일어나므로 그 경계를 넘어온 값은 다시 실명이어야 한다. 저장된
	 * 카드와 인계가 어르신을 가리키는 방식은 이 문자열이 아니라 내부 ID를 가진 어르신 행이다. 되돌리지 않고 저장하면 근거 원문 대조가 마스킹된 문자열과 원본
	 * 사이에서 어긋나고, 화면에서 고친 문구만 실명이 되어 저장된 형식이 갈린다.
	 */
	public String restore(String text) {
		if (text == null || text.isEmpty()) {
			return text;
		}
		String restored = text;
		for (Map.Entry<String, String> entry : nameByCode.entrySet()) {
			restored = restored.replace(entry.getKey(), entry.getValue());
		}
		return restored;
	}

	/**
	 * 내부 ID가 가리키는 어르신. 가릴 수 없으면 {@code null}.
	 *
	 * <p>목록에 없는 ID이거나, 같은 이름을 쓰는 어르신이 둘 이상이라 ID 하나로 모아 둔 경우다. 둘 다 "누구인지 확정하지 못했다"로 본다.
	 */
	public CareRecipient resolve(String code) {
		if (code == null || code.isBlank()) {
			return null;
		}
		return recipientByCode.get(code.trim());
	}

	/** 이 문자열에 등록된 실명이 남아 있는지. 마스킹이 실제로 걸렸는지 확인하는 데 쓴다. */
	public boolean containsRealName(String text) {
		if (text == null) {
			return false;
		}
		return codeByName.keySet().stream().anyMatch(text::contains);
	}

	/**
	 * 길이 내림차순으로 정렬한 이름 목록.
	 *
	 * <p>{@code Map.copyOf} 는 순서를 보장하지 않으므로 만들 때의 정렬에 기대지 않고 쓸 때 다시 세운다.
	 */
	private List<Map.Entry<String, String>> sortedByNameLengthDesc(Map<String, String> source) {
		List<Map.Entry<String, String>> entries = new ArrayList<>(source.entrySet());
		entries.sort(
				Comparator.comparingInt((Map.Entry<String, String> entry) -> entry.getKey().length())
						.reversed()
						.thenComparing(Map.Entry::getKey));
		return entries;
	}
}
