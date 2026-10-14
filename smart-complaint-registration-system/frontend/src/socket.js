import { io } from 'socket.io-client';

let socket = null;

/** One shared Socket.IO connection, authenticated with the JWT when logged in. */
export function getSocket(token) {
  if (socket && socket.auth?.token === token) return socket;
  if (socket) socket.disconnect();
  socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}
