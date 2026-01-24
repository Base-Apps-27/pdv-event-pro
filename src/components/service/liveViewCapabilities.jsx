/**
 * Live View Capability System
 * Defines what features each service type supports
 * Components check capabilities instead of hardcoding type checks
 */

export const LIVE_VIEW_CAPABILITIES = {
  weekly: {
    timeAdjustment: true,
    timeAdjustmentMode: "time_slot", // Uses time_slot adjustments (9:30am, 11:30am)
    sessionFiltering: false,
    viewModeToggle: false,
    liveStatusCard: true,
    realTimeSync: false, // No real-time for JSON-based services
  },
  
  custom: {
    timeAdjustment: true,
    timeAdjustmentMode: "global", // Global service offset
    sessionFiltering: false,
    viewModeToggle: false,
    liveStatusCard: true,
    realTimeSync: false, // No real-time for JSON-based services
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
  return LIVE_VIEW_CAPABILITIES[serviceType] || LIVE_VIEW_CAPABILITIES.custom;
}