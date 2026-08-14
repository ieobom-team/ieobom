package com.ieobom.api.handovercard;

/**
 * 추천 액션 칩이 채울 대상 칸. (Manyfast F-SNBVHR action — "칩을 탭하면 해당 칸에 채워지고 수정할 수 있다")
 *
 * <p>상태 변화는 대상이 아니다. 추천 칩은 조치·다음 행동에만 붙는다.
 */
public enum CardField {
	ACTION_TAKEN,
	NEXT_ACTION
}
