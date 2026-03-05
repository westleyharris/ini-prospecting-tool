import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { Plant } from "../api/plants";
import { getDisplayType } from "../utils/plant";

// Fix Leaflet default icon with Vite
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface PlantMapProps {
  plants: Plant[];
  showContactedOnly?: boolean;
  showNotContactedOnly?: boolean;
  focusedPlantId?: string | null;
}

function MapBounds({
  plants,
  skipWhenFocusedId,
}: {
  plants: Plant[];
  skipWhenFocusedId?: string | null;
}) {
  const map = useMap();
  const withCoords = plants.filter((p) => p.lat != null && p.lng != null);
  useEffect(() => {
    if (skipWhenFocusedId || withCoords.length === 0) return;
    const bounds = L.latLngBounds(
      withCoords.map((p) => [p.lat!, p.lng!] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [map, plants, skipWhenFocusedId]);
  return null;
}

function FocusOnPlant({ plant }: { plant: Plant | null }) {
  const map = useMap();

  useEffect(() => {
    if (!plant || plant.lat == null || plant.lng == null) return;
    map.setView([plant.lat, plant.lng], 16, { animate: true });
  }, [map, plant?.id, plant?.lat, plant?.lng]);

  return null;
}

function OpenFocusedPopup({
  focusedPlantId,
  markerRefs,
  focusedPlant,
}: {
  focusedPlantId: string | null;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
  focusedPlant: Plant | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusedPlantId || !focusedPlant || focusedPlant.lat == null || focusedPlant.lng == null) return;
    const lat = focusedPlant.lat;
    const lng = focusedPlant.lng;

    const findMarkerAt = (layer: L.Layer): L.Marker | null => {
      if (layer instanceof L.Marker) {
        const pos = layer.getLatLng();
        if (pos && Math.abs(pos.lat - lat) < 1e-5 && Math.abs(pos.lng - lng) < 1e-5) return layer;
        return null;
      }
      const group = layer as L.LayerGroup & { getLayers?: () => L.Layer[] };
      if (group.getLayers) {
        const layers = group.getLayers();
        for (let i = 0; i < layers.length; i++) {
          const found = findMarkerAt(layers[i]);
          if (found) return found;
        }
      }
      return null;
    };

    // opened flag prevents the popup from re-opening after the user closes it
    // and then interacts with the map (moveend fires on any pan/zoom)
    let opened = false;

    const tryOpenPopup = () => {
      if (opened) return;
      let marker: L.Marker | null = null;
      const raw = markerRefs.current[focusedPlantId];
      if (raw) {
        if (typeof (raw as L.Marker).openPopup === "function") {
          marker = raw as L.Marker;
        } else {
          const withLeaflet = raw as unknown as { leafletElement?: L.Marker };
          if (withLeaflet?.leafletElement && typeof withLeaflet.leafletElement.openPopup === "function") {
            marker = withLeaflet.leafletElement;
          }
        }
      }
      if (!marker) {
        map.eachLayer((layer) => {
          if (!marker) marker = findMarkerAt(layer);
        });
      }
      if (marker && typeof marker.openPopup === "function") {
        marker.openPopup();
        opened = true;
        // Remove the moveend listener once the popup has opened — no need to re-open
        map.off("moveend", onMoveEnd);
      }
    };

    const onMoveEnd = () => tryOpenPopup();
    map.on("moveend", onMoveEnd);
    const t1 = setTimeout(tryOpenPopup, 800);
    const t2 = setTimeout(tryOpenPopup, 1800);
    return () => {
      map.off("moveend", onMoveEnd);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map, focusedPlantId, focusedPlant, markerRefs]);

  return null;
}

export default function PlantMap({
  plants,
  showContactedOnly,
  showNotContactedOnly,
  focusedPlantId,
}: PlantMapProps) {
  let filtered = plants;
  if (showContactedOnly) {
    filtered = plants.filter((p) => p.contacted === 1);
  } else if (showNotContactedOnly) {
    filtered = plants.filter((p) => p.contacted === 0);
  }

  const withCoords = filtered.filter((p) => p.lat != null && p.lng != null);
  const focusedPlant =
    focusedPlantId != null
      ? plants.find((p) => p.id === focusedPlantId) ?? null
      : null;
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={[32.78, -96.8]}
        zoom={10}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds plants={withCoords} skipWhenFocusedId={focusedPlantId} />
        <FocusOnPlant plant={focusedPlant} />
        <OpenFocusedPopup
          focusedPlantId={focusedPlantId ?? null}
          markerRefs={markerRefs}
          focusedPlant={focusedPlant}
        />
        <MarkerClusterGroup>
          {withCoords.map((plant) => (
            <Marker
              key={plant.id}
              ref={(el) => {
                if (el) markerRefs.current[plant.id] = el as unknown as L.Marker;
              }}
              position={[plant.lat!, plant.lng!]}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <div className="flex gap-3">
                    {plant.photo_name && (
                      <img
                        src={`/api/plants/${plant.id}/photo`}
                        alt=""
                        className="w-14 h-14 object-cover rounded border border-gray-200 flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{plant.name ?? "Unknown"}</p>
                      {plant.distance_miles != null && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {plant.distance_miles} mi from Forney, TX
                        </p>
                      )}
                    </div>
                  </div>
                  {(plant.generative_summary ?? plant.editorial_summary) && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                      {plant.generative_summary ?? plant.editorial_summary}
                      {plant.generative_summary && (
                        <span className="text-[10px] text-gray-400 ml-1">(Summarized with Gemini)</span>
                      )}
                    </p>
                  )}
                  {getDisplayType(plant) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {getDisplayType(plant)}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    {plant.formatted_address ?? ""}
                  </p>
                  {plant.phone && (
                    <p className="text-sm mt-1">
                      <a href={`tel:${plant.phone}`} className="text-blue-600 hover:underline">
                        {plant.phone}
                      </a>
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {plant.website && (
                      <a
                        href={plant.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Website
                      </a>
                    )}
                    {plant.google_maps_uri && (
                      <a
                        href={plant.google_maps_uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Maps
                      </a>
                    )}
                  </div>
                  {plant.regular_opening_hours && (() => {
                    try {
                      const data = JSON.parse(plant.regular_opening_hours);
                      const desc = data.weekdayDescriptions?.[0] as string | undefined;
                      if (desc) {
                        return (
                          <p className="text-xs text-gray-500 mt-1" title={data.weekdayDescriptions?.join("\n")}>
                            {desc.replace(/^[^:]+:\s*/, "")}
                          </p>
                        );
                      }
                    } catch {}
                    return null;
                  })()}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        plant.contacted === 1
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {plant.contacted === 1 ? "Contacted" : "Not contacted"}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        plant.current_customer === 1
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {plant.current_customer === 1 ? "Customer" : "Not customer"}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
