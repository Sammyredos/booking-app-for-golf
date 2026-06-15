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
$res = $conn->query("SELECT title, max_sessions, validity_days FROM plans WHERE max_sessions IS NOT NULL AND validity_days IS NOT NULL");
if ($res) {
    while($row = $res->fetch_assoc()) {
        $limits[] = $row;
    }
}

$results = [];

// 2. For each limited plan, count the user's recent bookings
foreach ($limits as $limit) {
    $plan_title = $limit['title'];
    $max = (int)$limit['max_sessions'];
    $days = (int)$limit['validity_days'];
    
    // Count bookings for this plan in the last X days
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND plan_name = ? AND status != 'cancelled' AND created_at >= NOW() - INTERVAL ? DAY");
    $stmt->bind_param("ssi", $user_id, $plan_title, $days);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $count = (int)$row['count'];
    $stmt->close();
    
    $results[$plan_title] = [
        "limit_reached" => ($count >= $max),
        "count" => $count,
        "max" => $max
    ];
}

echo json_encode(["status" => "success", "data" => $results]);
$conn->close();
?>
