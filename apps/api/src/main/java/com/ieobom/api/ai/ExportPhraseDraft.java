package com.ieobom.api.ai;

/**
 * AI 가 돌려준 두 문구. <b>검증 전</b> 초안이다.
 *
 * <p>출력이 한 종류가 아니라 두 종류다. 전산에 붙여넣을 기록 문구와 보호자에게 전할 문구는 읽는 사람과 말투가 다르므로 한 문구를 돌려 쓰지 않는다.
 * (Manyfast F-GUSOFG display)
 *
 * <p>담을 내용이 없으면 빈 문자열이 온다. 여기서 판정하지 않고 {@code ExportPhraseVerifier} 가 본다.
 *
 * @param recordPhrase 전산 기록 문구
 * @param guardianPhrase 보호자 전달 문구
 */
public record ExportPhraseDraft(String recordPhrase, String guardianPhrase) {}
