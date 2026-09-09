import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const vehicleColors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
const optColors = ['#10b981', '#059669', '#047857', '#34d399', '#059669'];

const MapUpdater = ({ nodes }) => {
  const map = useMap();
  useEffect(() => {
    if (nodes && nodes.length > 0 && !map.isTouched) {
      const bounds = L.latLngBounds(nodes.map(n => [n.lat, n.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      map.isTouched = true;
    }
  }, [nodes, map]);
  return null;
};

const ClickHandler = ({ onAddNode }) => {
  useMapEvents({
    click(e) {
      onAddNode({
        id: `manual_${Date.now()}`,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        label: `Manual Drop-${Math.floor(Math.random() * 1000)}`
      });
    },
  });
  return null;
};

const MapComponent = ({ nodes, routes, isOptimized, onAddNode }) => {
  const defaultCenter = [37.7749, -122.4194];

  const renderRoutes = (routeDict, useOptimizedColor = false) => {
    if (!routeDict) return null;
    
    return Object.entries(routeDict).map(([vehicleId, routeNodes], index) => {
      if (routeNodes.length < 2) return null;
      
      const pathCoordinates = routeNodes.map(n => [n.lat, n.lng]);
      if (pathCoordinates.length > 0) {
        pathCoordinates.push(pathCoordinates[0]);
      }

      const color = useOptimizedColor ? optColors[index % optColors.length] : vehicleColors[index % vehicleColors.length];

      return (
        <Polyline 
          key={`route-${vehicleId}-${useOptimizedColor ? 'opt' : 'unopt'}`}
          positions={pathCoordinates}
          pathOptions={{ 
            color: color, 
            weight: 5, 
            opacity: 0.8,
            dashArray: useOptimizedColor ? null : '10, 10',
            lineCap: 'round',
            lineJoin: 'round'
          }}
        />
      );
    });
  };

  return (
    <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#0B0F19' }}>
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapUpdater nodes={nodes} />
      <ClickHandler onAddNode={onAddNode} />
      
      {nodes.map(node => (
        <Marker key={node.id} position={[node.lat, node.lng]}>
          <Popup className="custom-popup">
            <div className="font-semibold text-slate-800">{node.label}</div>
            <div className="text-xs text-slate-500 font-mono mt-1">ID: {node.id}</div>
          </Popup>
        </Marker>
      ))}

      {routes && (
        <>
          {isOptimized ? renderRoutes(routes.optimized, true) : renderRoutes(routes.unoptimized, false)}
        </>
      )}
    </MapContainer>
  );
};

export default MapComponent;
