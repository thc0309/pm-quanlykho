-- Recovery (development only): reset the database, rerun migrations, then seed
-- with explicit phone values. No synthetic phone is generated for existing users.
ALTER TABLE users
  ADD COLUMN phone varchar(16) NOT NULL,
  ADD COLUMN avatar_url varchar(500),
  ADD COLUMN employee_code varchar(50),
  ADD COLUMN job_title varchar(100),
  ADD COLUMN department varchar(100),
  ADD COLUMN note varchar(500),
  ADD CONSTRAINT users_phone_format CHECK (phone ~ '^\+?[0-9]{8,15}$');
