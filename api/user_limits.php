<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

$user_id = $_GET['user_id'] ?? '';

if (empty($user_id)) {
    echo json_encode(["status" => "error", "message" => "user_id is required"]);
    exit;
}

// 1. Fetch all plans that have limits defined
$limits = [];
$max_validity = 0;
$res = $conn->query("SELECT title, max_sessions, validity_days FROM plans WHERE max_sessions IS NOT NULL AND validity_days IS NOT NULL");
if ($res) {
    while($row = $res->fetch_assoc()) {
        $limits[] = $row;
        if ((int)$row['validity_days'] > $max_validity) {
            $max_validity = (int)$row['validity_days'];
        }
    }
}

// 2. Fetch all recent bookings for the user in a single query
$recent_bookings = [];
if ($max_validity > 0) {
    $stmt = $conn->prepare("SELECT plan_name, created_at FROM bookings WHERE user_id = ? AND status != 'cancelled' AND created_at >= NOW() - INTERVAL ? DAY");
    $stmt->bind_param("si", $user_id, $max_validity);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $recent_bookings[] = $row;
    }
    $stmt->close();
}

$results = [];

// 3. For each limited plan, count the user's recent bookings from PHP memory
$now = time();
foreach ($limits as $limit) {
    $plan_title = $limit['title'];
    $max = (int)$limit['max_sessions'];
    $days = (int)$limit['validity_days'];
    $cutoff_time = $now - ($days * 24 * 60 * 60);
    
    $count = 0;
    foreach ($recent_bookings as $booking) {
        if ($booking['plan_name'] === $plan_title) {
            $booking_time = strtotime($booking['created_at']);
            if ($booking_time >= $cutoff_time) {
                $count++;
            }
        }
    }
    
    $results[$plan_title] = [
        "limit_reached" => ($count >= $max),
        "count" => $count,
        "max" => $max
    ];
}

echo json_encode(["status" => "success", "data" => $results]);
$conn->close();
?>
