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
