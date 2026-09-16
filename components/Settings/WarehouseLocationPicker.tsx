"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);

const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false },
);

export type WarehouseMapMarker = {
  id: number | string;
  name: string;
  code?: string;
  label?: string | null;
  latitude: number;
  longitude: number;
  district?: string | null;
  area?: string | null;
  coverageRadiusKm?: number | null;
};

interface WarehouseLocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange?: (lat: number, lng: number) => void;
  readonly?: boolean;
  markers?: WarehouseMapMarker[];
  heightClassName?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
  coverageRadiusKm?: number | null;
  onError?: () => void;
  selectedMarkerId?: number | string | null;
  onMarkerSelect?: (id: number | string | null) => void;
}

function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange?: (lat: number, lng: number) => void;
}) {
  const [useMapEvents, setUseMapEvents] = useState<any>(null);

  useEffect(() => {
    import("react-leaflet").then((mod) => {
      setUseMapEvents(() => mod.useMapEvents);
    });
  }, []);

  if (!useMapEvents || !onLocationChange) {
    return null;
  }

  const MapEventsComponent = () => {
    useMapEvents({
      click: (e: any) => {
        const { lat, lng } = e.latlng;
        onLocationChange(lat, lng);
      },
    });
    return null;
  };

  return <MapEventsComponent />;
}

export default function WarehouseLocationPicker({
  latitude = null,
  longitude = null,
  onLocationChange,
  readonly = false,
  markers = [],
  heightClassName = "h-72",
  title,
  description,
  emptyMessage,
  coverageRadiusKm = null,
  onError,
  selectedMarkerId: selectedMarkerIdProp = null,
  onMarkerSelect,
}: WarehouseLocationPickerProps) {
  const t = useTranslations("AdminWarehouseLocationPicker");

  const resolvedEmptyMessage = emptyMessage ?? t("emptyMessage");

  const [isClient, setIsClient] = useState(false);
  const [leaflet, setLeaflet] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (selectedMarkerIdProp === null || selectedMarkerIdProp === undefined) {
      setSelectedMarkerId(null);
    } else {
      setSelectedMarkerId(String(selectedMarkerIdProp));
    }
  }, [selectedMarkerIdProp]);

  useEffect(() => {
    setIsClient(true);
    import("leaflet")
      .then((leafletModule) => {
        delete (leafletModule.Icon.Default.prototype as any)._getIconUrl;
        leafletModule.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });
        setLeaflet(leafletModule);
        setTimeout(() => setMapReady(true), 100);
      })
      .catch((error) => {
        console.error("Failed to load Leaflet:", error);
        if (onError) {
          onError();
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSinglePoint =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);

  const validMarkers = useMemo(
    () =>
      markers.filter(
        (marker) =>
          typeof marker.latitude === "number" &&
          Number.isFinite(marker.latitude) &&
          typeof marker.longitude === "number" &&
          Number.isFinite(marker.longitude),
      ),
    [markers],
  );

  const selectedMarker = useMemo(
    () =>
      selectedMarkerId === null
        ? null
        : (validMarkers.find(
            (marker) => String(marker.id) === selectedMarkerId,
          ) ?? null),
    [selectedMarkerId, validMarkers],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !leaflet) return;

    if (selectedMarker) {
      const radiusKm =
        typeof selectedMarker.coverageRadiusKm === "number" &&
        Number.isFinite(selectedMarker.coverageRadiusKm) &&
        selectedMarker.coverageRadiusKm > 0
          ? selectedMarker.coverageRadiusKm
          : null;

      if (radiusKm) {
        const center = leaflet.latLng(
          selectedMarker.latitude,
          selectedMarker.longitude,
        );
        const bounds = center.toBounds(radiusKm * 2000);
        map.fitBounds(bounds, { padding: [48, 48] });
      } else {
        map.setView([selectedMarker.latitude, selectedMarker.longitude], 15);
      }

      setTimeout(() => {
        const markerInstance = markersRef.current.get(
          String(selectedMarker.id),
        );
        if (markerInstance && markerInstance.openPopup) {
          markerInstance.openPopup();
        }
      }, 300);

      return;
    }

    if (validMarkers.length > 1) {
      const bounds = leaflet.latLngBounds(
        validMarkers.map((marker) => [marker.latitude, marker.longitude]),
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [32, 32] });
      }
      return;
    }

    if (validMarkers.length === 1) {
      map.setView([validMarkers[0].latitude, validMarkers[0].longitude], 13);
      return;
    }

    if (hasSinglePoint) {
      map.setView([latitude as number, longitude as number], 14);
      return;
    }

    map.setView([23.8103, 90.4125], 7);
  }, [
    hasSinglePoint,
    latitude,
    leaflet,
    longitude,
    selectedMarker,
    validMarkers,
  ]);

  useEffect(() => {
    if (!readonly) {
      setSelectedMarkerId(null);
      return;
    }

    if (selectedMarkerId !== null) {
      const stillExists = validMarkers.some(
        (marker) => marker.id === selectedMarkerId,
      );
      if (!stillExists) {
        setSelectedMarkerId(null);
      }
    }
  }, [readonly, selectedMarkerId, validMarkers]);

  if (!isClient || !leaflet || !mapReady) {
    return (
      <div
        className={`w-full ${heightClassName} flex items-center justify-center rounded-xl border border-border bg-muted/30`}
      >
        <div className="text-sm text-muted-foreground">{t("loadingMap")}</div>
      </div>
    );
  }

  const shouldShowMap = hasSinglePoint || validMarkers.length > 0;
  if (!shouldShowMap) {
    return (
      <div className="space-y-2">
        {title ? <div className="text-sm font-medium">{title}</div> : null}
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
        <div
          className={`w-full ${heightClassName} flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground`}
        >
          {resolvedEmptyMessage}
        </div>
      </div>
    );
  }

  const center: [number, number] =
    hasSinglePoint && latitude !== null && longitude !== null
      ? [latitude, longitude]
      : validMarkers.length > 0
        ? [validMarkers[0].latitude, validMarkers[0].longitude]
        : [23.8103, 90.4125];

  return (
    <div className="space-y-2">
      <style global jsx>{`
        .leaflet-marker-icon {
          cursor: pointer;
        }
      `}</style>
      {title ? <div className="text-sm font-medium">{title}</div> : null}
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}

      <div
        className={`w-full ${heightClassName} overflow-hidden rounded-xl border border-border`}
      >
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl
          ref={(map) => {
            if (map && !mapRef.current) {
              mapRef.current = map;
            }
          }}
          className="z-10"
          whenReady={() => {
            // Map is fully ready
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {validMarkers.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.latitude, marker.longitude]}
              ref={(markerInstance) => {
                if (markerInstance) {
                  markersRef.current.set(String(marker.id), markerInstance);
                }
              }}
              eventHandlers={{
                click: () => {
                  const markerIdString = String(marker.id);
                  setSelectedMarkerId(markerIdString);
                  onMarkerSelect?.(markerIdString);
                },
                mouseover: (event: any) => {
                  event.target.openPopup();
                },
                mouseout: (event: any) => {
                  event.target.closePopup();
                },
              }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">
                    {marker.label || marker.name}
                  </div>
                  {marker.code ? (
                    <div>{t("popup.code", { code: marker.code })}</div>
                  ) : null}
                  {marker.district || marker.area ? (
                    <div>
                      {[marker.area, marker.district]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  ) : null}
                  {marker.coverageRadiusKm && marker.coverageRadiusKm > 0 ? (
                    <div>
                      {t("popup.coverageRadius", {
                        km: marker.coverageRadiusKm,
                      })}
                    </div>
                  ) : null}
                  <div>
                    {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {validMarkers.map((marker) => {
            const radiusKm =
              typeof marker.coverageRadiusKm === "number" &&
              Number.isFinite(marker.coverageRadiusKm) &&
              marker.coverageRadiusKm > 0
                ? marker.coverageRadiusKm
                : null;

            return radiusKm ? (
              <Circle
                key={`circle-${marker.id}`}
                center={[marker.latitude, marker.longitude]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.1,
                  weight: 2,
                }}
              />
            ) : null;
          })}

          {readonly &&
          selectedMarker &&
          selectedMarker.coverageRadiusKm &&
          selectedMarker.coverageRadiusKm > 0 ? (
            <Circle
              center={[selectedMarker.latitude, selectedMarker.longitude]}
              radius={selectedMarker.coverageRadiusKm * 1000}
              pathOptions={{
                color: "#0f766e",
                fillColor: "#14b8a6",
                fillOpacity: 0.14,
                weight: 2,
              }}
            />
          ) : null}

          {hasSinglePoint ? (
            <>
              <Marker position={[latitude as number, longitude as number]}>
                <Popup>
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">
                      {t("popup.previewTitle")}
                    </div>
                    <div>
                      {(latitude as number).toFixed(6)},{" "}
                      {(longitude as number).toFixed(6)}
                    </div>
                  </div>
                </Popup>
              </Marker>

              {coverageRadiusKm && coverageRadiusKm > 0 ? (
                <Circle
                  center={[latitude as number, longitude as number]}
                  radius={coverageRadiusKm * 1000}
                  pathOptions={{
                    color: "#0f766e",
                    fillColor: "#14b8a6",
                    fillOpacity: 0.14,
                    weight: 2,
                  }}
                />
              ) : null}
            </>
          ) : null}

          {!readonly ? (
            <MapClickHandler onLocationChange={onLocationChange} />
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}
