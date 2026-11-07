<?php
// ===== ตั้งค่าฐานข้อมูล (ค่าเริ่มต้นของ XAMPP) =====
$DB = ['host' => 'localhost', 'name' => 'seat_app', 'user' => 'root', 'pass' => ''];
$TIMES = ['8:00', '11:30', '13:00', '16:30'];   // ต้องตรงกับ TIMES ใน script.js

date_default_timezone_set('Asia/Bangkok');
header('Content-Type: application/json; charset=utf-8');

function out($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = new PDO("mysql:host={$DB['host']};dbname={$DB['name']};charset=utf8mb4", $DB['user'], $DB['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec("SET time_zone = '+07:00'");
} catch (PDOException $e) {
    out(['error' => 'เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบว่าเปิด MySQL ใน XAMPP และนำเข้า database.sql แล้ว'], 500);
}

$action = $_GET['action'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$validDate = function ($d) {
    return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)
        && checkdate((int)substr($d, 5, 2), (int)substr($d, 8, 2), (int)substr($d, 0, 4));
};

// ดึงการจองของวันที่เลือก
if ($action === 'state') {
    $date = $_GET['date'] ?? '';
    if (!$validDate($date)) out(['error' => 'วันที่ไม่ถูกต้อง'], 400);
    $st = $pdo->prepare("SELECT id, time_slot AS time, seats, customer_name AS name, created_at
                         FROM bookings WHERE booking_date = ? AND status = 'active' ORDER BY id");
    $st->execute([$date]);
    $rows = array_map(function ($r) {
        $r['id'] = (int)$r['id'];
        $r['seats'] = explode(',', $r['seats']);
        return $r;
    }, $st->fetchAll());
    out(['bookings' => $rows]);
}

// บันทึกการจองใหม่
if ($action === 'book' && $isPost) {
    $date  = $in['date'] ?? '';
    $time  = $in['time'] ?? '';
    $seats = $in['seats'] ?? [];
    $name  = mb_substr(trim((string)($in['name'] ?? '')), 0, 100);
    if (!$validDate($date) || $date < date('Y-m-d')) out(['error' => 'วันที่ไม่ถูกต้อง หรือเป็นวันที่ผ่านมาแล้ว'], 400);
    if (!in_array($time, $TIMES, true)) out(['error' => 'รอบเวลาไม่ถูกต้อง'], 400);
    if (!is_array($seats) || count($seats) < 1 || count($seats) > 8) out(['error' => 'จำนวนที่นั่งไม่ถูกต้อง'], 400);
    $seats = array_values(array_unique($seats));
    foreach ($seats as $s) {
        if (!is_string($s) || !preg_match('/^[A-H](?:[1-9]|1[0-2])$/', $s)) out(['error' => 'รหัสที่นั่งไม่ถูกต้อง'], 400);
    }
    sort($seats);
    try {
        $pdo->beginTransaction();
        $pdo->prepare("INSERT INTO bookings (booking_date, time_slot, seats, seat_count, customer_name) VALUES (?,?,?,?,?)")
            ->execute([$date, $time, implode(',', $seats), count($seats), $name]);
        $id = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare("INSERT INTO booked_seats (booking_id, booking_date, time_slot, seat_id) VALUES (?,?,?,?)");
        foreach ($seats as $s) $ins->execute([$id, $date, $time, $s]);
        $pdo->commit();
        out(['ok' => true, 'id' => $id]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') out(['error' => 'มีที่นั่งที่เพิ่งถูกจองไปแล้ว กรุณาเลือกใหม่'], 409);
        out(['error' => 'บันทึกข้อมูลไม่สำเร็จ'], 500);
    }
}

// ยกเลิกการจอง (เก็บประวัติไว้ แค่เปลี่ยนสถานะ + ปล่อยที่นั่ง)
if ($action === 'cancel' && $isPost) {
    $id = (int)($in['id'] ?? 0);
    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare("UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = ? AND status = 'active'");
        $st->execute([$id]);
        if ($st->rowCount() === 0) {
            $pdo->rollBack();
            out(['error' => 'ไม่พบการจองนี้ หรือถูกยกเลิกไปแล้ว'], 404);
        }
        $pdo->prepare("DELETE FROM booked_seats WHERE booking_id = ?")->execute([$id]);
        $pdo->commit();
        out(['ok' => true]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        out(['error' => 'ยกเลิกไม่สำเร็จ'], 500);
    }
}

// รายงาน รายวัน / รายเดือน / รายปี (นับตามวันที่ใช้งาน booking_date)
if ($action === 'report') {
    $type = $_GET['type'] ?? 'day';
    $fmt = ['day' => '%Y-%m-%d', 'month' => '%Y-%m', 'year' => '%Y'][$type] ?? '%Y-%m-%d';
    $summary = $pdo->query("SELECT DATE_FORMAT(booking_date, '$fmt') AS period,
            SUM(status = 'active') AS bookings,
            COALESCE(SUM(IF(status = 'active', seat_count, 0)), 0) AS seats,
            SUM(status = 'cancelled') AS cancelled
        FROM bookings GROUP BY period ORDER BY period DESC LIMIT 366")->fetchAll();
    $log = $pdo->query("SELECT id, booking_date, time_slot, seats, customer_name, status, created_at, cancelled_at
        FROM bookings ORDER BY id DESC LIMIT 100")->fetchAll();
    out(['summary' => $summary, 'log' => $log]);
}

out(['error' => 'ไม่รู้จักคำสั่ง'], 400);
