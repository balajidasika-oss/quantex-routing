import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const vehicleColors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']; // Red, Blue, Amber, Purple, Pink
const optColors = ['#10b981', '#059669', '#047857', '#34d399', '#059669']; // Greens for optimized

// Component to recenter map when nodes change
const MapUpdater = ({ nodes }) => {
  const map = useMap();
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const bounds = L.latLngBounds(nodes.map(n => [n.lat, n.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [nodes, map]);
  return null;
};

const MapComponent = ({ nodes, routes, isOptimized }) => {
  // Center of SF as default
  const defaultCenter = [37.7749, -122.4194];

  // Helper to draw polylines for a set of routes
  const renderRoutes = (routeDict, useOptimizedColor = false) => {
    if (!routeDict) return null;
    
    return Object.entries(routeDict).map(([vehicleId, routeNodes], index) => {
      if (routeNodes.length < 2) return null;
      
      // Close the loop (TSP returns to start)
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
            weight: 4, 
            opacity: 0.8,
            dashArray: useOptimizedColor ? null : '8, 8' 
          }}
        />
      );
    });
  };

  return (
    <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapUpdater nodes={nodes} />
      
      {/* Draw nodes */}
      {nodes.map(node => (
        <Marker key={node.id} position={[node.lat, node.lng]}>
          <Popup>
            <strong>{node.label}</strong><br/>
            ID: {node.id}
          </Popup>
        </Marker>
      ))}

      {/* Draw Routes */}
      {routes && (
        <>
          {/* If optimized, we draw green solid lines. If not, we draw the original clusters in red dashed lines. */}
          {isOptimized ? renderRoutes(routes.optimized, true) : renderRoutes(routes.unoptimized, false)}
        </>
      )}
    </MapContainer>
  );
};

export default MapComponent;
