<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';
require_once 'verify_auth.php';

// Only admins can view or modify clients
$auth = verifyAuth(true);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 100;
        $offset = ($page - 1) * $limit;
        
        // 1. Fetch Users from Clerk API
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.clerk.com/v1/users?limit={$limit}&offset={$offset}");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            "Authorization: Bearer " . $CLERK_SECRET_KEY,
            "Content-Type: application/json"
        ));
        
        $clerkResponse = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        $clerkUsers = [];
        if ($httpCode === 200 && $clerkResponse) {
            $clerkUsers = json_decode($clerkResponse, true);
        }

        // 2. Fetch Booking Stats from Local Database
        $stmt = $conn->prepare("
            SELECT user_id, COUNT(*) as total_bookings, MAX(created_at) as last_active 
            FROM bookings 
            GROUP BY user_id
        ");
        $stmt->execute();
        $result = $stmt->get_result();
        
        $bookingStats = [];
        while($row = $result->fetch_assoc()) {
            $bookingStats[$row['user_id']] = $row;
        }
        $stmt->close();

        // 3. Combine Data
        $finalCustomers = [];
        
        if (is_array($clerkUsers)) {
            foreach ($clerkUsers as $user) {
                // Parse Name
                $firstName = $user['first_name'] ?? '';
                $lastName = $user['last_name'] ?? '';
                $fullName = trim($firstName . ' ' . $lastName);
                if (empty($fullName)) {
                    $fullName = "Unnamed User";
                }

                // Parse Email
                $email = '';
                if (isset($user['email_addresses']) && count($user['email_addresses']) > 0) {
                    $email = $user['email_addresses'][0]['email_address'];
                }

                $userId = $user['id'];
                
                // Get local stats
                $stats = $bookingStats[$userId] ?? null;
                $totalBookings = $stats ? (int)$stats['total_bookings'] : 0;
                
                // For last active, use booking date if exists, otherwise fallback to clerk created_at
                $lastActive = $stats ? $stats['last_active'] : date('Y-m-d H:i:s', $user['created_at'] / 1000);

                $finalCustomers[] = [
                    "user_id" => $userId,
                    "name" => $fullName,
                    "email" => $email,
                    "total_bookings" => $totalBookings,
                    "last_active" => $lastActive,
                    "joined_at" => date('Y-m-d H:i:s', $user['created_at'] / 1000)
                ];
            }
        }

        // Sort by last active descending
        usort($finalCustomers, function($a, $b) {
            return strtotime($b['last_active']) - strtotime($a['last_active']);
        });
        
        echo json_encode(["status" => "success", "data" => $finalCustomers]);
        break;

    case 'DELETE':
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['user_id'])) {
            echo json_encode(["status" => "error", "message" => "Missing user ID."]);
            exit;
        }
        
        // Wipe all bookings for this user to effectively 'delete' them from the dashboard
        $stmt = $conn->prepare("DELETE FROM bookings WHERE user_id = ?");
        $stmt->bind_param("s", $data['user_id']);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "User data deleted successfully."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Failed to delete user."]);
        }
        $stmt->close();
        break;

    default:
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Method not allowed"]);
        break;
}
$conn->close();
?>
