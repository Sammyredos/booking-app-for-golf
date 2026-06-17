<?php
require_once 'config.php';

function verifyAuth($requireAdmin = false) {
    global $CLERK_SECRET_KEY;
    
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Unauthorized: Missing or invalid Authorization header"]);
        exit;
    }
    
    $token = $matches[1];
    $tokenParts = explode('.', $token);
    if (count($tokenParts) !== 3) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Unauthorized: Malformed token"]);
        exit;
    }
    
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
    if (!$payload || !isset($payload['sid']) || !isset($payload['sub'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Unauthorized: Invalid token payload"]);
        exit;
    }
    
    $sessionId = $payload['sid'];
    $userId = $payload['sub'];
    
    // Call Clerk API to verify session
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://api.clerk.com/v1/sessions/" . $sessionId);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $CLERK_SECRET_KEY,
        "Content-Type: application/json"
    ]);
    
    $sessionRes = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($httpCode !== 200) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Unauthorized: Clerk session verification failed"]);
        exit;
    }
    
    $sessionData = json_decode($sessionRes, true);
    // Allow both active and pending as seen in previous fix.
    if (!isset($sessionData['status']) || !in_array($sessionData['status'], ['active', 'pending']) || $sessionData['user_id'] !== $userId) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Unauthorized: Session is inactive or invalid"]);
        exit;
    }
    
    // Always fetch user metadata to determine role
    $chUser = curl_init();
    curl_setopt($chUser, CURLOPT_URL, "https://api.clerk.com/v1/users/" . $userId);
    curl_setopt($chUser, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($chUser, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $CLERK_SECRET_KEY,
        "Content-Type: application/json"
    ]);
    $userRes = curl_exec($chUser);
    $userHttpCode = curl_getinfo($chUser, CURLINFO_HTTP_CODE);
    
    if ($userHttpCode !== 200) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Unauthorized: Failed to fetch user metadata"]);
        exit;
    }
    
    $userData = json_decode($userRes, true);
    $role = $userData['public_metadata']['role'] ?? '';
    $isAdmin = ($role === 'admin');
    
    if ($requireAdmin && !$isAdmin) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Forbidden: Admin privileges required"]);
        exit;
    }
    
    return [
        'user_id' => $userId,
        'session_id' => $sessionId,
        'is_admin' => $isAdmin
    ];
}
?>
