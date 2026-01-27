-- 00_kill_locks.sql
-- Run this script SEPARATELY if you encounter "Upstream Timeouts" or "Lock" errors.
-- It forcibly terminates other connections to the database to release table locks.

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND datname = current_database();
