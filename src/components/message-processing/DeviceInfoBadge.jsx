/**
 * DeviceInfoBadge.jsx
 * 
 * Compact device info display for Message Processing cards.
 * Shows a small summary badge + expandable details from SpeakerSubmissionVersion.device_info.
 * 
 * 2026-03-01: Created for Message Processing page. Non-PII only.
 */
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet, Wifi, Globe, Clock } from "lucide-react";

// Detect device category from user agent + touch points
function getDeviceCategory(info) {
  if (!info) return null;
  const ua = (info.user_agent || '').toLowerCase();
  const touch = info.max_touch_points > 0;
  const narrow = info.viewport_width && info.viewport_width < 768;

  if (/ipad|tablet/i.test(ua) || (touch && !narrow && info.viewport_width >= 768)) return 'tablet';
  if (/mobile|iphone|android(?!.*tablet)/i.test(ua) || (touch && narrow)) return 'mobile';
  return 'desktop';
}

function DeviceIcon({ category, className }) {
  if (category === 'mobile') return <Smartphone className={className} />;
  if (category === 'tablet') return <Tablet className={className} />;
  return <Monitor className={className} />;
}

// Compact one-line summary for card display
export function DeviceInfoCompact({ deviceInfo }) {
  if (!deviceInfo) return null;
  
  const category = getDeviceCategory(deviceInfo);
  const tz = deviceInfo.timezone?.replace('America/', '').replace('_', ' ') || '';
  const lang = deviceInfo.language?.split('-')[0]?.toUpperCase() || '';
  const net = deviceInfo.connection_type || '';

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
      <DeviceIcon category={category} className="w-3 h-3" />
      <span className="capitalize">{category}</span>
      {tz && <><span>·</span><span>{tz}</span></>}
      {lang && <><span>·</span><span>{lang}</span></>}
      {net && <><span>·</span><span>{net}</span></>}
    </div>
  );
}

// Expandable detail panel for history/diagnostic views
export function DeviceInfoPanel({ deviceInfo }) {
  const [expanded, setExpanded] = useState(false);
  if (!deviceInfo) return null;

  const category = getDeviceCategory(deviceInfo);

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
      >
        <DeviceIcon category={category} className="w-3.5 h-3.5" />
        <span className="capitalize font-medium">{category}</span>
        {deviceInfo.viewport_width && (
          <span className="text-gray-400 font-mono">{deviceInfo.viewport_width}×{deviceInfo.viewport_height}</span>
        )}
        <span className="text-gray-300 text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {deviceInfo.timezone && (
            <div className="flex gap-1 items-center">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-gray-800 font-mono">{deviceInfo.timezone}</span>
            </div>
          )}
          {deviceInfo.language && (
            <div className="flex gap-1 items-center">
              <Globe className="w-3 h-3 text-gray-400" />
              <span className="text-gray-800 font-mono">{deviceInfo.language}</span>
            </div>
          )}
          {deviceInfo.platform && (
            <div>
              <span className="text-gray-500">Plataforma: </span>
              <span className="text-gray-800 font-mono">{deviceInfo.platform}</span>
            </div>
          )}
          {deviceInfo.screen_width && (
            <div>
              <span className="text-gray-500">Pantalla: </span>
              <span className="text-gray-800 font-mono">{deviceInfo.screen_width}×{deviceInfo.screen_height}</span>
            </div>
          )}
          {deviceInfo.connection_type && (
            <div className="flex gap-1 items-center">
              <Wifi className="w-3 h-3 text-gray-400" />
              <span className="text-gray-800 font-mono">{deviceInfo.connection_type}</span>
            </div>
          )}
          {deviceInfo.device_pixel_ratio && (
            <div>
              <span className="text-gray-500">DPR: </span>
              <span className="text-gray-800 font-mono">{deviceInfo.device_pixel_ratio}x</span>
            </div>
          )}
          {deviceInfo.max_touch_points != null && (
            <div>
              <span className="text-gray-500">Touch: </span>
              <span className="text-gray-800 font-mono">{deviceInfo.max_touch_points > 0 ? `Sí (${deviceInfo.max_touch_points})` : 'No'}</span>
            </div>
          )}
          {deviceInfo.user_agent && (
            <div className="col-span-2 mt-1">
              <span className="text-gray-500">UA: </span>
              <p className="text-gray-600 font-mono break-all text-[10px] leading-tight">{deviceInfo.user_agent}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}