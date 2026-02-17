import Database from "better-sqlite3";
import { join } from "path";

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), "data.db");
export const db = new Database(dbPath);

// Enable foreign keys so ON DELETE CASCADE works for contacts when plants are deleted
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id TEXT PRIMARY KEY,
    place_id TEXT UNIQUE NOT NULL,
    name TEXT,
    formatted_address TEXT,
    lat REAL,
    lng REAL,
    phone TEXT,
    website TEXT,
    business_status TEXT,
    data_source TEXT DEFAULT 'google_places',
    contacted INTEGER DEFAULT 0,
    follow_up_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_plants_place_id ON plants(place_id);
  CREATE INDEX IF NOT EXISTS idx_plants_contacted ON plants(contacted);
  CREATE INDEX IF NOT EXISTS idx_plants_follow_up_date ON plants(follow_up_date);
  CREATE INDEX IF NOT EXISTS idx_plants_created_at ON plants(created_at);

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    apollo_id TEXT,
    first_name TEXT,
    last_name TEXT,
    title TEXT,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    source TEXT DEFAULT 'apollo',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_plant_id ON contacts(plant_id);
  CREATE INDEX IF NOT EXISTS idx_contacts_apollo_id ON contacts(apollo_id);

  CREATE TABLE IF NOT EXISTS sequences (
    name TEXT PRIMARY KEY,
    next_value INTEGER NOT NULL DEFAULT 1
  );
  INSERT OR IGNORE INTO sequences (name, next_value) VALUES ('pr', 1), ('comm', 1);

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    visit_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_visits_plant_id ON visits(plant_id);
  CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);

  CREATE TABLE IF NOT EXISTS visit_files (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_visit_files_visit_id ON visit_files(visit_id);

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    pr_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft',
    source_visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_projects_plant_id ON projects(plant_id);
  CREATE INDEX IF NOT EXISTS idx_projects_pr_number ON projects(pr_number);
  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

  CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'other',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);

  CREATE TABLE IF NOT EXISTS commissionings (
    id TEXT PRIMARY KEY,
    project_id TEXT UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    comm_number TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_commissionings_project_id ON commissionings(project_id);
  CREATE INDEX IF NOT EXISTS idx_commissionings_comm_number ON commissionings(comm_number);
`);

// Migrations: add new columns if they don't exist
const newColumns = [
  { name: "google_maps_uri", type: "TEXT" },
  { name: "primary_type", type: "TEXT" },
  { name: "types", type: "TEXT" },
  { name: "rating", type: "REAL" },
  { name: "user_rating_count", type: "INTEGER" },
  { name: "plus_code", type: "TEXT" },
  { name: "primary_type_display_name", type: "TEXT" },
  { name: "short_formatted_address", type: "TEXT" },
  { name: "price_level", type: "TEXT" },
  { name: "regular_opening_hours", type: "TEXT" },
  { name: "current_customer", type: "INTEGER DEFAULT 0" },
  { name: "photo_name", type: "TEXT" },
  { name: "editorial_summary", type: "TEXT" },
  { name: "generative_summary", type: "TEXT" },
  { name: "city", type: "TEXT" },
  { name: "state", type: "TEXT" },
  { name: "postal_code", type: "TEXT" },
  { name: "manufacturing_relevance", type: "TEXT" },
  { name: "manufacturing_reason", type: "TEXT" },
];
const tableInfo = db.prepare("PRAGMA table_info(plants)").all() as { name: string }[];
const existingCols = new Set(tableInfo.map((c) => c.name));
for (const col of newColumns) {
  if (!existingCols.has(col.name)) {
    db.exec(`ALTER TABLE plants ADD COLUMN ${col.name} ${col.type}`);
  }
}

db.exec("CREATE INDEX IF NOT EXISTS idx_plants_current_customer ON plants(current_customer)");

export interface Plant {
  id: string;
  place_id: string;
  name: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  business_status: string | null;
  google_maps_uri: string | null;
  primary_type: string | null;
  types: string | null;
  rating: number | null;
  user_rating_count: number | null;
  plus_code: string | null;
  primary_type_display_name: string | null;
  short_formatted_address: string | null;
  price_level: string | null;
  regular_opening_hours: string | null;
  data_source: string;
  contacted: number;
  current_customer: number;
  photo_name: string | null;
  editorial_summary: string | null;
  generative_summary: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  manufacturing_relevance: string | null;
  manufacturing_reason: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  plant_id: string;
  apollo_id: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  plant_id: string;
  visit_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitFile {
  id: string;
  visit_id: string;
  filename: string;
  original_name: string;
  content_type: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  plant_id: string;
  pr_number: string;
  status: string;
  source_visit_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;
  original_name: string;
  file_type: string;
  created_at: string;
}

export interface Commissioning {
  id: string;
  project_id: string;
  comm_number: string;
  created_at: string;
}

export function getNextSequence(name: "pr" | "comm"): { value: number; formatted: string } {
  const prefix = name === "pr" ? "PR" : "COMM";
  const run = db.transaction(() => {
    const row = db
      .prepare("SELECT next_value FROM sequences WHERE name = ?")
      .get(name) as { next_value: number } | undefined;
    if (!row) {
      db.prepare("INSERT OR IGNORE INTO sequences (name, next_value) VALUES (?, 1)").run(name);
    }
    const current = db
      .prepare("SELECT next_value FROM sequences WHERE name = ?")
      .get(name) as { next_value: number };
    const value = current?.next_value ?? 1;
    db.prepare("UPDATE sequences SET next_value = next_value + 1 WHERE name = ?").run(name);
    return value;
  });
  const value = run();
  const formatted = `${prefix}-${String(value).padStart(3, "0")}`;
  return { value, formatted };
}
