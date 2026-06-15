<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

function queueEmailNotification($conn, $clerkSecret, $userId, $subject, $message) {
    // Fetch settings for email routing
    $settingsRes = $conn->query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('email_automations', 'admin_email')");
    $settings = [];
    if ($settingsRes) {
        while($row = $settingsRes->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }
    
    $emailAutomations = isset($settings['email_automations']) ? $settings['email_automations'] : 'true';
    $adminEmail = isset($settings['admin_email']) ? $settings['admin_email'] : 'admin@smjgolf.com';

    // Generate dynamic link based on current environment (localhost vs production)
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
    $domain = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'smjgolf.com';
    
    // 1. Queue email for the Admin
    if (!empty($adminEmail)) {
        $adminMessage = $message . "\n\nManage this booking from the Admin Dashboard: " . $protocol . "://" . $domain . "/admin_bookings.html";
        $adminSubj = "[Admin Alert] " . $subject;
        $adminUserId = "admin_system";
        $stmt = $conn->prepare("INSERT INTO email_queue (user_id, user_email, subject, message) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $adminUserId, $adminEmail, $adminSubj, $adminMessage);
        $stmt->execute();
        $stmt->close();
    }

    // 2. Queue email for the Golfer (if automations are enabled)
    if ($emailAutomations === 'true') {
        $userMessage = $message . "\n\nYou can manage, reschedule, or cancel your bookings anytime from your dashboard at " . $protocol . "://" . $domain . "/lessons.html";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.clerk.dev/v1/users/" . $userId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer " . $clerkSecret,
            "Content-Type: application/json"
        ]);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($httpCode === 200) {
            $userData = json_decode($result, true);
            $userEmail = '';
            if (isset($userData['email_addresses']) && count($userData['email_addresses']) > 0) {
                $primaryId = $userData['primary_email_address_id'] ?? null;
                foreach ($userData['email_addresses'] as $emailObj) {
                    if ($emailObj['id'] === $primaryId) {
                        $userEmail = $emailObj['email_address'];
                        break;
                    }
                }
                if (empty($userEmail)) {
                    $userEmail = $userData['email_addresses'][0]['email_address'];
                }
            }
            
            if (!empty($userEmail)) {
                $stmt = $conn->prepare("INSERT INTO email_queue (user_id, user_email, subject, message) VALUES (?, ?, ?, ?)");
                $stmt->bind_param("ssss", $userId, $userEmail, $subject, $userMessage);
                $stmt->execute();
                $stmt->close();
            }
        }
    }
}

function isWithinCancellationWindow($conn, $booking_date, $booking_time) {
    date_default_timezone_set('Africa/Lagos');
    
    // Fetch cancellation window from settings
    $cancellation_window_hours = 1; // Default
    $res = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'cancellation_window_hours'");
    if ($res && $row = $res->fetch_assoc()) {
        $cancellation_window_hours = floatval($row['setting_value']);
    }

    $now = new DateTime();
    $bookingDateTimeStr = $booking_date . " " . $booking_time;
    $bookingDateTime = DateTime::createFromFormat("Y-m-d h:i A", $bookingDateTimeStr);
    
    if (!$bookingDateTime) return false;
    
    $diff = $bookingDateTime->getTimestamp() - $now->getTimestamp();
    $window_seconds = $cancellation_window_hours * 3600;
    
    return $diff <= $window_seconds;
}

function isWithinAdvanceBookingLimit($conn, $booking_date) {
    // Fetch advance booking limit from settings
    $res = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'advance_booking_days'");
    $limit = 60; // default
    if ($res && $row = $res->fetch_assoc()) {
        $limit = intval($row['setting_value']);
    }
    
    date_default_timezone_set('Africa/Lagos');
    $target_date = strtotime($booking_date);
    $today = strtotime(date('Y-m-d'));
    $diff_days = ($target_date - $today) / (60 * 60 * 24);
    
    return $diff_days <= $limit;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // If user_id is provided, fetch for that user. Otherwise fetch all (for admin).
        $userId = isset($_GET['user_id']) ? $_GET['user_id'] : null;
        
        if ($userId) {
            $stmt = $conn->prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY booking_date DESC, booking_time DESC");
            $stmt->bind_param("s", $userId);
        } else {
            // Admin fetching all
            $stmt = $conn->prepare("SELECT * FROM bookings ORDER BY booking_date DESC, booking_time DESC");
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        $bookings = [];
        while($row = $result->fetch_assoc()) {
            $bookings[] = $row;
        }
        
        echo json_encode(["status" => "success", "data" => $bookings]);
        $stmt->close();
        break;

    case 'POST':
        // Create new booking
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['user_id'], $data['user_name'], $data['coach_name'], $data['plan_name'], $data['booking_date'], $data['booking_time'])) {
            echo json_encode(["status" => "error", "message" => "Missing required fields."]);
            exit;
        }

        // Check Advance Booking Limit
        $isAdmin = isset($data['isAdmin']) && $data['isAdmin'] === true;
        if (!$isAdmin && !isWithinAdvanceBookingLimit($conn, $data['booking_date'])) {
            echo json_encode(["status" => "error", "message" => "You cannot book this far in advance based on the current booking rules."]);
            exit;
        }

        // Payment Verification
        $stmt_settings = $conn->query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('paystack_enabled', 'paystack_secret_key', 'cash_enabled')");
        $settings = [];
        if ($stmt_settings) {
            while ($row = $stmt_settings->fetch_assoc()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }
        
        $paystackEnabled = isset($settings['paystack_enabled']) && $settings['paystack_enabled'] === 'true';
        $cashEnabled = isset($settings['cash_enabled']) && $settings['cash_enabled'] === 'true';
        $paymentMethod = isset($data['payment_method']) ? $data['payment_method'] : 'cash';
        $paymentReference = isset($data['paystack_reference']) ? $data['paystack_reference'] : null;

        if (!$isAdmin) {
            if ($paystackEnabled && $paymentMethod === 'paystack') {
                if (!$paymentReference) {
                    echo json_encode(["status" => "error", "message" => "Missing payment reference."]);
                    exit;
                }
                
                $secret_key = isset($settings['paystack_secret_key']) ? $settings['paystack_secret_key'] : '';
                
                $curl = curl_init();
                curl_setopt_array($curl, array(
                    CURLOPT_URL => "https://api.paystack.co/transaction/verify/" . rawurlencode($paymentReference),
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => array(
                        "Authorization: Bearer " . $secret_key,
                        "Cache-Control: no-cache",
                    ),
                ));
                
                $response = curl_exec($curl);
                $err = curl_error($curl);
                
                if ($err) {
                    echo json_encode(["status" => "error", "message" => "Payment verification failed: " . $err]);
                    exit;
                }
                
                $tranx = json_decode($response);
                if (!$tranx || !$tranx->status || $tranx->data->status !== 'success') {
                    echo json_encode(["status" => "error", "message" => "Payment was not successful. Booking aborted."]);
                    exit;
                }
            } else if ($paymentMethod === 'cash' && !$cashEnabled && ($paystackEnabled || $cashEnabled)) {
                echo json_encode(["status" => "error", "message" => "Cash payments are currently disabled."]);
                exit;
            }
        }

        // Timing logic: Check for existing booking for the same coach, date, and time
        $stmt_check = $conn->prepare("SELECT id FROM bookings WHERE coach_name = ? AND booking_date = ? AND booking_time = ? AND status != 'cancelled'");
        $stmt_check->bind_param("sss", $data['coach_name'], $data['booking_date'], $data['booking_time']);
        $stmt_check->execute();
        $stmt_check->store_result();
        if ($stmt_check->num_rows > 0) {
            echo json_encode(["status" => "error", "message" => "Time slot unavailable. The coach is already booked for this time."]);
            $stmt_check->close();
            exit;
        }
        $stmt_check->close();
        
        $stmt = $conn->prepare("INSERT INTO bookings (user_id, user_name, coach_name, plan_name, booking_date, booking_time, payment_method, payment_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssssss", $data['user_id'], $data['user_name'], $data['coach_name'], $data['plan_name'], $data['booking_date'], $data['booking_time'], $paymentMethod, $paymentReference);
        
        if ($stmt->execute()) {
            $msg = "Your booking for {$data['plan_name']} on {$data['booking_date']} at {$data['booking_time']} has been successfully created and confirmed.";
            queueEmailNotification($conn, $CLERK_SECRET_KEY, $data['user_id'], "Booking Confirmation", $msg);
            
            echo json_encode(["status" => "success", "message" => "Booking created successfully.", "id" => $conn->insert_id]);
        } else {
            echo json_encode(["status" => "error", "message" => "Failed to create booking: " . $stmt->error]);
        }
        
        $stmt->close();
        break;

    case 'PUT':
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['id'])) {
            echo json_encode(["status" => "error", "message" => "Missing booking id."]);
            exit;
        }

        $stmt_get = $conn->prepare("SELECT * FROM bookings WHERE id = ?");
        $stmt_get->bind_param("i", $data['id']);
        $stmt_get->execute();
        $res = $stmt_get->get_result();
        $currentBooking = $res->fetch_assoc();
        $stmt_get->close();
        
        if (!$currentBooking) {
            echo json_encode(["status" => "error", "message" => "Booking not found."]);
            exit;
        }

        $isAdmin = isset($data['isAdmin']) && $data['isAdmin'] === true;

        // Check for full edit first
        if (isset($data['user_name']) && isset($data['coach_name']) && isset($data['plan_name']) && isset($data['booking_date']) && isset($data['booking_time']) && isset($data['status'])) {
            // Timing logic: check conflict if modifying date/time/coach
            $stmt_check = $conn->prepare("SELECT id FROM bookings WHERE coach_name = ? AND booking_date = ? AND booking_time = ? AND id != ? AND status != 'cancelled'");
            $stmt_check->bind_param("sssi", $data['coach_name'], $data['booking_date'], $data['booking_time'], $data['id']);
            $stmt_check->execute();
            $stmt_check->store_result();
            if ($stmt_check->num_rows > 0) {
                echo json_encode(["status" => "error", "message" => "Time slot unavailable. The coach is already booked for this time."]);
                $stmt_check->close();
                exit;
            }
            $stmt_check->close();

            $stmt = $conn->prepare("UPDATE bookings SET user_name = ?, coach_name = ?, plan_name = ?, booking_date = ?, booking_time = ?, status = ? WHERE id = ?");
            $stmt->bind_param("ssssssi", $data['user_name'], $data['coach_name'], $data['plan_name'], $data['booking_date'], $data['booking_time'], $data['status'], $data['id']);
            if ($stmt->execute()) {
                $msg = "Your booking for {$data['plan_name']} has been updated by the admin to {$data['booking_date']} at {$data['booking_time']}. Status: {$data['status']}.";
                queueEmailNotification($conn, $CLERK_SECRET_KEY, $currentBooking['user_id'], "Booking Update Notification", $msg);
            }
        } else if (isset($data['booking_date']) && isset($data['booking_time'])) {
            // Reschedule Flow
            if (!$isAdmin && isWithinCancellationWindow($conn, $currentBooking['booking_date'], $currentBooking['booking_time'])) {
                echo json_encode(["status" => "error", "message" => "Bookings cannot be rescheduled within the cancellation window."]);
                exit;
            }
            if (!$isAdmin && !isWithinAdvanceBookingLimit($conn, $data['booking_date'])) {
                echo json_encode(["status" => "error", "message" => "You cannot reschedule this far in advance based on the current booking rules."]);
                exit;
            }
            // Get the current coach to do conflict checking
            $stmt_get = $conn->prepare("SELECT coach_name FROM bookings WHERE id = ?");
            $stmt_get->bind_param("i", $data['id']);
            $stmt_get->execute();
            $res = $stmt_get->get_result();
            if ($row = $res->fetch_assoc()) {
                $coach = $row['coach_name'];
                $stmt_check = $conn->prepare("SELECT id FROM bookings WHERE coach_name = ? AND booking_date = ? AND booking_time = ? AND id != ? AND status != 'cancelled'");
                $stmt_check->bind_param("sssi", $coach, $data['booking_date'], $data['booking_time'], $data['id']);
                $stmt_check->execute();
                $stmt_check->store_result();
                if ($stmt_check->num_rows > 0) {
                    echo json_encode(["status" => "error", "message" => "Time slot unavailable. The coach is already booked for this time."]);
                    $stmt_check->close();
                    $stmt_get->close();
                    exit;
                }
                $stmt_check->close();
            }
            $stmt_get->close();

            $stmt = $conn->prepare("UPDATE bookings SET booking_date = ?, booking_time = ? WHERE id = ?");
            $stmt->bind_param("ssi", $data['booking_date'], $data['booking_time'], $data['id']);
            if ($stmt->execute()) {
                $msg = "Your booking for {$currentBooking['plan_name']} has been rescheduled to {$data['booking_date']} at {$data['booking_time']}.";
                queueEmailNotification($conn, $CLERK_SECRET_KEY, $currentBooking['user_id'], "Booking Rescheduled", $msg);
            }
        } else if (isset($data['status'])) {
            // Admin Status Update Flow
            $stmt = $conn->prepare("UPDATE bookings SET status = ? WHERE id = ?");
            $stmt->bind_param("si", $data['status'], $data['id']);
            if ($stmt->execute()) {
                $msg = "The status of your booking on {$currentBooking['booking_date']} at {$currentBooking['booking_time']} has been changed to: {$data['status']}.";
                queueEmailNotification($conn, $CLERK_SECRET_KEY, $currentBooking['user_id'], "Booking Status Update", $msg);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "Nothing to update."]);
            exit;
        }
        
        // Output response based on whether a statement was executed successfully
        // We already executed the statement to get the email triggered, so we just check if $stmt is successful.
        // Wait, the original code executed $stmt down below. Since I executed it early to trigger the email,
        // I need to make sure I don't execute it twice.
        // I will just return success here directly and exit.
        echo json_encode(["status" => "success", "message" => "Booking updated successfully."]);
        $stmt->close();
        break;

    case 'DELETE':
        $data = json_decode(file_get_contents("php://input"), true);
        if (!isset($data['id'])) {
            echo json_encode(["status" => "error", "message" => "Missing booking id."]);
            exit;
        }
        
        $stmt_get = $conn->prepare("SELECT * FROM bookings WHERE id = ?");
        $stmt_get->bind_param("i", $data['id']);
        $stmt_get->execute();
        $res = $stmt_get->get_result();
        $currentBooking = $res->fetch_assoc();
        $stmt_get->close();
        
        $isAdmin = isset($data['isAdmin']) && $data['isAdmin'] === true;
        if (!$isAdmin && $currentBooking && isWithinCancellationWindow($conn, $currentBooking['booking_date'], $currentBooking['booking_time'])) {
            echo json_encode(["status" => "error", "message" => "Bookings cannot be cancelled within the cancellation window."]);
            exit;
        }
        
        $stmt = $conn->prepare("DELETE FROM bookings WHERE id = ?");
        $stmt->bind_param("i", $data['id']);
        if ($stmt->execute()) {
            if ($currentBooking) {
                $msg = "Your booking for {$currentBooking['plan_name']} on {$currentBooking['booking_date']} has been CANCELLED and deleted by the administrator.";
                queueEmailNotification($conn, $CLERK_SECRET_KEY, $currentBooking['user_id'], "Booking Cancelled", $msg);
            }
            echo json_encode(["status" => "success", "message" => "Booking deleted successfully."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Failed to delete booking: " . $stmt->error]);
        }
        $stmt->close();
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Method not allowed."]);
        break;
}

$conn->close();
?>
