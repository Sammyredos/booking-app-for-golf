<?php
// Turn on error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('CRON_SECRET', 'smjgolf_mailer_2026');

$isCli  = (php_sapi_name() === 'cli');
$isWeb  = !$isCli;

if ($isWeb) {
    $providedKey = isset($_GET['key']) ? $_GET['key'] : '';
    if ($providedKey !== CRON_SECRET) {
        http_response_code(403);
        exit('Forbidden');
    }
    header('Content-Type: text/plain; charset=utf-8');
}

// Ensure config file exists
if (!file_exists(__DIR__ . '/config.php')) {
    die("Error: config.php not found in " . __DIR__);
}

require_once __DIR__ . '/config.php';

if (!$conn) {
    die("Error: Database connection is not established.");
}

$result = $conn->query("SELECT * FROM email_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20");

if (!$result) {
    die("Error querying email_queue: " . $conn->error);
}

if ($result->num_rows === 0) {
    echo "No pending emails.\n";
    $conn->close();
    exit;
}

$rows = array();
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

echo "Processing " . count($rows) . " email(s)...\n";

foreach ($rows as $email) {
    $id      = (int) $email['id'];
    $to      = $email['user_email'];
    $subject = $email['subject'];
    $body    = $email['message'];

    // Convert newlines to paragraphs
    $htmlBody = "";
    $paragraphs = explode("\n\n", $body);
    foreach ($paragraphs as $p) {
        if (trim($p) !== '') {
            $htmlBody .= "<p style='margin-bottom: 16px; line-height: 1.6; color: #333333;'>" . nl2br(htmlspecialchars(trim($p), ENT_QUOTES, 'UTF-8')) . "</p>";
        }
    }
    
    // Beautiful HTML Template
    $message = "
    <!DOCTYPE html>
    <html lang='en'>
    <head>
      <meta charset='UTF-8'>
      <meta name='viewport' content='width=device-width, initial-scale=1.0'>
      <title>" . htmlspecialchars($subject) . "</title>
    </head>
    <body style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; color: #111111; background-color: #f4f6f3; padding: 40px 20px; margin: 0;'>
      
      <table width='100%' border='0' cellspacing='0' cellpadding='0' style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #eaeaea;'>
        
        <!-- Header -->
        <tr>
          <td align='center' style='background-color: #0b1319; padding: 40px 20px; border-bottom: 4px solid #cfff3d;'>
            <img src='https://www.smjgyhd.com.ng/assets/logo.png' alt='SMJ Golf Academy' style='max-height: 60px; width: auto; display: block;' />
          </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
          <td style='padding: 40px 30px;'>
            <h2 style='margin-top: 0; margin-bottom: 24px; color: #0b1319; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: -0.02em;'>
              " . htmlspecialchars($subject) . "
            </h2>
            
            " . $htmlBody . "
            
            <div style='margin-top: 40px; text-align: center;'>
              <a href='https://www.smjgyhd.com.ng/lessons.html' style='display: inline-block; background-color: #cfff3d; color: #0b1319; padding: 14px 28px; text-decoration: none; font-weight: 700; text-transform: uppercase; border: 2px solid #0b1319; letter-spacing: 0.5px;'>
                Go to Dashboard
              </a>
            </div>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style='background-color: #f4f6f3; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;'>
            <p style='margin: 0 0 10px 0; font-size: 14px; color: #111111; font-weight: 700; text-transform: uppercase;'>SMJ Golf Academy</p>
            <p style='margin: 0 0 10px 0; font-size: 13px; color: #6b7280;'>Ikoyi Club 1938, Lagos, Nigeria</p>
            <p style='margin: 0; font-size: 12px; color: #9ca3af; font-weight: bold;'>GET YOUR HANDICAP DOWN.</p>
          </td>
        </tr>
        
      </table>
      
    </body>
    </html>
    ";

    // Headers for HTML email
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8\r\n";
    $headers .= "From: " . SMTP_FROM_NAME . " <" . SMTP_FROM . ">\r\n";
    $headers .= "Reply-To: " . SMTP_FROM . "\r\n";

    // Send email using native mail() function
    $sent = mail($to, $subject, $message, $headers);

    if ($sent) {
        $conn->query("UPDATE email_queue SET status = 'sent' WHERE id = $id");
        echo "[OK]   #" . $id . " -> " . $to . " | " . $subject . "\n";
    } else {
        $conn->query("UPDATE email_queue SET status = 'failed' WHERE id = $id");
        echo "[FAIL] #" . $id . " -> " . $to . " | Native mail() failed\n";
    }
}

$conn->close();
echo "Done.\n";
?>
