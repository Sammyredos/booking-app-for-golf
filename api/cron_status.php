<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('CRON_SECRET', 'smjgolf_mailer_2026'); // using the same secret logic

$isCli  = (php_sapi_name() === 'cli');
$isWeb  = !$isCli;

if ($isWeb) {
    $providedKey = isset($_GET['key']) ? $_GET['key'] : '';
    if ($providedKey !== CRON_SECRET) {
        http_response_code(403);
        exit('Forbidden');
    }
    header('Content-Type: text/plain; charset=utf-8');
}

if (!file_exists(__DIR__ . '/config.php')) {
    die("Error: config.php not found in " . __DIR__);
}

require_once __DIR__ . '/config.php';

if (!$conn) {
    die("Error: Database connection is not established.");
}

function getPlanDurationMins($planName) {
    if (!$planName) return 60;
    $p = strtolower($planName);
    if (strpos($p, 'nine holes') !== false || strpos($p, '9 holes') !== false) return 150;
    if (strpos($p, '18 holes') !== false) return 300;
    if (strpos($p, 'outside ikoyi') !== false) return 1440;
    if (strpos($p, 'simulator') !== false) return 120;
    return 60;
}

function timeToMins($timeStr) {
    if (!$timeStr) return 0;
    $parts = explode(' ', $timeStr);
    $time = $parts[0];
    $mod = isset($parts[1]) ? $parts[1] : '';
    $t = explode(':', $time);
    $h = (int)$t[0];
    $m = isset($t[1]) ? (int)$t[1] : 0;
    if ($mod === 'PM' && $h < 12) $h += 12;
    if ($mod === 'AM' && $h === 12) $h = 0;
    return $h * 60 + $m;
}

$result = $conn->query("SELECT id, booking_date, booking_time, plan_name FROM bookings WHERE status NOT IN ('completed', 'cancelled')");

if (!$result) {
    die("Error querying bookings: " . $conn->error);
}

$nowTimestamp = time();
$updatedCount = 0;

while ($row = $result->fetch_assoc()) {
    $startMins = timeToMins($row['booking_time']);
    $duration = getPlanDurationMins($row['plan_name']);
    
    // Calculate booking end timestamp
    $bookingStartTimestamp = strtotime($row['booking_date'] . ' 00:00:00') + ($startMins * 60);
    $bookingEndTimestamp = $bookingStartTimestamp + ($duration * 60);
    
    if ($nowTimestamp > $bookingEndTimestamp) {
        $id = $row['id'];
        $conn->query("UPDATE bookings SET status = 'completed' WHERE id = $id");
        $updatedCount++;
        echo "Updated booking ID $id to completed.\n";
    }
}

echo "Done. Total bookings updated to completed: $updatedCount\n";
$conn->close();
?>
