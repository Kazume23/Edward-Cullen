<?php
declare(strict_types=1);

require __DIR__ . '/../config.php';

session_start();

function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

$userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
if ($userId <= 0) {
  json_response(['ok' => false, 'error' => 'unauthorized'], 401);
}

$pdo = pdo_db();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $stmt = $pdo->prepare('SELECT state_json, updated_at FROM user_state WHERE user_id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $row = $stmt->fetch();

  if (!$row || $row['state_json'] === null || $row['state_json'] === '') {
    json_response(['ok' => true, 'updatedAtMs' => 0, 'state' => null]);
  }

  $state = json_decode((string)$row['state_json'], true);
  if (!is_array($state)) $state = null;

  $updatedAtMs = 0;
  if (!empty($row['updated_at'])) {
    $ts = strtotime((string)$row['updated_at']);
    if ($ts !== false) $updatedAtMs = $ts * 1000;
  }

  json_response(['ok' => true, 'updatedAtMs' => $updatedAtMs, 'state' => $state]);
}

if ($method === 'POST') {
  $body = read_json_body();
  $state = $body['state'] ?? null;

  if (!is_array($state)) {
    json_response(['ok' => false, 'error' => 'bad_state'], 400);
  }

  $json = json_encode($state, JSON_UNESCAPED_UNICODE);

  $stmt = $pdo->prepare("
    INSERT INTO user_state (user_id, state_json)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      state_json = VALUES(state_json)
  ");
  $stmt->execute([$userId, $json]);

  $stmt2 = $pdo->prepare('SELECT updated_at FROM user_state WHERE user_id = ? LIMIT 1');
  $stmt2->execute([$userId]);
  $row = $stmt2->fetch();

  $updatedAtMs = 0;
  if ($row && !empty($row['updated_at'])) {
    $ts = strtotime((string)$row['updated_at']);
    if ($ts !== false) $updatedAtMs = $ts * 1000;
  }

  json_response(['ok' => true, 'updatedAtMs' => $updatedAtMs]);
}

json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
