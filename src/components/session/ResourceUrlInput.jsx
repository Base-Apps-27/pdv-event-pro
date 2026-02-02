/**
 * ResourceUrlInput - Reusable URL input with metadata fetch capability
 * 
 * Branch: Segment Resource Links Enhancement
 * Parent: Live Director improvements
 * 
 * Features:
 * - URL input with validation
 * - "Fetch Info" button to retrieve title/thumbnail
 * - Displays fetched thumbnail preview
 * - Shows loading state during fetch
 */

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import { toast } from "sonner";

export default function ResourceUrlInput({
  label,
  urlValue,
  onUrlChange,
  metaValue,
  onMetaChange,
  placeholder = "https://...",
  showThumbnail = true,
  className = ""
}) {
  const { t } = useLanguage();
  const [isFetching, setIsFetching] = useState(false);

  const handleFetchMetadata = async () => {
    if (!urlValue || !urlValue.trim()) {
      toast.error(t('resources.fetchFailed'));
      return;
    }

    setIsFetching(true);
    try {
      const response = await base44.functions.invoke('fetchUrlMetadata', { url: urlValue.trim() });
      const data = response.data;

      if (data.error) {
        toast.error(t('resources.fetchFailed'));
        console.warn('Metadata fetch error:', data.error);
      } else {
        onMetaChange({
          title: data.title,
          thumbnail: data.thumbnail,
          fetched_at: data.fetched_at || new Date().toISOString()
        });
        toast.success(t('resources.fetchSuccess'));
      }
    } catch (error) {
      console.error('Fetch metadata error:', error);
      toast.error(t('resources.fetchFailed'));
    } finally {
      setIsFetching(false);
    }
  };

  const hasUrl = urlValue && urlValue.trim();
  const hasMeta = metaValue && (metaValue.title || metaValue.thumbnail);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label className="text-xs">{label}</Label>}
      
      <div className="flex gap-2">
        <Input
          value={urlValue || ""}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-9 text-sm"
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFetchMetadata}
          disabled={!hasUrl || isFetching}
          className="h-9 px-3 whitespace-nowrap"
        >
          {isFetching ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              {t('resources.fetching')}
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-1" />
              {t('resources.fetchInfo')}
            </>
          )}
        </Button>
      </div>

      {/* Metadata Display */}
      {hasMeta && (
        <div className="flex items-start gap-3 p-2 bg-gray-50 rounded border border-gray-200">
          {/* Thumbnail */}
          {showThumbnail && metaValue.thumbnail && (
            <img 
              src={metaValue.thumbnail} 
              alt={metaValue.title || "Thumbnail"}
              className="w-16 h-12 object-cover rounded flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          
          {/* Title and Status */}
          <div className="flex-1 min-w-0">
            {metaValue.title && (
              <p className="text-sm font-medium text-gray-800 truncate">
                {metaValue.title}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">
                {metaValue.fetched_at 
                  ? new Date(metaValue.fetched_at).toLocaleDateString() 
                  : 'Fetched'}
              </span>
            </div>
          </div>

          {/* Open Link Button */}
          {hasUrl && (
            <a
              href={urlValue}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-pdv-teal p-1"
              title={t('resources.open')}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* No metadata yet but has URL */}
      {hasUrl && !hasMeta && !isFetching && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {t('resources.fetchInfo')} to preview
        </p>
      )}
    </div>
  );
}