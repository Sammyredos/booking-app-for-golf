<?php
require 'api/config.php';
$res = $conn->query('SELECT * FROM plans');
while($row = $res->fetch_assoc()) echo json_encode($row)."\n";
