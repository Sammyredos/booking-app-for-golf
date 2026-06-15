<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $result = $conn->query("SELECT setting_key, setting_value FROM app_settings");
        $settings = [];
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                // Security: Do not expose the secret key to frontend fetching logic
                if ($row['setting_key'] === 'paystack_secret_key') continue;
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }
        echo json_encode(["status" => "success", "data" => $settings]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data || !is_array($data)) {
            echo json_encode(["status" => "error", "message" => "Invalid payload"]);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $conn->begin_transaction();
        try {
            foreach ($data as $key => $value) {
                $stmt->bind_param("ss", $key, $value);
                $stmt->execute();
            }
            $conn->commit();
            echo json_encode(["status" => "success", "message" => "Settings updated successfully"]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => "Failed to update settings"]);
        }
        $stmt->close();
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Method not allowed"]);
        break;
}

$conn->close();
?>
