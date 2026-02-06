import { useEffect } from "react";
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
}

function MapBounds({ plants }: { plants: Plant[] }) {
  const map = useMap();
  const withCoords = plants.filter((p) => p.lat != null && p.lng != null);
  useEffect(() => {
    if (withCoords.length === 0) return;
    const bounds = L.latLngBounds(
      withCoords.map((p) => [p.lat!, p.lng!] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [map, plants]);
  return null;
}

export default function PlantMap({
  plants,
  showContactedOnly,
  showNotContactedOnly,
}: PlantMapProps) {
  let filtered = plants;
  if (showContactedOnly) {
    filtered = plants.filter((p) => p.contacted === 1);
  } else if (showNotContactedOnly) {
    filtered = plants.filter((p) => p.contacted === 0);
  }

  const withCoords = filtered.filter((p) => p.lat != null && p.lng != null);

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
        <MapBounds plants={withCoords} />
        <MarkerClusterGroup>
          {withCoords.map((plant) => (
            <Marker key={plant.id} position={[plant.lat!, plant.lng!]}>
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
