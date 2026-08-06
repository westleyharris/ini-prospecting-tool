import { fetchVisits, type Visit, type VisitFile } from "./visits";
import { listMappings, type Mapping } from "./mappings";

/**
 * The Reports page treats two different records as "reports":
 *   - a plant visit (with any uploaded documents)
 *   - an equipment mapping collected during a visit
 * This module normalizes both into one shape so they can be listed together.
 */

export type ReportKind = "visit" | "mapping";

interface ReportBase {
  id: string;
  plant_id: string;
  plant_name: string | null;
  plant_city: string | null;
  plant_state: string | null;
  /** YYYY-MM-DD — used for both sorting and display */
  date: string;
  notes: string | null;
  /** Files for a visit, photos for a mapping — drives the "with attachments" filter */
  attachmentCount: number;
}

export interface VisitReport extends ReportBase {
  kind: "visit";
  files: VisitFile[];
}

export interface MappingReport extends ReportBase {
  kind: "mapping";
  title: string;
  status: Mapping["status"];
  machineCount: number;
  photoCount: number;
}

export type Report = VisitReport | MappingReport;

/** Mappings store a full timestamp; visits store a plain date. Normalize to YYYY-MM-DD. */
function toDay(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

function visitToReport(visit: Visit & { files?: VisitFile[] }): VisitReport {
  const files = visit.files ?? [];
  return {
    kind: "visit",
    id: visit.id,
    plant_id: visit.plant_id,
    plant_name: visit.plant_name ?? null,
    plant_city: visit.plant_city ?? null,
    plant_state: visit.plant_state ?? null,
    date: toDay(visit.visit_date),
    notes: visit.notes,
    attachmentCount: files.length,
    files,
  };
}

function mappingToReport(mapping: Mapping): MappingReport {
  const photoCount = mapping.photo_count ?? 0;
  return {
    kind: "mapping",
    id: mapping.id,
    plant_id: mapping.plant_id,
    plant_name: mapping.plant_name ?? null,
    plant_city: mapping.city ?? null,
    plant_state: mapping.state ?? null,
    date: toDay(mapping.created_at),
    notes: mapping.notes,
    attachmentCount: photoCount,
    title: mapping.name,
    status: mapping.status,
    machineCount: mapping.machine_count ?? 0,
    photoCount,
  };
}

/** Fetch visits and mappings together, normalized and sorted newest first. */
export async function fetchReports(plantId?: string): Promise<Report[]> {
  const [visits, mappings] = await Promise.all([
    fetchVisits(plantId),
    listMappings(plantId),
  ]);

  return [
    ...visits.map((v) => visitToReport(v as Visit & { files?: VisitFile[] })),
    ...mappings.map(mappingToReport),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
