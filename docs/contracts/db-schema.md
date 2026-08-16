# DB 스키마

`apps/api/src/main/resources/db/migration/V1__init.sql` 이 만드는 스키마다.
**엔티티 매핑이 기준이고, 이 문서와 SQL 은 그것을 옮긴 것이다.** 셋이 어긋나면 기동이 막힌다(아래 "어긋나면 어떻게 되나").

| | |
|---|---|
| DBMS | MySQL **8.4 LTS** (로컬·배포 동일. H2 는 테스트 전용) |
| 문자셋 | `utf8mb4` / `utf8mb4_unicode_ci` — 테이블마다 명시한다 |
| 스키마 생성 | Flyway (`spring.flyway.enabled: true`) |
| 스키마 검증 | Hibernate `ddl-auto: validate` |

## V1 은 스키마만 만든다

**시드 데이터를 마이그레이션에 넣지 않는다.** 데모용 어르신 20명(`IB-001`~`IB-020`)과
직원 8명(`ST-001`~`ST-008`)은 `CareRecipientSeeder` · `StaffSeeder` 가 **기동 시** 채운다.
둘 다 식별번호(`code`) 단위로 확인하고 넣으므로 여러 번 기동해도 중복이 쌓이지 않는다.

이유는 둘이다.

- 시드를 V1 에 박으면 **고칠 수 없다.** 마이그레이션은 병합 후 수정 금지이므로 이름 하나를 바꾸려 해도 V2 가 필요하다.
- 시더는 이미 있고 멱등하다. 같은 일을 두 곳에서 하면 어느 쪽이 진짜인지 알 수 없게 된다.

명단 변경은 시더 코드를 고치거나 DB 를 직접 손보는 것으로 한다.
(`architecture.md` "어르신 시드" · "직원 시드")

## 테이블

9개다. `handover_card_suggested_action` 은 엔티티가 아니라 `@ElementCollection` 컬렉션 테이블이라
엔티티 목록에는 없지만 **없으면 카드 조회가 바로 실패한다.**

모든 **엔티티** 테이블은 `BaseTimeEntity` 를 상속해 `created_at` · `updated_at` (`datetime(6) not null`)
을 갖는다. 컬렉션 테이블에는 없다.

### `care_recipient` — 어르신

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `name` | `varchar(50)` | ✕ | 실명 |
| `code` | `varchar(30)` | ✕ | **내부 ID** (`IB-001`…). `uk_care_recipient_code` |
| `discharged_at` | `datetime(6)` | ○ | 이용 종료 시점 |

`code` 가 가명처리의 내부 ID다. LLM 호출 전 실명을 이 값으로 바꾸고 화면에 그릴 때만 되돌린다.

### `staff` — 직원 명단

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `name` | `varchar(50)` | ✕ | |
| `code` | `varchar(30)` | ✕ | 사번 (`ST-001`…). `uk_staff_code` |
| `job_role` | `enum('CAREGIVER','CENTER_HEAD','DRIVER','NURSE_AIDE','SOCIAL_WORKER')` | ✕ | 담당 직종 5종 |

**인계·업무는 직원을 이름 문자열로 가리킨다.** `handover.reporter_name` · `task.assignee_name` ·
`task.completed_by_name` 에 외래키가 없는 것은 그래서다.

**외래키가 걸리는 곳은 `notification.recipient_staff_id` 하나뿐이다.** 업무는 앱을 쓰지 않는
직종에도 배정되므로 가리킬 직원 행이 없을 수 있지만, 알림은 받을 사람이 명단에 있어야만 만들어진다.

### `handover` — 원본 인계 입력

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `care_recipient_id` | `bigint` | ✕ | FK `fk_handover_care_recipient` |
| `raw_text` | `varchar(2000)` | ✕ | **원문 그대로.** 요약·정제하지 않는다 |
| `input_method` | `enum('CHECK','TEXT','VOICE')` | ✕ | |
| `occurred_at` | `datetime(6)` | ✕ | 특이사항이 있었던 시점 (저장 시각과 다를 수 있다) |
| `reporter_name` | `varchar(50)` | ✕ | 앱에서 남긴 사람 |
| `proxy_input` | `bit(1)` | ✕ | 대리 입력 여부 |
| `info_source` | `enum('COLLEAGUE','DRIVER','GUARDIAN','OTHER')` | ○ | 내용이 실제로 나온 곳 |
| `audio_mime_type` | `varchar(100)` | ○ | **있으면 들을 음성이 있다는 뜻** |

### `handover_audio` — 원본 음성

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `handover_id` | `bigint` | ✕ | `uk_handover_audio_handover` (1:1) · FK `fk_handover_audio_handover` |
| `data` | **`mediumblob`** | ✕ | 음성 바이트 |

**원문과 1:1 이면서도 테이블을 나눈 이유**는 카드 목록 조회가 원문을 `join fetch` 하기 때문이다.
바이트를 `handover` 에 두면 카드 한 장마다 녹음 전체가 메모리에 올라온다.

**`data` 는 반드시 `mediumblob` 이다.**

| 한계 | 값 | |
|---|---|---|
| 앱 상한 (`HandoverService.AUDIO_MAX_BYTES`) | 10MB | 화면은 5분에서 자동 정지 |
| `mediumblob` 최대 | 16MB | 10MB < 16MB ✅ |
| MySQL 8.4 `max_allowed_packet` 기본 | 64MB | Base64 Data URL 이라 10MB ≈ 13.3MB JSON ✅ |

⚠️ **배포 MySQL 에 `max_allowed_packet` 을 기본값보다 낮게 설정하지 않는다.** 여기서 깨진다.
`longblob` · `blob` 으로 바꾸면 `validate` 가 기동 시점에 막는다.

### `handover_card` — 구조화 카드

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `handover_id` | `bigint` | ✕ | FK `fk_handover_card_handover` |
| `care_recipient_id` | `bigint` | ○ | FK `fk_handover_card_care_recipient` |
| `observed_at` | `datetime(6)` | ○ | |
| `status_change` | `varchar(500)` | ○ | 변화 |
| `action_taken` | `varchar(500)` | ○ | 조치 |
| `next_action` | `varchar(500)` | ○ | 다음 행동 |
| `evidence_text` | `varchar(1000)` | ✕ | **근거 원문. 필수다** |
| `safety_related` | `bit(1)` | ✕ | |
| `safety_flag_source` | `enum('KEYWORD','STAFF')` | ○ | 판정 출처 |
| `review_status` | `enum('NEEDS_REVIEW','REVIEWED')` | ✕ | 두 값만 쓴다 |
| `suggested_job_role` | `enum('CAREGIVER','CENTER_HEAD','DRIVER','NURSE_AIDE','SOCIAL_WORKER')` | ○ | |
| `suggested_due_time` | `time` | ○ | 당일 시각 |

**`care_recipient_id` 가 nullable 인 것은 의도다.** 대상 어르신을 분리할 수 없는 원문은 확정 카드로
만들지 않고 어르신 없이 `NEEDS_REVIEW` 로 남긴다. 반면 `handover.care_recipient_id` 는 필수다.

**`evidence_text` 가 `not null` 인 것도 의도다.** 근거 없는 항목은 만들지 않는다는 규칙이
스키마 레벨에서 강제된다.

### `handover_card_suggested_action` — 추천 액션 칩

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `handover_card_id` | `bigint` | ✕ | FK `fk_suggested_action_handover_card` |
| `sort_order` | `int` | ✕ | `@OrderColumn`. `ck_suggested_action_sort_order` (`>= 0`) |
| `target_field` | `enum('ACTION_TAKEN','NEXT_ACTION')` | ✕ | 어느 칸의 칩인가 |
| `text` | `varchar(500)` | ✕ | |

PK 는 **`(sort_order, handover_card_id)`** 다. 값 목록이라 `id` 도 `created_at` 도 없다.

### `task` — 후속 업무

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `handover_card_id` | `bigint` | ✕ | FK `fk_task_handover_card` |
| `content` | `varchar(500)` | ✕ | |
| `assignee_job_role` | `enum(…5종…)` | ○ | 판단 근거가 없으면 비운다 |
| `assignee_name` | `varchar(50)` | ○ | |
| `assignee_staff_code` | `varchar(30)` | ○ | 담당자 사번. **FK 가 아니라 문자열이다** |
| `claimed_at` | `datetime(6)` | ○ | 담당이 정해진 시각 |
| `claim_method` | `enum('DIRECT_ASSIGN','SELF_CLAIM')` | ○ | 담당 확정 방식 |
| `due_time` | **`time`** | ✕ | **당일 HH:MM** |
| `status` | `enum('DONE','PENDING')` | ✕ | 중간 상태를 만들지 않는다 |
| `completed_at` | `datetime(6)` | ○ | |
| `completed_by_name` | `varchar(50)` | ○ | 담당자와 달라도 된다 (대리 완료) |

**`due_time` 이 `date`/`datetime` 이 아니라 `time` 인 이유**는 어르신이 당일 귀가하기 때문이다.
날짜 단위 기한과 익일 기한을 쓰지 않는다. ([task-api.md](task-api.md))

**`assignee_staff_code` 는 `staff` 외래키가 아니다.** 담당자를 이름 문자열로 두는 결정을 뒤집지
않았다 — 앱을 쓰지 않는 직종에 배정된 업무는 가리킬 직원 행 자체가 없다. 사번은 **알림을 보낼 수
있을 때만** 채워지는 보조 값이고, 비어 있어도 업무는 온전하다. 이름을 두고도 사번을 따로 두는 이유는
동명이인이다. ([#70](https://github.com/ieobom-team/ieobom/issues/70), [notification-api.md](notification-api.md))

**`claim_method` 는 상태가 아니다.** 업무 상태는 `status` 의 `PENDING`/`DONE` 두 값 그대로이고,
`claim_method` 는 담당자 정보의 일부다. 담당자가 있을 때만 값을 가진다.
([#73](https://github.com/ieobom-team/ieobom/issues/73))

### `export_phrase` — 출력 문구

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `handover_card_id` | `bigint` | ✕ | FK `fk_export_phrase_handover_card` |
| `phrase_type` | `enum('GUARDIAN','RECORD')` | ✕ | |
| `generated_text` | `varchar(1000)` | ○ | AI 원본 |
| `edited_text` | `varchar(1000)` | ○ | 직원 수정본 |
| `review_notice` | `varchar(200)` | ○ | |
| `copied_at` | `datetime(6)` | ○ | |
| `verified_at` | `datetime(6)` | ○ | |

`uk_export_phrase_card_type (handover_card_id, phrase_type)` — 카드 하나에 종류별 한 줄이다.

### `notification` — 앱 안 알림

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `recipient_staff_id` | `bigint` | ✕ | 받는 직원. FK `fk_notification_recipient_staff` |
| `task_id` | `bigint` | ✕ | 가리키는 업무. FK `fk_notification_task` |
| `type` | `enum('ASSIGNEE_CHANGED','DELEGATED_COMPLETION','TASK_ASSIGNED')` | ✕ | |
| `actor_name` | `varchar(50)` | ○ | 알림을 일으킨 사람 |
| `read_at` | `datetime(6)` | ○ | 읽기 전까지 비어 있다 |

`uk_notification_task_recipient_type (task_id, recipient_staff_id, type)` —
같은 업무·같은 수신자·같은 종류가 두 번 쌓이지 않는다.

**`staff` 가 다른 테이블과 외래키로 이어지는 유일한 지점이다.** 업무의 담당자는 이름 문자열이지만,
알림은 **받을 사람이 명단에 있어야만** 만들어진다. 받는 사람이 없는 알림은 조회될 길이 없다.

**알림 본문 문자열을 저장하지 않는다.** 어르신 이름·업무 내용·기한은 조회 시점에 업무에서 읽는다.
문장을 저장해 두면 업무가 바뀌었을 때(누군가 맡거나 완료하거나) 알림함이 옛말을 하게 된다.
`actor_name` 만 예외인데, 알림을 일으킨 사람은 그 시점의 사실이라 업무에서 되짚을 수 없다.
([notification-api.md](notification-api.md))

### `push_subscription` — 개인 기기 웹 푸시 구독 (`#72`)

| 컬럼 | 타입 | NULL | 비고 |
|---|---|---|---|
| `id` | `bigint` | ✕ | PK, auto_increment |
| `staff_id` | `bigint` | ✕ | 연결 직원. FK `fk_push_subscription_staff` |
| `endpoint` | `varchar(500)` | ✕ | 기기 고유 구독 엔드포인트. `uk_push_subscription_endpoint` |
| `p256dh` | `varchar(255)` | ✕ | 암호화 공개키 |
| `auth` | `varchar(255)` | ✕ | 인증 시크릿 |
| `last_status` | `varchar(30)` | ○ | 마지막 발송 결과 (`SUCCESS`, `HTTP 410` 등) |
| `last_sent_at` | `datetime(6)` | ○ | 마지막 발송 시각 |

`uk_push_subscription_endpoint (endpoint)` — 브라우저/기기 단위로 유일하며, 같은 기기 재등록 시 직원만 덮어쓴다.

## 알아 둘 것

**enum 컬럼은 `varchar` 가 아니라 MySQL 네이티브 `enum(...)` 이다.**
Hibernate 7 + `MySQLDialect` 가 `@Enumerated(STRING)` 을 그렇게 매핑한다. 값 순서는 알파벳순이다.
`@Column(length = …)` 을 붙여도 무시된다 — `notification.type` 이 `length = 30` 을 달고도
`enum(...)` 으로 나오는 것이 그 예다.
**값을 늘리면 `ALTER TABLE … MODIFY` 가 필요하고, 그건 V2 이후의 마이그레이션이다.**

**명시적 인덱스가 하나도 없다.** MySQL 이 FK 에 자동으로 붙이는 인덱스와 위의 unique 뿐이다.
조회 패턴에 맞는 인덱스 추가는 별도 Issue 로 뗀다.

## 마이그레이션 규칙

- **`V1__init.sql` 은 병합 후 고치지 않는다.** 이미 적용된 DB 에서 체크섬이 어긋나 기동이 막힌다.
- 스키마 변경은 **항상 새 파일**(`V2__…`, `V3__…`)로 추가한다. 파일명은 `V<번호>__<설명>.sql`.
- **엔티티를 고치면 같은 PR 에서 마이그레이션도 고친다.** 둘이 갈라지면 배포에서 앱이 뜨지 않는다.

### 어긋나면 어떻게 되나

`ddl-auto: validate` 라서 **엔티티와 DB 가 한 글자만 달라도 기동이 실패한다.**
런타임에 조용히 틀리는 대신 시작 시점에 크게 실패한다 — 이게 의도한 동작이다.

### V1 은 어떻게 만들었나

손으로 적지 않았다. 빈 스키마에 `ddl-auto: create` 로 한 번 띄워 Hibernate 가 실제로 만든 DDL 을
`SHOW CREATE TABLE` 로 떠서 옮겼다. 손으로 적었으면 아래 넷을 틀렸다.

- enum 컬럼이 `varchar` 가 아니라 네이티브 `enum(...)` 인 것 (`length` 를 붙여도 무시된다)
- `due_time` · `suggested_due_time` 이 `time(6)` 이 아니라 `time` 인 것
- 컬렉션 테이블 PK 가 `(sort_order, handover_card_id)` 순서인 것
- `notification` 의 복합 unique 가 `(task_id, recipient_staff_id, type)` 순서인 것

**엔티티가 바뀌면 같은 방법으로 다시 뜬다.** `#70`(알림) · `#73`(담당 확정)이 들어왔을 때도
V1 을 손으로 고치지 않고 이 절차를 다시 돌렸다.

## 로컬 DB 초기화 — V1 병합 후 한 번

`spring.flyway.baseline-on-migrate: true` 라서 **이미 `ddl-auto: update` 로 자란 로컬 DB 는
baseline 으로 찍히고 V1 을 건너뛴다.** 로컬은 안 깨지지만, 그대로 두면

- **로컬** = `ddl-auto: update` 가 만든 스키마 (baseline → V1 skip)
- **배포** = 빈 DB 에서 V1 이 만든 스키마

서로 다른 경로로 만들어진 스키마를 쓰게 된다. 이 비대칭을 없애려면 **각자 로컬 DB 를 한 번 초기화한다.**

```bash
docker compose down -v && docker compose up -d
```

**로컬 데이터는 시더가 다시 넣는 시드뿐이라 잃을 것이 없다.**

## 테스트가 이 스키마를 검증하지 못한다

**백엔드 테스트는 H2 인메모리이고 Flyway 를 끈다.** (`src/test/resources/application.yml`)
그래서 `./gradlew build` 가 통과해도 **V1 이 MySQL 에서 실제로 도는지는 전혀 확인되지 않는다.**

지금의 안전망은 **사람이 빈 MySQL 스키마에 한 번 띄워 보는 것** 하나뿐이다.

```bash
# 빈 스키마를 만들고
docker exec ieobom-mysql mysql -uroot -p<루트비번> -e "CREATE DATABASE ieobom_v1_check CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON ieobom_v1_check.* TO 'ieobom'@'%';"

# 그쪽을 가리켜 띄운다. 기동에 성공하면 V1 과 엔티티가 맞는 것이다.
cd apps/api && DB_URL='jdbc:mysql://localhost:3306/ieobom_v1_check?characterEncoding=UTF-8&serverTimezone=Asia/Seoul' ./gradlew bootRun
```

Testcontainers 로 이 확인을 CI 에 넣는 것이 정답이지만 범위 밖이라 Backlog 로 뗐다.
