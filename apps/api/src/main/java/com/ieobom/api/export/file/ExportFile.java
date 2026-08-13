package com.ieobom.api.export.file;

/**
 * 내려줄 파일 하나.
 *
 * <p><b>저장하지 않는다.</b> 만들어 곧장 응답으로 흘려보내고 서버에는 남기지 않는다. 같은 구조화 결과를 다시 그린 것이라 보관할 이유가 없고, 보관하면
 * 어르신의 건강 상태가 담긴 파일이 서버에 쌓인다. (Manyfast F-GUSOFG dataSpec)
 *
 * @param fileName 내려받는 사람이 자기 PC 에서 보게 될 이름
 * @param contentType 브라우저가 무엇으로 열지 정하는 값
 * @param content 파일 내용
 */
public record ExportFile(String fileName, String contentType, byte[] content) {}
