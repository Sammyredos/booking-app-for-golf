<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $conn->prepare("SELECT * FROM plans ORDER BY id ASC");
        $stmt->execute();
        $result = $stmt->get_result();
        
        $plans = [];
        while($row = $result->fetch_assoc()) {
            $row['features'] = json_decode($row['features'], true);
            $row['is_premium'] = (bool)$row['is_premium'];
            $plans[] = $row;
        }
        
        echo json_encode(["status" => "success", "data" => $plans]);
        $stmt->close();
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['category'], $data['title'], $data['price'], $data['duration'], $data['features'])) {
            echo json_encode(["status" => "error", "message" => "Missing required fields."]);
            exit;
        }

        $featuresJson = json_encode($data['features']);
        $isPremium = isset($data['is_premium']) ? (int)$data['is_premium'] : 0;
        
        $stmt = $conn->prepare("INSERT INTO plans (category, title, price, duration, features, is_premium) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssissi", $data['category'], $data['title'], $data['price'], $data['duration'], $featuresJson, $isPremium);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Plan added successfully", "id" => $conn->insert_id]);
        } else {
            echo json_encode(["status" => "error", "message" => "Database error: " . $stmt->error]);
        }
        $stmt->close();
        break;

    case 'DELETE':
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['id'])) {
            echo json_encode(["status" => "error", "message" => "Missing plan ID."]);
            exit;
        }
        
        $stmt = $conn->prepare("DELETE FROM plans WHERE id = ?");
        $stmt->bind_param("i", $data['id']);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Plan deleted successfully"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Database error: " . $stmt->error]);
        }
        $stmt->close();
        break;

    case 'PUT':
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['id'], $data['category'], $data['title'], $data['price'], $data['duration'], $data['features'])) {
            echo json_encode(["status" => "error", "message" => "Missing required fields."]);
            exit;
        }

        $featuresJson = json_encode($data['features']);
        $isPremium = isset($data['is_premium']) ? (int)$data['is_premium'] : 0;
        
        $stmt = $conn->prepare("UPDATE plans SET category = ?, title = ?, price = ?, duration = ?, features = ?, is_premium = ? WHERE id = ?");
        $stmt->bind_param("ssissii", $data['category'], $data['title'], $data['price'], $data['duration'], $featuresJson, $isPremium, $data['id']);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Plan updated successfully"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Database error: " . $stmt->error]);
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
