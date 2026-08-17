-- V3__staff_pin.sql
-- 직원 선택형 4~6자리 숫자 PIN 해시 컬럼 추가 (Manyfast R-LIEATL / F-YJJJUX, #83)

alter table staff
    add column pin_hash varchar(255) null after job_role;
