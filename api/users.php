<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

// Fetch users from Clerk
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://api.clerk.dev/v1/users?limit=100");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer " . $CLERK_SECRET_KEY,
    "Content-Type: application/json"
]);
$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($httpCode === 200) {
    $clerkUsers = json_decode($result, true);
    $users = [];
    
    foreach ($clerkUsers as $u) {
        $firstName = $u['first_name'] ?? '';
        $lastName = $u['last_name'] ?? '';
        $fullName = trim($firstName . ' ' . $lastName);
        if (empty($fullName)) {
            // fallback if name is empty
            $fullName = "User " . substr($u['id'], -4);
        }
        
        $email = '';
        if (isset($u['email_addresses']) && count($u['email_addresses']) > 0) {
            $primaryId = $u['primary_email_address_id'] ?? null;
            foreach ($u['email_addresses'] as $em) {
                if ($em['id'] === $primaryId) {
                    $email = $em['email_address'];
                    break;
                }
            }
            if (empty($email)) {
                $email = $u['email_addresses'][0]['email_address'];
            }
        }
        
        $users[] = [
            'id' => $u['id'],
            'name' => $fullName,
            'email' => $email
        ];
    }
    
    echo json_encode(["status" => "success", "data" => $users]);
} else {
    echo json_encode(["status" => "error", "message" => "Failed to fetch users from Clerk."]);
}
?>
