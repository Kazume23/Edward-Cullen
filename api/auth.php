<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';

session_start();

function redirect_to_index(string $qs = ''): void {
  header('Location: ../index.php' . $qs);
  exit;
}

function csrf_ok(): bool {
  $token = $_POST['csrf'] ?? '';
  if (!is_string($token)) return false;
  if (!isset($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) return false;
  return hash_equals($_SESSION['csrf'], $token);
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'logout') {
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool)$params['secure'], (bool)$params['httponly']);
  }
  session_destroy();
  redirect_to_index();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  redirect_to_index();
}

$mode = $_POST['mode'] ?? 'login';
if (!is_string($mode)) $mode = 'login';

if (!csrf_ok()) {
  if ($mode === 'register') redirect_to_index('?register_err=csrf');
  redirect_to_index('?login_err=csrf');
}

$username = trim((string)($_POST['username'] ?? ''));
$password = (string)($_POST['password'] ?? '');

$pdo = pdo_db();
ensure_schema($pdo);

if ($mode === 'register') {
  $password2 = (string)($_POST['password2'] ?? '');

  if (!preg_match('/^[A-Za-z0-9_]{3,50}$/', $username)) {
    redirect_to_index('?register_err=invalid_user');
  }

  if (strlen($password) < 6) {
    redirect_to_index('?register_err=weak_pass');
  }

  if ($password !== $password2) {
    redirect_to_index('?register_err=mismatch');
  }

  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
  $stmt->execute([$username]);
  if ($stmt->fetchColumn()) {
    redirect_to_index('?register_err=taken');
  }

  $hash = password_hash($password, PASSWORD_DEFAULT);
  $stmt = $pdo->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  $ok = $stmt->execute([$username, $hash]);

  if (!$ok) {
    redirect_to_index('?register_err=server');
  }

  $userId = (int)$pdo->lastInsertId();
  session_regenerate_id(true);
  $_SESSION['user_id'] = $userId;
  $_SESSION['username'] = $username;

  redirect_to_index();
}

$stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row || !password_verify($password, (string)$row['password_hash'])) {
  redirect_to_index('?login_err=bad');
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int)$row['id'];
$_SESSION['username'] = $username;

redirect_to_index();
