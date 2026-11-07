CREATE DATABASE IF NOT EXISTS seat_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE seat_app;

-- ตารางหลัก: 1 แถว = 1 การจอง (เก็บประวัติถาวร แม้ยกเลิก)
CREATE TABLE IF NOT EXISTS bookings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  booking_date  DATE         NOT NULL,                          -- วันที่ใช้งานจริง
  time_slot     VARCHAR(10)  NOT NULL,                          -- รอบเวลา
  seats         VARCHAR(100) NOT NULL,                          -- เช่น A1,A2
  seat_count    TINYINT      NOT NULL,
  customer_name VARCHAR(100) NOT NULL DEFAULT '',
  status        ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- วันเวลาที่บันทึก
  cancelled_at  DATETIME     NULL,                               -- วันเวลาที่ยกเลิก
  INDEX idx_date (booking_date)
);

-- ตารางกันจองซ้ำ: 1 แถว = 1 ที่นั่งที่ถูกจองอยู่ (ลบทิ้งเมื่อยกเลิก)
CREATE TABLE IF NOT EXISTS booked_seats (
  booking_id   INT         NOT NULL,
  booking_date DATE        NOT NULL,
  time_slot    VARCHAR(10) NOT NULL,
  seat_id      VARCHAR(5)  NOT NULL,
  UNIQUE KEY uq_seat (booking_date, time_slot, seat_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
