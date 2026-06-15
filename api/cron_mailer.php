<?php
// cron_mailer.php
// Run this script via cron job (e.g. every 5 minutes)
// * * * * * php /path/to/api/cron_mailer.php

require_once __DIR__ . '/config.php';

// Fetch pending emails
$stmt = $conn->prepare("SELECT * FROM email_queue WHERE status = 'pending' LIMIT 50");
$stmt->execute();
$result = $stmt->get_result();

$pendingEmails = [];
while ($row = $result->fetch_assoc()) {
    $pendingEmails[] = $row;
}
$stmt->close();

if (empty($pendingEmails)) {
    echo "No pending emails.\n";
    exit;
}

$res = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'admin_email'");
$admin_email = 'noreply@smjgolf.com';
if ($res && $row = $res->fetch_assoc()) {
    $admin_email = !empty($row['setting_value']) ? $row['setting_value'] : 'noreply@smjgolf.com';
}

$successCount = 0;
$failCount = 0;

foreach ($pendingEmails as $emailTask) {
    $to = $emailTask['user_email'];
    $subject = "SMJ Golf Academy: " . $emailTask['subject'];
    $message = $emailTask['message'] . "\n\nRegards,\nSMJ Golf Academy Admin Team";
    
    // Headers for standard PHP mail using admin's email as sender
    $headers = "From: " . $admin_email . "\r\n";
    $headers .= "Reply-To: " . $admin_email . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    // Attempt to send
    // NOTE: On local XAMPP this might return false if sendmail isn't configured.
    $mailSent = @mail($to, $subject, $message, $headers);

    if ($mailSent) {
        $updateStmt = $conn->prepare("UPDATE email_queue SET status = 'sent' WHERE id = ?");
        $updateStmt->bind_param("i", $emailTask['id']);
        $updateStmt->execute();
        $updateStmt->close();
        $successCount++;
    } else {
        // If mail fails, mark as failed so it doesn't get stuck forever
        $updateStmt = $conn->prepare("UPDATE email_queue SET status = 'failed' WHERE id = ?");
        $updateStmt->bind_param("i", $emailTask['id']);
        $updateStmt->execute();
        $updateStmt->close();
        $failCount++;
    }
}

echo "Processed " . count($pendingEmails) . " emails. Success: $successCount, Failed: $failCount.\n";

$conn->close();
?>
