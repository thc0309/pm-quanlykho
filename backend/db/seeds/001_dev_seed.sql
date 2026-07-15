INSERT INTO warehouses (code, name)
VALUES ('MAIN', 'Kho chính')
ON CONFLICT (code) DO NOTHING;
