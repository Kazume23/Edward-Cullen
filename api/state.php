<?php
declare(strict_types=1);

require __DIR__ . '/../config.php';

function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function validate_client_id(string $id): bool {
  if ($id === '') return false;
  if (strlen($id) > 64) return false;
  return (bool)preg_match('/^[a-zA-Z0-9_]+$/', $id);
}

function ensure_client(PDO $pdo, string $clientId): void {
  $pdo->prepare('INSERT IGNORE INTO clients (client_id) VALUES (?)')->execute([$clientId]);
  $pdo->prepare('INSERT IGNORE INTO state_meta (client_id, updated_at_ms) VALUES (?, 0)')->execute([$clientId]);
}

function get_meta_ms(PDO $pdo, string $clientId): int {
  $stmt = $pdo->prepare('SELECT updated_at_ms FROM state_meta WHERE client_id = ? LIMIT 1');
  $stmt->execute([$clientId]);
  $row = $stmt->fetch();
  return $row ? (int)$row['updated_at_ms'] : 0;
}

function build_state(PDO $pdo, string $clientId, int $metaMs): array {
  $state = [];

  $state['_meta'] = [
    'clientId' => $clientId,
    'updatedAtMs' => $metaMs,
  ];

  $state['habits'] = [];
  $stmt = $pdo->prepare('SELECT id, name FROM habits WHERE client_id = ? ORDER BY created_at_ms ASC');
  $stmt->execute([$clientId]);
  foreach ($stmt->fetchAll() as $r) {
    $state['habits'][] = ['id' => $r['id'], 'name' => $r['name']];
  }

  $state['entries'] = [];
  $stmt = $pdo->prepare('SELECT habit_id, date_iso, value FROM habit_entries WHERE client_id = ?');
  $stmt->execute([$clientId]);
  foreach ($stmt->fetchAll() as $r) {
    $key = $r['habit_id'] . '|' . $r['date_iso'];
    $state['entries'][$key] = (int)$r['value'];
  }

  $state['todos'] = [];
  $stmt = $pdo->prepare('SELECT id, date_iso, text, priority, done, created_at_ms FROM todos WHERE client_id = ? ORDER BY created_at_ms ASC');
  $stmt->execute([$clientId]);
  foreach ($stmt->fetchAll() as $r) {
    $state['todos'][] = [
      'id' => $r['id'],
      'dateISO' => $r['date_iso'],
      'text' => $r['text'],
      'priority' => $r['priority'],
      'done' => (bool)$r['done'],
      'createdAt' => (int)$r['created_at_ms'],
    ];
  }

  $state['expenses'] = [];
  $stmt = $pdo->prepare('SELECT id, date_iso, amount, what, category, score, period, created_at_ms FROM expenses WHERE client_id = ? ORDER BY created_at_ms ASC');
  $stmt->execute([$clientId]);
  foreach ($stmt->fetchAll() as $r) {
    $state['expenses'][] = [
      'id' => $r['id'],
      'dateISO' => $r['date_iso'],
      'amount' => (float)$r['amount'],
      'what' => $r['what'],
      'category' => $r['category'],
      'score' => $r['score'],
      'period' => $r['period'],
      'createdAt' => (int)$r['created_at_ms'],
    ];
  }

  $state['wishlist'] = [];
  $stmt = $pdo->prepare('SELECT id, name, price, created_at_ms FROM wishlist WHERE client_id = ? ORDER BY created_at_ms ASC');
  $stmt->execute([$clientId]);
  foreach ($stmt->fetchAll() as $r) {
    $price = $r['price'];
    $state['wishlist'][] = [
      'id' => $r['id'],
      'name' => $r['name'],
      'price' => ($price === null) ? null : (float)$price,
      'createdAt' => (int)$r['created_at_ms'],
    ];
  }

  $state['pomodoro'] = null;
  $stmt = $pdo->prepare('SELECT * FROM pomodoro WHERE client_id = ? LIMIT 1');
  $stmt->execute([$clientId]);
  $p = $stmt->fetch();
  if ($p) {
    $state['pomodoro'] = [
      'mode' => $p['mode'],
      'durationsMin' => [
        'focus' => (int)$p['focus_min'],
        'break' => (int)$p['break_min'],
        'long' => (int)$p['long_min'],
      ],
      'remainingByMode' => [
        'focus' => (int)$p['rem_focus_sec'],
        'break' => (int)$p['rem_break_sec'],
        'long' => (int)$p['rem_long_sec'],
      ],
      'remainingSec' => (int)$p['remaining_sec'],
      'isRunning' => (bool)$p['is_running'],
      'lastTick' => (int)$p['last_tick_ms'],
      'session' => (int)$p['session'],
    ];
  }

  $stmt = $pdo->prepare('SELECT * FROM ui_prefs WHERE client_id = ? LIMIT 1');
  $stmt->execute([$clientId]);
  $u = $stmt->fetch();

  $state['selectedDate'] = $u && $u['selected_date'] ? $u['selected_date'] : date('Y-m-d');
  $state['viewMonth'] = $u && $u['view_month'] !== null ? (int)$u['view_month'] : (int)date('n') - 1;
  $state['viewYear'] = $u && $u['view_year'] !== null ? (int)$u['view_year'] : (int)date('Y');
  $state['chartMode'] = $u ? (string)$u['chart_mode'] : 'week';
  $state['wishSortMode'] = $u ? (string)$u['wish_sort_mode'] : 'date-desc';
  $state['expFilterCategory'] = $u ? (string)$u['exp_filter_category'] : '';

  return $state;
}

function normalize_date_iso(string $s): ?string {
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return null;
  return $s;
}

function apply_full_state(PDO $pdo, string $clientId, array $state, int $incomingMs): void {
  ensure_client($pdo, $clientId);

  $habits = isset($state['habits']) && is_array($state['habits']) ? $state['habits'] : [];
  $entries = isset($state['entries']) && is_array($state['entries']) ? $state['entries'] : [];
  $todos = isset($state['todos']) && is_array($state['todos']) ? $state['todos'] : [];
  $expenses = isset($state['expenses']) && is_array($state['expenses']) ? $state['expenses'] : [];
  $wishlist = isset($state['wishlist']) && is_array($state['wishlist']) ? $state['wishlist'] : [];
  $pomodoro = isset($state['pomodoro']) && is_array($state['pomodoro']) ? $state['pomodoro'] : null;

  $selectedDate = isset($state['selectedDate']) ? (string)$state['selectedDate'] : date('Y-m-d');
  $selectedDate = normalize_date_iso($selectedDate) ?? date('Y-m-d');

  $viewMonth = isset($state['viewMonth']) ? (int)$state['viewMonth'] : ((int)date('n') - 1);
  $viewYear = isset($state['viewYear']) ? (int)$state['viewYear'] : (int)date('Y');
  $chartMode = isset($state['chartMode']) && $state['chartMode'] === 'month' ? 'month' : 'week';
  $wishSortMode = isset($state['wishSortMode']) ? (string)$state['wishSortMode'] : 'date-desc';
  $expFilterCategory = isset($state['expFilterCategory']) ? (string)$state['expFilterCategory'] : '';

  $pdo->prepare('DELETE FROM habit_entries WHERE client_id = ?')->execute([$clientId]);
  $pdo->prepare('DELETE FROM habits WHERE client_id = ?')->execute([$clientId]);
  $pdo->prepare('DELETE FROM todos WHERE client_id = ?')->execute([$clientId]);
  $pdo->prepare('DELETE FROM expenses WHERE client_id = ?')->execute([$clientId]);
  $pdo->prepare('DELETE FROM wishlist WHERE client_id = ?')->execute([$clientId]);

  if (count($habits) > 0) {
    $stmt = $pdo->prepare('INSERT INTO habits (id, client_id, name, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?)');
    foreach ($habits as $h) {
      if (!is_array($h)) continue;
      $id = isset($h['id']) ? (string)$h['id'] : '';
      $name = isset($h['name']) ? trim((string)$h['name']) : '';
      if ($id === '' || $name === '') continue;
      $stmt->execute([$id, $clientId, $name, $incomingMs, $incomingMs]);
    }
  }

  if (count($entries) > 0) {
    $stmt = $pdo->prepare('INSERT INTO habit_entries (client_id, habit_id, date_iso, value, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($entries as $k => $v) {
      $k = (string)$k;
      $parts = explode('|', $k, 2);
      if (count($parts) !== 2) continue;
      $habitId = $parts[0];
      $dateIso = normalize_date_iso($parts[1]);
      if ($habitId === '' || $dateIso === null) continue;
      $val = (int)$v;
      if ($val !== 1 && $val !== -1) continue;
      $stmt->execute([$clientId, $habitId, $dateIso, $val, $incomingMs, $incomingMs]);
    }
  }

  if (count($todos) > 0) {
    $stmt = $pdo->prepare('INSERT INTO todos (id, client_id, date_iso, text, priority, done, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($todos as $t) {
      if (!is_array($t)) continue;
      $id = isset($t['id']) ? (string)$t['id'] : '';
      $dateIso = isset($t['dateISO']) ? normalize_date_iso((string)$t['dateISO']) : null;
      $text = isset($t['text']) ? trim((string)$t['text']) : '';
      $priority = isset($t['priority']) ? (string)$t['priority'] : 'medium';
      $done = isset($t['done']) ? (int)((bool)$t['done']) : 0;
      $createdAt = isset($t['createdAt']) ? (int)$t['createdAt'] : $incomingMs;

      if ($id === '' || $dateIso === null || $text === '') continue;
      if ($priority !== 'high' && $priority !== 'medium' && $priority !== 'low') $priority = 'medium';

      $stmt->execute([$id, $clientId, $dateIso, $text, $priority, $done, $createdAt, $incomingMs]);
    }
  }

  if (count($expenses) > 0) {
    $stmt = $pdo->prepare('INSERT INTO expenses (id, client_id, date_iso, amount, what, category, score, period, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($expenses as $e) {
      if (!is_array($e)) continue;
      $id = isset($e['id']) ? (string)$e['id'] : '';
      $dateIso = isset($e['dateISO']) ? normalize_date_iso((string)$e['dateISO']) : null;
      $amount = isset($e['amount']) ? (float)$e['amount'] : 0.0;
      $what = isset($e['what']) ? trim((string)$e['what']) : '';
      $category = isset($e['category']) ? (string)$e['category'] : '';
      $score = isset($e['score']) ? (string)$e['score'] : '';
      $period = isset($e['period']) ? (string)$e['period'] : 'once';
      $createdAt = isset($e['createdAt']) ? (int)$e['createdAt'] : $incomingMs;

      if ($id === '' || $dateIso === null || $what === '') continue;
      if ($amount < 0) $amount = 0.0;
      if (!in_array($period, ['once','weekly','monthly','yearly'], true)) $period = 'once';

      $stmt->execute([$id, $clientId, $dateIso, $amount, $what, $category, $score, $period, $createdAt, $incomingMs]);
    }
  }

  if (count($wishlist) > 0) {
    $stmt = $pdo->prepare('INSERT INTO wishlist (id, client_id, name, price, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($wishlist as $w) {
      if (!is_array($w)) continue;
      $id = isset($w['id']) ? (string)$w['id'] : '';
      $name = isset($w['name']) ? trim((string)$w['name']) : '';
      $price = array_key_exists('price', $w) ? $w['price'] : null;
      $createdAt = isset($w['createdAt']) ? (int)$w['createdAt'] : $incomingMs;

      if ($id === '' || $name === '') continue;

      if ($price === null || $price === '') {
        $stmt->execute([$id, $clientId, $name, null, $createdAt, $incomingMs]);
      } else {
        $p = (float)$price;
        if ($p < 0) $p = 0.0;
        $stmt->execute([$id, $clientId, $name, $p, $createdAt, $incomingMs]);
      }
    }
  }

  if ($pomodoro !== null) {
    $mode = isset($pomodoro['mode']) ? (string)$pomodoro['mode'] : 'focus';
    if (!in_array($mode, ['focus','break','long'], true)) $mode = 'focus';

    $dur = isset($pomodoro['durationsMin']) && is_array($pomodoro['durationsMin']) ? $pomodoro['durationsMin'] : [];
    $rem = isset($pomodoro['remainingByMode']) && is_array($pomodoro['remainingByMode']) ? $pomodoro['remainingByMode'] : [];

    $focusMin = isset($dur['focus']) ? (int)$dur['focus'] : 25;
    $breakMin = isset($dur['break']) ? (int)$dur['break'] : 5;
    $longMin = isset($dur['long']) ? (int)$dur['long'] : 15;

    $remFocus = isset($rem['focus']) ? (int)$rem['focus'] : $focusMin * 60;
    $remBreak = isset($rem['break']) ? (int)$rem['break'] : $breakMin * 60;
    $remLong = isset($rem['long']) ? (int)$rem['long'] : $longMin * 60;

    $remainingSec = isset($pomodoro['remainingSec']) ? (int)$pomodoro['remainingSec'] : $remFocus;
    $isRunning = isset($pomodoro['isRunning']) ? (int)((bool)$pomodoro['isRunning']) : 0;
    $lastTick = isset($pomodoro['lastTick']) ? (int)$pomodoro['lastTick'] : 0;
    $session = isset($pomodoro['session']) ? (int)$pomodoro['session'] : 0;

    $stmt = $pdo->prepare("
      INSERT INTO pomodoro (client_id, mode, focus_min, break_min, long_min, rem_focus_sec, rem_break_sec, rem_long_sec, remaining_sec, is_running, last_tick_ms, session, updated_at_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        mode = VALUES(mode),
        focus_min = VALUES(focus_min),
        break_min = VALUES(break_min),
        long_min = VALUES(long_min),
        rem_focus_sec = VALUES(rem_focus_sec),
        rem_break_sec = VALUES(rem_break_sec),
        rem_long_sec = VALUES(rem_long_sec),
        remaining_sec = VALUES(remaining_sec),
        is_running = VALUES(is_running),
        last_tick_ms = VALUES(last_tick_ms),
        session = VALUES(session),
        updated_at_ms = VALUES(updated_at_ms)
    ");
    $stmt->execute([$clientId, $mode, $focusMin, $breakMin, $longMin, $remFocus, $remBreak, $remLong, $remainingSec, $isRunning, $lastTick, $session, $incomingMs]);
  } else {
    $pdo->prepare('DELETE FROM pomodoro WHERE client_id = ?')->execute([$clientId]);
  }

  $stmt = $pdo->prepare("
    INSERT INTO ui_prefs (client_id, selected_date, view_month, view_year, chart_mode, wish_sort_mode, exp_filter_category, updated_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      selected_date = VALUES(selected_date),
      view_month = VALUES(view_month),
      view_year = VALUES(view_year),
      chart_mode = VALUES(chart_mode),
      wish_sort_mode = VALUES(wish_sort_mode),
      exp_filter_category = VALUES(exp_filter_category),
      updated_at_ms = VALUES(updated_at_ms)
  ");
  $stmt->execute([$clientId, $selectedDate, $viewMonth, $viewYear, $chartMode, $wishSortMode, $expFilterCategory, $incomingMs]);

  $pdo->prepare('UPDATE state_meta SET updated_at_ms = ? WHERE client_id = ?')->execute([$incomingMs, $clientId]);
}

function table_exists(PDO $pdo, string $name): bool {
  $stmt = $pdo->prepare("SHOW TABLES LIKE ?");
  $stmt->execute([$name]);
  return (bool)$stmt->fetch();
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $clientId = (string)($_GET['client_id'] ?? '');
  if (!validate_client_id($clientId)) json_response(['ok' => false, 'error' => 'bad_client_id'], 400);

  $pdo = db();

  ensure_client($pdo, $clientId);
  $metaMs = get_meta_ms($pdo, $clientId);

  if ($metaMs <= 0 && table_exists($pdo, 'app_state')) {
    $stmt = $pdo->prepare('SELECT state_json, updated_at_ms FROM app_state WHERE client_id = ? LIMIT 1');
    $stmt->execute([$clientId]);
    $row = $stmt->fetch();
    if ($row) {
      $oldState = json_decode($row['state_json'], true);
      if (is_array($oldState)) {
        $ms = (int)$row['updated_at_ms'];
        if ($ms <= 0) $ms = (int)floor(microtime(true) * 1000);
        $pdo->beginTransaction();
        try {
          apply_full_state($pdo, $clientId, $oldState, $ms);
          $pdo->commit();
          $metaMs = get_meta_ms($pdo, $clientId);
        } catch (Throwable $e) {
          if ($pdo->inTransaction()) $pdo->rollBack();
        }
      }
    }
  }

  if ($metaMs <= 0) {
    json_response(['ok' => true, 'state' => null, 'updatedAtMs' => 0]);
  }

  $state = build_state($pdo, $clientId, $metaMs);
  json_response(['ok' => true, 'state' => $state, 'updatedAtMs' => $metaMs]);
}

if ($method === 'POST') {
  $body = read_json_body();

  $clientId = (string)($body['client_id'] ?? '');
  if (!validate_client_id($clientId)) json_response(['ok' => false, 'error' => 'bad_client_id'], 400);

  $state = $body['state'] ?? null;
  if (!is_array($state)) json_response(['ok' => false, 'error' => 'bad_state'], 400);

  $incomingMs = (int)($body['updatedAtMs'] ?? 0);
  if ($incomingMs <= 0) $incomingMs = (int)floor(microtime(true) * 1000);

  $pdo = db();
  ensure_client($pdo, $clientId);

  $currentMs = get_meta_ms($pdo, $clientId);
  if ($currentMs > $incomingMs) {
    $serverState = build_state($pdo, $clientId, $currentMs);
    json_response([
      'ok' => false,
      'conflict' => true,
      'state' => $serverState,
      'updatedAtMs' => $currentMs,
    ], 409);
  }

  $pdo->beginTransaction();
  try {
    apply_full_state($pdo, $clientId, $state, $incomingMs);
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'error' => 'db_write_failed'], 500);
  }

  json_response(['ok' => true, 'updatedAtMs' => $incomingMs]);
}

json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
