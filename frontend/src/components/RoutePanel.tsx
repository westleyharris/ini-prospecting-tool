import type { Plant } from "../api/plants";

function buildGoogleMapsUrl(stops: Plant[]): string {
  if (stops.length < 2) return "";
  const fmt = (p: Plant) => `${p.lat},${p.lng}`;
  const origin = fmt(stops[0]);
  const destination = fmt(stops[stops.length - 1]);
  const waypoints = stops.slice(1, -1).map(fmt).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

interface RoutePanelProps {
  routePlants: Plant[];
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onClear: () => void;
}

export default function RoutePanel({
  routePlants,
  onRemove,
  onMoveUp,
  onMoveDown,
  onClear,
}: RoutePanelProps) {
  const mapsUrl = buildGoogleMapsUrl(routePlants);
  const canOpen = routePlants.length >= 2;

  return (
    <div className="w-64 shrink-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: 600 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Route</span>
          {routePlants.length > 0 && (
            <span className="text-xs font-medium bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
              {routePlants.length} stop{routePlants.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {routePlants.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Stop list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {routePlants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 text-gray-400">
            <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-xs leading-relaxed">
              Open a plant popup and click <span className="font-medium text-gray-500">Add to Route</span>
            </p>
          </div>
        ) : (
          routePlants.map((plant, idx) => (
            <div key={plant.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
              {/* Number badge */}
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {idx + 1}
              </div>

              {/* Plant info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{plant.name ?? "Unknown"}</p>
                {(plant.city || plant.state) && (
                  <p className="text-[10px] text-gray-400 truncate">
                    {[plant.city, plant.state].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onMoveUp(plant.id)}
                  disabled={idx === 0}
                  title="Move up"
                  className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(plant.id)}
                  disabled={idx === routePlants.length - 1}
                  title="Move down"
                  className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(plant.id)}
                  title="Remove"
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-200 space-y-2">
        {routePlants.length > 10 && (
          <p className="text-[10px] text-amber-600 text-center">
            Google Maps supports up to 10 stops
          </p>
        )}
        {canOpen ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Open in Google Maps
          </a>
        ) : (
          <div className="w-full py-2 text-sm font-medium text-gray-300 bg-gray-50 rounded-lg text-center border border-gray-200">
            Open in Google Maps
          </div>
        )}
        {!canOpen && routePlants.length === 1 && (
          <p className="text-[10px] text-gray-400 text-center">Add one more stop to get directions</p>
        )}
      </div>
    </div>
  );
}
