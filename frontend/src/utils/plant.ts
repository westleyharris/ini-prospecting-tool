/** Generic types to skip when falling back to types array */
const GENERIC_TYPES = new Set(["establishment", "point_of_interest"]);

/** Format snake_case type for display */
function formatType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get best type to display: primary first, then first non-generic from types array */
export function getDisplayType(plant: {
  primary_type_display_name?: string | null;
  primary_type?: string | null;
  types?: string | null;
}): string {
  if (plant.primary_type_display_name) return plant.primary_type_display_name;
  if (plant.primary_type) return formatType(plant.primary_type);
  if (!plant.types) return "";
  try {
    const arr = JSON.parse(plant.types) as string[];
    const meaningful = Array.isArray(arr) ? arr.find((t) => !GENERIC_TYPES.has(t.toLowerCase())) : null;
    return meaningful ? formatType(meaningful) : (arr[0] ? formatType(arr[0]) : "");
  } catch {
    return "";
  }
}
