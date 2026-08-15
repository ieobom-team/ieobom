-- V1 — 스키마 고정. (#19)
--
-- 이 파일은 손으로 적은 것이 아니라 **Hibernate 가 실제로 만든 DDL 을 옮긴 것이다.**
-- 빈 스키마에 `ddl-auto: create` 로 한 번 띄운 뒤 `SHOW CREATE TABLE` 8 개를 떠서 정리했다.
-- 손으로 적었으면 아래 셋을 전부 틀렸다.
--
--   * enum 컬럼은 varchar 가 아니라 MySQL 네이티브 `enum(...)` 이다. (Hibernate 7 + MySQLDialect)
--   * `due_time` · `suggested_due_time` 은 `time(6)` 이 아니라 `time` 이다.
--   * `handover_card_suggested_action` 의 PK 는 `(sort_order, handover_card_id)` 순서다.
--
-- 컬럼 순서만 읽기 좋게 바꿨다. (실제 테이블은 Hibernate 가 타입별로 재배치한다 — 검증과 무관)
-- 문자셋·콜레이션은 서버 기본값에 기대지 않고 테이블마다 명시한다. 배포 서버 설정이 달라도 같게 만든다.
--
-- 규칙: **이 파일은 병합 후 고치지 않는다.** 스키마 변경은 항상 V2, V3 … 을 새로 추가한다.
-- 시드 데이터는 여기 넣지 않는다. `CareRecipientSeeder` · `StaffSeeder` 가 기동 시 채운다.
-- (docs/contracts/db-schema.md)

create table care_recipient (
    id            bigint      not null auto_increment,
    name          varchar(50) not null,
    code          varchar(30) not null,
    discharged_at datetime(6) null,
    created_at    datetime(6) not null,
    updated_at    datetime(6) not null,
    primary key (id),
    constraint uk_care_recipient_code unique (code)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;

create table staff (
    id         bigint      not null auto_increment,
    name       varchar(50) not null,
    code       varchar(30) not null,
    job_role   enum ('CAREGIVER','CENTER_HEAD','DRIVER','NURSE_AIDE','SOCIAL_WORKER') not null,
    created_at datetime(6) not null,
    updated_at datetime(6) not null,
    primary key (id),
    constraint uk_staff_code unique (code)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;

create table handover (
    id                bigint        not null auto_increment,
    care_recipient_id bigint        not null,
    raw_text          varchar(2000) not null,
    input_method      enum ('CHECK','TEXT','VOICE') not null,
    occurred_at       datetime(6)   not null,
    reporter_name     varchar(50)   not null,
    proxy_input       bit(1)        not null,
    info_source       enum ('COLLEAGUE','DRIVER','GUARDIAN','OTHER') null,
    audio_mime_type   varchar(100)  null,
    created_at        datetime(6)   not null,
    updated_at        datetime(6)   not null,
    primary key (id),
    constraint fk_handover_care_recipient
        foreign key (care_recipient_id) references care_recipient (id)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;

-- 원문과 1:1 이지만 테이블을 나눈다. 카드 목록이 원문을 join fetch 하므로
-- 바이트를 handover 에 두면 카드 한 장마다 녹음 전체가 메모리에 올라온다.
--
-- data 는 반드시 mediumblob 이다. (앱 상한 10MB < mediumblob 16MB)
-- longblob·blob 으로 바꾸면 ddl-auto: validate 가 기동 시점에 막는다.
create table handover_audio (
    id          bigint      not null auto_increment,
    handover_id bigint      not null,
    data        mediumblob  not null,
    created_at  datetime(6) not null,
    updated_at  datetime(6) not null,
    primary key (id),
    constraint uk_handover_audio_handover unique (handover_id),
    constraint fk_handover_audio_handover
        foreign key (handover_id) references handover (id)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;

create table handover_card (
    id                 bigint        not null auto_increment,
    handover_id        bigint        not null,
    care_recipient_id  bigint        null,
    observed_at        datetime(6)   null,
    status_change      varchar(500)  null,
    action_taken       varchar(500)  null,
    next_action        varchar(500)  null,
    evidence_text      varchar(1000) not null,
    safety_related     bit(1)        not null,
    safety_flag_source enum ('KEYWORD','STAFF') null,
    review_status      enum ('NEEDS_REVIEW','REVIEWED') not null,
    suggested_job_role enum ('CAREGIVER','CENTER_HEAD','DRIVER','NURSE_AIDE','SOCIAL_WORKER') null,
    suggested_due_time time          null,
    created_at         datetime(6)   not null,
    updated_at         datetime(6)   not null,
    primary key (id),
    constraint fk_handover_card_handover
        foreign key (handover_id) references handover (id),
    constraint fk_handover_card_care_recipient
        foreign key (care_recipient_id) references care_recipient (id)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;

-- HandoverCard.suggestedActions 의 @ElementCollection 테이블.
-- 엔티티가 아니라 값 목록이라 id 도 created_at 도 없다. 순서는 @OrderColumn 이 sort_order 로 지킨다.
create table handover_card_suggested_action (
    handover_card_id bigint       not null,
    sort_order       int          not null,
    target_field     enum ('ACTION_TAKEN','NEXT_ACTION') not null,
    text             varchar(500) not null,
    primary key (sort_order, handover_card_id),
    constraint ck_suggested_action_sort_order check (sort_order >= 0),
    constraint fk_suggested_action_handover_card
        foreign key (handover_card_id) references handover_card (id)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;

-- due_time 이 date 가 아니라 time 인 이유는 docs/contracts/task-api.md 에 있다. (당일 HH:MM)
create table task (
    id                bigint       not null auto_increment,
    handover_card_id  bigint       not null,
    content           varchar(500) not null,
    assignee_job_role enum ('CAREGIVER','CENTER_HEAD','DRIVER','NURSE_AIDE','SOCIAL_WORKER') null,
    assignee_name     varchar(50)  null,
    due_time          time         not null,
    status            enum ('DONE','PENDING') not null,
    completed_at      datetime(6)  null,
    completed_by_name varchar(50)  null,
    created_at        datetime(6)  not null,
    updated_at        datetime(6)  not null,
    primary key (id),
    constraint fk_task_handover_card
        foreign key (handover_card_id) references handover_card (id)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;

create table export_phrase (
    id               bigint        not null auto_increment,
    handover_card_id bigint        not null,
    phrase_type      enum ('GUARDIAN','RECORD') not null,
    generated_text   varchar(1000) null,
    edited_text      varchar(1000) null,
    review_notice    varchar(200)  null,
    copied_at        datetime(6)   null,
    verified_at      datetime(6)   null,
    created_at       datetime(6)   not null,
    updated_at       datetime(6)   not null,
    primary key (id),
    constraint uk_export_phrase_card_type unique (handover_card_id, phrase_type),
    constraint fk_export_phrase_handover_card
        foreign key (handover_card_id) references handover_card (id)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_unicode_ci;
