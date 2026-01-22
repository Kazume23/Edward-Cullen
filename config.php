<?php
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_USER = 'root';
const DB_PASS = '';
const DB_NAME = 'edward_tracker';
const DB_CHARSET = 'utf8mb4';

function json_response(array $data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function db_no_db(): PDO {
  $dsn = 'mysql:host=' . DB_HOST . ';charset=' . DB_CHARSET;
  return new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
}

function ensure_database_exists(): void {
  $pdo = db_no_db();
  $sql = 'CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';
  $pdo->exec($sql);
}

function ensure_schema(PDO $pdo): void {
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS clients (
      client_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS state_meta (
      client_id VARCHAR(64) NOT NULL,
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (client_id),
      CONSTRAINT fk_state_meta_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS habits (
      id VARCHAR(64) NOT NULL,
      client_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at_ms BIGINT NOT NULL DEFAULT 0,
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_habits_client (client_id),
      CONSTRAINT fk_habits_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS habit_entries (
      client_id VARCHAR(64) NOT NULL,
      habit_id VARCHAR(64) NOT NULL,
      date_iso DATE NOT NULL,
      value TINYINT NOT NULL,
      created_at_ms BIGINT NOT NULL DEFAULT 0,
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (client_id, habit_id, date_iso),
      KEY idx_entries_habit (habit_id),
      CONSTRAINT fk_entries_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_entries_habit FOREIGN KEY (habit_id) REFERENCES habits(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS todos (
      id VARCHAR(64) NOT NULL,
      client_id VARCHAR(64) NOT NULL,
      date_iso DATE NOT NULL,
      text VARCHAR(500) NOT NULL,
      priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
      done TINYINT(1) NOT NULL DEFAULT 0,
      created_at_ms BIGINT NOT NULL DEFAULT 0,
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_todos_client_date (client_id, date_iso),
      CONSTRAINT fk_todos_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(64) NOT NULL,
      client_id VARCHAR(64) NOT NULL,
      date_iso DATE NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      what VARCHAR(255) NOT NULL,
      category VARCHAR(64) NOT NULL DEFAULT '',
      score VARCHAR(8) NOT NULL DEFAULT '',
      period ENUM('once','weekly','monthly','yearly') NOT NULL DEFAULT 'once',
      created_at_ms BIGINT NOT NULL DEFAULT 0,
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_expenses_client_date (client_id, date_iso),
      CONSTRAINT fk_expenses_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS wishlist (
      id VARCHAR(64) NOT NULL,
      client_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(12,2) NULL,
      created_at_ms BIGINT NOT NULL DEFAULT 0,
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_wishlist_client (client_id),
      CONSTRAINT fk_wishlist_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS pomodoro (
      client_id VARCHAR(64) NOT NULL,
      mode ENUM('focus','break','long') NOT NULL DEFAULT 'focus',
      focus_min SMALLINT NOT NULL DEFAULT 25,
      break_min SMALLINT NOT NULL DEFAULT 5,
      long_min SMALLINT NOT NULL DEFAULT 15,
      rem_focus_sec INT NOT NULL DEFAULT 1500,
      rem_break_sec INT NOT NULL DEFAULT 300,
      rem_long_sec INT NOT NULL DEFAULT 900,
      remaining_sec INT NOT NULL DEFAULT 1500,
      is_running TINYINT(1) NOT NULL DEFAULT 0,
      last_tick_ms BIGINT NOT NULL DEFAULT 0,
      session INT NOT NULL DEFAULT 0,
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (client_id),
      CONSTRAINT fk_pomodoro_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS ui_prefs (
      client_id VARCHAR(64) NOT NULL,
      selected_date DATE NULL,
      view_month TINYINT NULL,
      view_year SMALLINT NULL,
      chart_mode ENUM('week','month') NOT NULL DEFAULT 'week',
      wish_sort_mode VARCHAR(32) NOT NULL DEFAULT 'date-desc',
      exp_filter_category VARCHAR(64) NOT NULL DEFAULT '',
      updated_at_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (client_id),
      CONSTRAINT fk_ui_prefs_client FOREIGN KEY (client_id) REFERENCES clients(client_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");
}

function db(): PDO {
  static $pdo = null;
  static $booted = false;

  if ($pdo && $booted) return $pdo;

  ensure_database_exists();

  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  if (!$booted) {
    ensure_schema($pdo);
    $booted = true;
  }

  return $pdo;
}
