/**
 * Idempotent local seed: a 7-line beverage plant that matches production-scale
 * coverage maps (Reyes Coca-Cola Downey). Safe to re-run; replaces this plant's
 * mappings only.
 *
 *   cd backend && npx tsx scripts/seed-downey.ts
 */
import { db } from "../src/db.ts";

const PLANT_ID = "seed-reyes-downey";
const PLACE_ID = "seed-reyes-downey";

const SLC = {
  plc_make: "Allen-Bradley",
  plc_model: "SLC 5/04",
  plc_series: "SLC 500",
  hmi_make: "Allen-Bradley",
  hmi_model: "PanelView Plus Compact 600",
};

const L5K = {
  plc_make: "Allen-Bradley",
  plc_model: "CompactLogix 5380",
  plc_series: "Logix 5000",
  hmi_make: "Allen-Bradley",
  hmi_model: "PanelView Plus 7",
};

const MATURE = {
  plc_make: "Allen-Bradley",
  plc_model: "PLC-5/40",
  plc_series: "PLC-5",
  hmi_make: "Allen-Bradley",
  hmi_model: "PanelView 550",
};

type Gear = Partial<typeof SLC>;

type LineSpec = { name: string; stations: { name: string; gear?: Gear }[] };

const LINES: LineSpec[] = [
  {
    name: "Line 1",
    stations: [
      { name: "Palletizer Barry-Wehmiller", gear: SLC },
      { name: "Palletizer Lane 2", gear: SLC },
      { name: "Palletizer Lane 1", gear: SLC },
      { name: "CHEP Pallet Destacker", gear: SLC },
      { name: "Wrapper Lane 5", gear: SLC },
      { name: "Wrapper Lane 2", gear: L5K },
      { name: "Wrapper Lane 1", gear: SLC },
      { name: "Full Case Conveyor", gear: L5K },
    ],
  },
  {
    name: "Line 2",
    stations: [
      { name: "Depal", gear: SLC },
      { name: "Filler A", gear: SLC },
      { name: "Filler B", gear: SLC },
      { name: "Warmer", gear: MATURE },
      { name: "Mead B", gear: SLC },
      { name: "Mead A", gear: L5K },
      { name: "Palletizer Lane 3", gear: SLC },
      { name: "Palletizer Lane 7", gear: SLC },
      { name: "Palletizer Lane 6", gear: SLC },
      { name: "Wrapper Lane 3", gear: SLC },
      { name: "Wrapper Lane 7", gear: SLC },
      { name: "Wrapper Lane 6", gear: SLC },
      { name: "Full Can and Case Conveyor", gear: L5K },
      { name: "Case Conveyor", gear: L5K },
      { name: "Blender", gear: SLC },
      { name: "Barcode Scanner", gear: L5K },
    ],
  },
  {
    name: "Line 3",
    stations: [
      { name: "Depal", gear: SLC },
      { name: "Filler", gear: SLC },
      { name: "Filler South", gear: SLC },
      { name: "Warmer", gear: MATURE },
      { name: "Hicone", gear: SLC },
      { name: "Douglas Lane 9", gear: SLC },
      { name: "Mead", gear: L5K },
      { name: "Douglas Lane 8", gear: L5K },
      { name: "Palletizer", gear: L5K },
      { name: "Palletizer Lane 9", gear: SLC },
      { name: "Pallet Tag Lane 8", gear: SLC },
      { name: "Wrapper", gear: L5K },
      { name: "Wrapper Lane 8", gear: SLC },
      { name: "Full Can and Case Conveyor", gear: L5K },
      { name: "Blender", gear: SLC },
      { name: "Check Scale", gear: L5K },
    ],
  },
  {
    name: "Line 4",
    stations: [
      { name: "Blowmolder B", gear: SLC },
      { name: "Blowmolder A", gear: SLC },
      { name: "Rinser", gear: L5K },
      { name: "Filler", gear: L5K },
      { name: "Labeler 2", gear: MATURE },
      { name: "Labeler 1", gear: MATURE },
      { name: "Hicone", gear: SLC },
      { name: "Variopac", gear: L5K },
      { name: "Palletizer Lane 10", gear: SLC },
      { name: "Palletizer Lane 11", gear: SLC },
      { name: "Wrapper Lane 10", gear: SLC },
      { name: "Wrapper Lane 11", gear: SLC },
      { name: "Full Case Conveyor", gear: L5K },
      { name: "Full Bottle Conveyor", gear: L5K },
      { name: "Blender", gear: SLC },
      { name: "Heat Tunnel", gear: L5K },
    ],
  },
  {
    name: "Line 5",
    stations: [
      { name: "Blowmolder", gear: SLC },
      { name: "Filler", gear: SLC },
      { name: "Airveyor Labeler - Filler", gear: SLC },
      { name: "Labeler", gear: L5K },
      { name: "Douglas", gear: L5K },
      { name: "Palletizer Lane 1", gear: L5K },
      { name: "Full Pallet MCP", gear: L5K },
      { name: "Wrapper", gear: L5K },
      { name: "CIP", gear: L5K },
      { name: "DO3" },
    ],
  },
  {
    name: "Line 6",
    stations: [
      { name: "Airveyor - Blowmolder", gear: SLC },
      { name: "Full/Rinse PNL", gear: L5K },
      { name: "Filler", gear: SLC },
      { name: "Filler to Case Packer Conveyor", gear: SLC },
      { name: "Airveyor Labeler - Filler", gear: SLC },
      { name: "Full Bottle Conveyor From Filler", gear: L5K },
      { name: "Labeler", gear: L5K },
      { name: "Hicone", gear: SLC },
      { name: "Douglas", gear: SLC },
      { name: "Conveyor Hicone-D", gear: SLC },
      { name: "Palletizer", gear: SLC },
      { name: "Full Pallet MCP", gear: L5K },
      { name: "Pallet Tag", gear: SLC },
      { name: "Wrapper", gear: L5K },
      { name: "Full Case Conveyors", gear: L5K },
      { name: "Blender", gear: SLC },
      { name: "Date Coder" },
    ],
  },
  {
    name: "Line 7",
    stations: [
      { name: "Douglas Contour", gear: L5K },
      { name: "Douglas Contour Lane 54", gear: L5K },
      { name: "Depal", gear: SLC },
      { name: "Filler", gear: SLC },
      { name: "Warmer", gear: MATURE },
      { name: "Hicone", gear: SLC },
      { name: "Packer Diverter Lane", gear: SLC },
      { name: "Palletizer Lane 14", gear: SLC },
      { name: "Palletizer Lane 13", gear: SLC },
      { name: "Wrapper Lane 14", gear: SLC },
      { name: "Wrapper Lane 13", gear: SLC },
      { name: "Full Can Conveyor", gear: L5K },
      { name: "Empty Can Conveyor", gear: L5K },
      { name: "Full Case Conveyor", gear: L5K },
      { name: "Blender", gear: SLC },
    ],
  },
];

function uuid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);

const insertPlant = db.prepare(`
  INSERT INTO plants (
    id, place_id, name, formatted_address, city, state, postal_code,
    lat, lng, business_status, data_source, current_customer,
    manufacturing_relevance, short_formatted_address, created_at, updated_at
  ) VALUES (
    @id, @place_id, @name, @formatted_address, @city, @state, @postal_code,
    @lat, @lng, 'OPERATIONAL', 'manual', 1,
    'high', @short_formatted_address, @created_at, @updated_at
  )
`);

const insertMapping = db.prepare(`
  INSERT INTO mappings (id, plant_id, name, status, created_at, updated_at)
  VALUES (@id, @plant_id, @name, 'complete', @created_at, @updated_at)
`);

const insertMachine = db.prepare(`
  INSERT INTO mapping_machines (
    id, mapping_id, name, sort_order,
    plc_make, plc_model, plc_series, hmi_make, hmi_model,
    created_at, updated_at
  ) VALUES (
    @id, @mapping_id, @name, @sort_order,
    @plc_make, @plc_model, @plc_series, @hmi_make, @hmi_model,
    @created_at, @updated_at
  )
`);

const seed = db.transaction(() => {
  db.prepare("DELETE FROM mappings WHERE plant_id = ?").run(PLANT_ID);
  db.prepare("DELETE FROM plants WHERE id = ?").run(PLANT_ID);

  const ts = now();
  insertPlant.run({
    id: PLANT_ID,
    place_id: PLACE_ID,
    name: "Reyes Coca-Cola Downey",
    formatted_address: "11841 Woodruff Ave, Downey, CA 90241, USA",
    city: "Downey",
    state: "California",
    postal_code: "90241",
    lat: 33.935,
    lng: -118.116,
    short_formatted_address: "11841 Woodruff Ave, Downey",
    created_at: ts,
    updated_at: ts,
  });

  let machines = 0;
  for (const line of LINES) {
    const mappingId = uuid();
    insertMapping.run({
      id: mappingId,
      plant_id: PLANT_ID,
      name: line.name,
      created_at: ts,
      updated_at: ts,
    });
    line.stations.forEach((station, i) => {
      const g = station.gear ?? {};
      insertMachine.run({
        id: uuid(),
        mapping_id: mappingId,
        name: station.name,
        sort_order: i,
        plc_make: g.plc_make ?? null,
        plc_model: g.plc_model ?? null,
        plc_series: g.plc_series ?? null,
        hmi_make: g.hmi_make ?? null,
        hmi_model: g.hmi_model ?? null,
        created_at: ts,
        updated_at: ts,
      });
      machines += 1;
    });
  }

  return { lines: LINES.length, machines };
});

const result = seed();
console.log(
  `Seeded Reyes Coca-Cola Downey (${PLANT_ID}): ${result.lines} lines, ${result.machines} stations.`,
);
console.log(`Open http://localhost:5173/mappings/plant/${PLANT_ID}`);
