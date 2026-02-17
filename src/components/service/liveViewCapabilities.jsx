/**
 * Live View Capability System
 * Defines what features each service type supports
 * Components check capabilities instead of hardcoding type checks
 */

export const LIVE_VIEW_CAPABILITIES = {
  weekly: {
    timeAdjustment: true,
    timeAdjustmentMode: "session", // Per-session offsets (entity-backed via Session entities)
    sessionFiltering: false,
    viewModeToggle: false,
    liveStatusCard: true,
    realTimeSync: true, // Entity-backed via Session/Segment entities
  },

  custom: {
    timeAdjustment: true,
    timeAdjustmentMode: "session", // Per-session offsets (entity-backed)
    sessionFiltering: false,
    viewModeToggle: false,
    liveStatusCard: true,
    realTimeSync: true, // Entity-backed via Session/Segment entities
  },
  
  event: {
    timeAdjustment: true,
    timeAdjustmentMode: "session", // Per-session offsets
    sessionFiltering: true,
    viewModeToggle: true, // Simple vs Full view
    liveStatusCard: true,
    realTimeSync: true, // Entity-based, can use subscriptions
  }
};

/**
 * Gets capabilities for a service type
 * 
 * @param {string} serviceType - "weekly" | "custom" | "event"
 * @returns {Object} Capability configuration
 */
export function getCapabilities(serviceType) {
  // 'one_off' is the explicit service_type; map to 'custom' capabilities
  if (serviceType === 'one_off') return LIVE_VIEW_CAPABILITIES.custom;
  return LIVE_VIEW_CAPABILITIES[serviceType] || LIVE_VIEW_CAPABILITIES.custom;
}