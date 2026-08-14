package com.ieobom.api.export;

/**
 * 출력 문구의 유형. (Manyfast F-GUSOFG dataSpec)
 *
 * <p><b>출력은 한 종류가 아니라 두 종류다.</b> 같은 사실을 담아도 전산에 붙여넣을 기록과 보호자가 읽을 문구는 읽는 사람과 말투가 다르다. 한 문구를 두
 * 곳에 돌려 쓰면 보호자에게 기록체가 나가거나 전산에 인사말이 들어간다.
 */
public enum ExportPhraseType {

	/** 기존 장기요양 전산에 붙여넣을 서술형 기록. */
	RECORD("전산 기록 문구"),

	/** 보호자에게 전할 문구. <b>자동으로 보내지 않는다.</b> 직원이 검토하고 직접 복사한다. */
	GUARDIAN("보호자 전달 문구");

	private final String label;

	ExportPhraseType(String label) {
		this.label = label;
	}

	/** 직원이 화면에서 그대로 볼 이름. */
	public String label() {
		return label;
	}

	/**
	 * 내려받은 파일 이름에 들어갈 짧은 이름.
	 *
	 * <p>{@link #label()} 과 따로 두는 이유는 띄어쓰기 하나뿐이다. 파일 이름에 공백이 있으면 메신저나 셸을 거칠 때 이름이 잘리거나 따옴표가 붙는다.
	 */
	public String fileLabel() {
		return label.replace(" ", "");
	}
}
