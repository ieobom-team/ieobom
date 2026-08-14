package com.ieobom.api.ai;

/**
 * AI 가 돌려준 추천 액션 칩 하나. <b>검증 전</b> 초안이다. (Manyfast F-SNBVHR action — RFC #62 방향 A)
 *
 * <p>{@link StructuredCardDraft} 와 같은 이유로 {@code targetField} 도 열거값 대신 문자열로 받는다. 목록 밖 값이면 파싱
 * 예외로 카드 전체를 날리는 대신 {@code CardDraftVerifier} 가 그 칩 하나만 버린다.
 *
 * @param targetField 탭하면 채워질 칸. {@code ACTION_TAKEN} 또는 {@code NEXT_ACTION}
 * @param text 칩에 보일 짧은 문장이자 채워질 값
 * @param evidenceText 이 추천의 근거가 된 원문 구간. 검증 전용이며 카드에는 저장하지 않는다
 */
public record SuggestedActionDraft(String targetField, String text, String evidenceText) {}
