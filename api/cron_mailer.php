<?php
// cron_mailer.php
// Run this script via cron job (e.g. every 5 minutes)
// Example cPanel cron: */5 * * * * php /home/USERNAME/public_html/api/cron_mailer.php

require_once __DIR__ . '/config.php';

/**
 * Send a plain-text email via authenticated SMTP over SSL (port 465).
 * Compatible with Namecheap/cPanel hosting (premium99.web-hosting.com).
 *
 * @param string $to      Recipient email address
 * @param string $subject Email subject
 * @param string $body    Plain-text email body
 * @return bool           true on success, false on failure
 */
function sendSmtpMail(string $to, string $subject, string $body): bool {
    $host     = SMTP_HOST;
    $port     = SMTP_PORT;
    $user     = SMTP_USER;
    $pass     = SMTP_PASS;
    $from     = SMTP_FROM;
    $fromName = SMTP_FROM_NAME;

    // Port 465 = SSL wrapper (ssl://), Port 587 = STARTTLS (tcp:// then upgrade)
    $transport = ($port === 465) ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";

    $errno  = 0;
    $errstr = '';
    $socket = @stream_socket_client($transport, $errno, $errstr, 15);

    if (!$socket) {
        error_log("cron_mailer: Cannot connect to SMTP [{$errno}] {$errstr}");
        return false;
    }

    stream_set_timeout($socket, 15);

    /**
     * Read one SMTP response. Returns [code, message].
     */
    $read = function () use ($socket): array {
        $response = '';
        while (!feof($socket)) {
            $line = fgets($socket, 512);
            if ($line === false) break;
            $response .= $line;
            // A line whose 4th char is a space (not dash) is the last in a multi-line reply
            if (strlen($line) >= 4 && $line[3] === ' ') break;
        }
        $code = (int) substr($response, 0, 3);
        return [$code, trim($response)];
    };

    /**
     * Send a command and read the response. Returns response code.
     */
    $cmd = function (string $command) use ($socket, $read): int {
        fwrite($socket, $command . "\r\n");
        [$code] = $read();
        return $code;
    };

    // Read greeting (220)
    [$code] = $read();
    if ($code !== 220) {
        fclose($socket);
        error_log("cron_mailer: Bad greeting: {$code}");
        return false;
    }

    // EHLO
    fwrite($socket, "EHLO " . gethostname() . "\r\n");
    // Drain multi-line EHLO
    while (!feof($socket)) {
        $line = fgets($socket, 512);
        if (!$line || (strlen($line) >= 4 && $line[3] === ' ')) break;
    }

    // If port 587, upgrade to TLS with STARTTLS
    if ($port === 587) {
        $code = $cmd("STARTTLS");
        if ($code !== 220) {
            fwrite($socket, "QUIT\r\n");
            fclose($socket);
            error_log("cron_mailer: STARTTLS failed: {$code}");
            return false;
        }
        // Upgrade the stream to TLS
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($socket);
            error_log("cron_mailer: TLS upgrade failed");
            return false;
        }
        // Re-issue EHLO after TLS upgrade
        fwrite($socket, "EHLO " . gethostname() . "\r\n");
        while (!feof($socket)) {
            $line = fgets($socket, 512);
            if (!$line || (strlen($line) >= 4 && $line[3] === ' ')) break;
        }
    }

    // AUTH LOGIN
    $code = $cmd("AUTH LOGIN");
    if ($code !== 334) {
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        error_log("cron_mailer: AUTH LOGIN not accepted: {$code}");
        return false;
    }

    // Send base64-encoded username
    $code = $cmd(base64_encode($user));
    if ($code !== 334) {
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        error_log("cron_mailer: Username rejected: {$code}");
        return false;
    }

    // Send base64-encoded password
    $code = $cmd(base64_encode($pass));
    if ($code !== 235) {
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        error_log("cron_mailer: Authentication failed (wrong password?): {$code}");
        return false;
    }

    // MAIL FROM
    $code = $cmd("MAIL FROM:<{$from}>");
    if ($code !== 250) {
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        error_log("cron_mailer: MAIL FROM rejected: {$code}");
        return false;
    }

    // RCPT TO
    $code = $cmd("RCPT TO:<{$to}>");
    if ($code !== 250 && $code !== 251) {
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        error_log("cron_mailer: RCPT TO rejected for {$to}: {$code}");
        return false;
    }

    // DATA
    $code = $cmd("DATA");
    if ($code !== 354) {
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        error_log("cron_mailer: DATA command rejected: {$code}");
        return false;
    }

    // Build RFC 2822 message
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $encodedFrom    = '=?UTF-8?B?' . base64_encode($fromName) . '?= <' . $from . '>';
    $messageId      = '<' . uniqid('smjgolf', true) . '@smjgyhd.com.ng>';

    $rawMessage  = "Date: " . date('r') . "\r\n";
    $rawMessage .= "From: {$encodedFrom}\r\n";
    $rawMessage .= "To: {$to}\r\n";
    $rawMessage .= "Subject: {$encodedSubject}\r\n";
    $rawMessage .= "Message-ID: {$messageId}\r\n";
    $rawMessage .= "MIME-Version: 1.0\r\n";
    $rawMessage .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $rawMessage .= "Content-Transfer-Encoding: 8bit\r\n";
    $rawMessage .= "\r\n";
    $rawMessage .= $body . "\r\n";
    $rawMessage .= ".\r\n"; // End of DATA

    fwrite($socket, $rawMessage);
    [$code] = $read();

    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    if ($code !== 250) {
        error_log("cron_mailer: Message not accepted by server: {$code}");
        return false;
    }

    return true;
}

// ---------------------------------------------------------------------------
// Fetch pending emails — up to 50 per run, skip permanently failed (3+ attempts)
// ---------------------------------------------------------------------------
$stmt = $conn->prepare(
    "SELECT id, user_id, user_email, subject, message, attempts
     FROM email_queue
     WHERE status = 'pending' AND attempts < 3
     LIMIT 50"
);
$stmt->execute();
$result = $stmt->get_result();

$pendingEmails = [];
while ($row = $result->fetch_assoc()) {
    $pendingEmails[] = $row;
}
$stmt->close();

if (empty($pendingEmails)) {
    echo "No pending emails.\n";
    $conn->close();
    exit;
}

$sentIds   = [];
$failedIds = [];

foreach ($pendingEmails as $emailTask) {
    $to      = $emailTask['user_email'];
    $subject = 'SMJ Golf Academy: ' . $emailTask['subject'];
    $body    = $emailTask['message'] . "\n\nRegards,\nSMJ Golf Academy Admin Team";

    // Increment attempt count before sending
    $upd = $conn->prepare("UPDATE email_queue SET attempts = attempts + 1 WHERE id = ?");
    $upd->bind_param('i', $emailTask['id']);
    $upd->execute();
    $upd->close();

    $mailSent = sendSmtpMail($to, $subject, $body);

    if ($mailSent) {
        $sentIds[] = $emailTask['id'];
    } else {
        $newAttempts = (int)$emailTask['attempts'] + 1;
        if ($newAttempts >= 3) {
            $failedIds[] = $emailTask['id']; // Give up after 3 attempts
        }
        // Otherwise leave as 'pending' so the next cron run retries
    }
}

// Batch update statuses
if (!empty($sentIds)) {
    $ids_str = implode(',', array_map('intval', $sentIds));
    $conn->query("UPDATE email_queue SET status = 'sent' WHERE id IN ($ids_str)");
}

if (!empty($failedIds)) {
    $ids_str = implode(',', array_map('intval', $failedIds));
    $conn->query("UPDATE email_queue SET status = 'failed' WHERE id IN ($ids_str)");
}

$successCount = count($sentIds);
$failCount    = count($failedIds);
echo "Processed " . count($pendingEmails) . " emails. Sent: {$successCount}, Permanently failed: {$failCount}.\n";

$conn->close();
?>
