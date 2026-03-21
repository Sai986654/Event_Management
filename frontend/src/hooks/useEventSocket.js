import { useContext, useEffect, useCallback } from 'react';
import { SocketContext } from '../context/SocketContext';

/**
 * Hook to connect to a specific event room and subscribe to real-time events.
 *
 * Usage:
 *   const { connected, emitVendorStatus, emitTaskUpdate } = useEventSocket(eventId, {
 *     onVendorStatus: (data) => ...,
 *     onTaskUpdate: (data) => ...,
 *     onGuestRsvp: (data) => ...,
 *     onGuestCheckin: (data) => ...,
 *     onBookingCreated: (data) => ...,
 *     onBookingUpdated: (data) => ...,
 *   });
 */
export const useEventSocket = (eventId, handlers = {}) => {
  const ctx = useContext(SocketContext);

  // Join / leave the event room on mount / unmount
  useEffect(() => {
    if (!eventId || !ctx?.connected) return;

    ctx.joinEvent(eventId);
    return () => ctx.leaveEvent(eventId);
  }, [eventId, ctx?.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to events
  useEffect(() => {
    if (!ctx?.connected) return;

    const cleanups = [];

    if (handlers.onVendorStatus) cleanups.push(ctx.onVendorStatus(handlers.onVendorStatus));
    if (handlers.onTaskUpdate) cleanups.push(ctx.onTaskUpdate(handlers.onTaskUpdate));
    if (handlers.onGuestRsvp) cleanups.push(ctx.onGuestRsvp(handlers.onGuestRsvp));
    if (handlers.onGuestCheckin) cleanups.push(ctx.onGuestCheckin(handlers.onGuestCheckin));
    if (handlers.onBookingCreated) cleanups.push(ctx.onBookingCreated(handlers.onBookingCreated));
    if (handlers.onBookingUpdated) cleanups.push(ctx.onBookingUpdated(handlers.onBookingUpdated));

    return () => cleanups.forEach((unsub) => unsub());
  }, [ctx?.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const emitVendorStatus = useCallback(
    (vendorId, status) => ctx?.emitVendorStatus(eventId, vendorId, status),
    [eventId, ctx]
  );

  const emitTaskUpdate = useCallback(
    (taskId, completed) => ctx?.emitTaskUpdate(eventId, taskId, completed),
    [eventId, ctx]
  );

  return {
    connected: ctx?.connected ?? false,
    emitVendorStatus,
    emitTaskUpdate,
  };
};
