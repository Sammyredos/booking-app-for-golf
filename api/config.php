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
?>