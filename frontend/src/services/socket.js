import { io } from 'socket.io-client';

let socket = null;

export function connectSocket() {
  if (socket?.connected) return socket;
  // Connect through Vite proxy (works on LAN too)
  socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    path: '/socket.io'
  });
  socket.on('connect', () => console.log('Socket connected:', socket.id));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function getSocket() { return socket; }

export function emitLocationUpdate(location) {
  socket?.emit('location-update', location);
}

export function emitEmergencyAlert(data) {
  socket?.emit('emergency-alert', data);
}

export function onEmergencyAlert(callback) {
  socket?.on('emergency-alert', callback);
  return () => socket?.off('emergency-alert', callback);
}

export function onLocationUpdate(callback) {
  socket?.on('location-update', callback);
  return () => socket?.off('location-update', callback);
}

export function joinFamilyRooms(networkIds) {
  if (!socket) return;
  networkIds.forEach(id => {
    socket.emit('join-family-network', { networkId: id });
  });
}
