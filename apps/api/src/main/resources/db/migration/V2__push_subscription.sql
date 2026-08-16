-- V2__push_subscription.sql
-- 개인 기기 푸시 알림 기기 구독 테이블 (Manyfast R-VZCOLM / F-QPWGNS, #72)

create table push_subscription (
    id bigint not null auto_increment,
    staff_id bigint not null,
    endpoint varchar(500) not null,
    p256dh varchar(255) not null,
    auth varchar(255) not null,
    last_status varchar(30) null,
    last_sent_at datetime(6) null,
    created_at datetime(6) not null,
    updated_at datetime(6) not null,
    primary key (id),
    constraint uk_push_subscription_endpoint unique (endpoint),
    constraint fk_push_subscription_staff foreign key (staff_id) references staff (id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create index idx_push_subscription_staff on push_subscription (staff_id);
