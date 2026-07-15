SELECT 'CREATE DATABASE warehouse_suite'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'warehouse_suite'
)\gexec
