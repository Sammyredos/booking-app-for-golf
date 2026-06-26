<?php
// Database configuration
$host = "localhost"; // Using persistent connection to act as connection pooling
$username = "bofiknigeria_smjuser"; // cPanel MySQL username
$password = "Balogunsmj.";          // cPanel MySQL password
$dbname = "bofiknigeria_smjgolf";   // cPanel Database Name

$conn = new mysqli($host, $username, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Connection failed: " . $conn->connect_error]));
}

$conn->set_charset("utf8mb4");

// Clerk Authentication
$CLERK_SECRET_KEY = "sk_test_FuUEU3gx1r44q8vQSdbn0lNHqTC8URPn1gdyegbT00";

// SMTP Configuration — Namecheap cPanel (premium99.web-hosting.com)
// Port 465 = SSL/TLS (recommended for Namecheap shared hosting)
// SMTP_USER and SMTP_FROM must be the same email address you created in cPanel.
// SMTP_PASS = the password you set for noreply@smjgyhd.com.ng in cPanel Email Accounts.
define('SMTP_HOST',     'premium99.web-hosting.com');
define('SMTP_PORT',     465);                          // SSL — use 587 for STARTTLS if 465 fails
define('SMTP_USER',     'noreply@smjgyhd.com.ng');    // Your cPanel email username
define('SMTP_PASS',     'Information123.');            // noreply@smjgyhd.com.ng
define('SMTP_FROM',     'noreply@smjgyhd.com.ng');
define('SMTP_FROM_NAME','SMJ Golf Academy');
?>