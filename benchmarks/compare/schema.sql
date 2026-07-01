DROP TABLE IF EXISTS npa_compare_users;

CREATE TABLE npa_compare_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX npa_compare_users_name_idx ON npa_compare_users (name);
