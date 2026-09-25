// Schéma SQL de l'application PROGENIS.
// Exécuté automatiquement (idempotent) au premier accès à la base, et par `npm run db:init`.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT,
  code_hash     TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL DEFAULT 'visionneur' CHECK (role IN ('manager','editeur','visionneur')),
  color         TEXT NOT NULL DEFAULT '#0f766e',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Tableau façon Trello : colonnes (listes) contenant des cartes (tâches)
CREATE TABLE IF NOT EXISTS board_columns (
  id       SERIAL PRIMARY KEY,
  title    TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_done  BOOLEAN NOT NULL DEFAULT FALSE
);

-- Étiquettes de couleur réutilisables (plusieurs par carte)
CREATE TABLE IF NOT EXISTS labels (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  column_id   INTEGER REFERENCES board_columns(id) ON DELETE CASCADE,
  position    DOUBLE PRECISION NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority    TEXT NOT NULL DEFAULT 'normale' CHECK (priority IN ('basse','normale','haute','urgente')),
  due_date    DATE,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_labels (
  task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  since    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_progress (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  stage      TEXT NOT NULL,
  percent    INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_progress_task_idx ON task_progress(task_id, created_at);

CREATE TABLE IF NOT EXISTS threads (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Général',
  pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  thread_id   INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_links    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at   TIMESTAMPTZ,
  deleted     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS project_sections (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS milestones (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'prevu' CHECK (status IN ('prevu','en_cours','atteint','retard')),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_documents (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  url          TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size         BIGINT NOT NULL DEFAULT 0,
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO board_columns (title, position, is_done)
SELECT * FROM (VALUES
  ('À faire', 1::float8, false), ('En cours', 2::float8, false), ('En revue', 3::float8, false), ('Terminé', 4::float8, true)
) AS v(title, position, is_done)
WHERE NOT EXISTS (SELECT 1 FROM board_columns);

INSERT INTO labels (name, color)
SELECT * FROM (VALUES
  ('Recherche', '#1d4ed8'), ('Laboratoire', '#0f766e'), ('Juridique', '#7c3aed'),
  ('Financement', '#b45309'), ('Communication', '#be123c'), ('Urgent', '#dc2626')
) AS v(name, color)
WHERE NOT EXISTS (SELECT 1 FROM labels);

INSERT INTO project_sections (title, content, position)
SELECT * FROM (VALUES
  ('Vision', '', 1),
  ('Objectifs', '', 2),
  ('Stratégie', '', 3),
  ('Ressources & partenaires', '', 4)
) AS v(title, content, position)
WHERE NOT EXISTS (SELECT 1 FROM project_sections);
`;
