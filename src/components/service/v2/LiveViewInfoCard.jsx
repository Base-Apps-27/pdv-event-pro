import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';

/**
 * LiveViewInfoCard - Displays event/service metadata with expandable details
 * 
 * @param {Object} props
 * @param {string} props.viewType - 'event' or 'service'
 * @param {Object} props.data - Event or Service data
 * @param {number} props.sessionCount - Total sessions (events only)
 * @param {number} props.segmentCount - Total segments
 */
export default function LiveViewInfoCard({ viewType, data, sessionCount = 0, segmentCount = 0 }) {
  const { t } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);

  if (!data) return null;

  const isEvent = viewType === 'event';

  return (
    <Card className={`bg-white border-2 border-gray-300 border-l-4 ${isEvent ? "border-l-pdv-teal" : "border-l-pdv-green"}`}>
      <CardContent className="p-6">
        <h2 className="text-3xl font-bold uppercase mb-2 text-gray-900">
          {data.name}
        </h2>
        
        {isEvent && data.theme && (
          <p className="text-xl text-pdv-green italic mb-4">"{data.theme}"</p>
        )}
        
        {!isEvent && data.description && (
          <p className="text-lg text-gray-600 mb-4">{data.description}</p>
        )}
        
        <div className="flex flex-wrap gap-4 text-sm mb-4 text-gray-700">
          {isEvent && data.start_date && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span>{data.start_date}</span>
              {data.end_date && <span> - {data.end_date}</span>}
            </div>
          )}
          
          {!isEvent && (
            <>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                <span>{data.day_of_week}</span>
              </div>
              {data.time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span>{data.time}</span>
                </div>
              )}
              {data.date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span>{data.date}</span>
                </div>
              )}
            </>
          )}
          
          {data.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-600" />
              <span>{data.location}</span>
            </div>
          )}
        </div>

        {/* Toggle Details Button (Events only) */}
        {isEvent && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="mb-4 border-2 border-gray-400 bg-white text-gray-900 font-semibold"
          >
            {showDetails ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            {showDetails ? (t('common.hideDetails') || 'Ocultar Detalles') : (t('common.showDetails') || 'Ver Más Detalles')}
          </Button>
        )}

        {/* Expanded Details (Events only) */}
        {showDetails && isEvent && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            {data.description && (
              <div>
                <p className="font-semibold text-gray-900 mb-1">{t('common.description') || 'Descripción'}:</p>
                <p className="text-gray-700">{data.description}</p>
              </div>
            )}
            
            {data.announcement_blurb && (
              <div>
                <p className="font-semibold text-gray-900 mb-1">{t('common.announcement') || 'Anuncio'}:</p>
                <p className="text-gray-700">{data.announcement_blurb}</p>
              </div>
            )}
            
            {data.promotion_targets && data.promotion_targets.length > 0 && (
              <div>
                <p className="font-semibold text-gray-900 mb-1">{t('common.audience') || 'Audiencia'}:</p>
                <div className="flex flex-wrap gap-2">
                  {data.promotion_targets.map((target, idx) => (
                    <Badge key={idx} variant="outline">{target}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="font-semibold text-gray-900 mb-1">{t('common.totalSessions') || 'Total Sesiones'}:</p>
                <p className="text-2xl font-bold text-pdv-teal">{sessionCount}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">{t('common.totalSegments') || 'Total Segmentos'}:</p>
                <p className="text-2xl font-bold text-pdv-teal">{segmentCount}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}