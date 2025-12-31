import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { getSegmentData } from "@/components/utils/segmentDataUtils";

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  logo: {
    position: 'absolute',
    left: -12,
    top: -12,
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  date: {
    fontSize: 13,
    color: '#333333',
    marginTop: 4,
    fontWeight: 500,
    textAlign: 'center',
  },
  rolesLine: {
    fontSize: 9.5,
    color: '#666666',
    textAlign: 'center',
    marginTop: 6,
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: 22,
    flex: 1,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  timeAccent: {
    color: '#C0392B',
    fontWeight: 600,
  },
  segment: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  segmentTime: {
    fontSize: 10,
    color: '#C0392B',
    fontWeight: 600,
    marginBottom: 2,
  },
  segmentTitle: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  segmentDetail: {
    fontSize: 10,
    color: '#333333',
    marginTop: 2,
    lineHeight: 1.3,
  },
  segmentName: {
    color: '#1FBA70',
    fontWeight: 600,
  },
  segmentNote: {
    fontSize: 9.5,
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  recesoBlock: {
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6E6E6',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
    textAlign: 'center',
  },
  recesoTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#1A1A1A',
  },
  recesoNote: {
    fontSize: 9.5,
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: -28,
    left: -12,
    right: -12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E6E6E6',
    textAlign: 'center',
    fontSize: 9,
    color: '#666666',
  },
  footerAccent: {
    color: '#1FBA70',
    fontWeight: 600,
  },
});

export default function ServiceProgramPage1({ serviceData, selectedDate, scale = 100 }) {
  const isCustomService = serviceData?.segments && serviceData.segments.length > 0;

  const buildRolesLine = () => {
    if (!serviceData) return '';
    
    const roles = [];
    
    // Helper to get main value from object or string
    const getVal = (field) => {
      const val = serviceData[field];
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (isCustomService && val.main) return val.main; // Handle normalized object
      // For standard services or unnormalized
      return val['9:30am'] || val['11:30am'] || val.main;
    };

    const coord = getVal('coordinators');
    const ujier = getVal('ujieres');
    const sound = getVal('sound');
    const luces = getVal('luces');
    
    if (coord) roles.push(`Coordinador: ${coord}`);
    if (ujier) roles.push(`Ujier: ${ujier}`);
    if (sound) roles.push(`Sonido: ${sound}`);
    if (luces) roles.push(`Luces: ${luces}`);
    
    return roles.join(' • ');
  };

  const rolesLine = buildRolesLine();
  const scaleFactor = scale / 100;

  const scaledStyles = StyleSheet.create({
    scaledTitle: { fontSize: 20 * scaleFactor },
    scaledDate: { fontSize: 13 * scaleFactor },
    scaledRolesLine: { fontSize: 9.5 * scaleFactor },
    scaledColumnHeader: { fontSize: 12 * scaleFactor },
    scaledSegmentTime: { fontSize: 10 * scaleFactor },
    scaledSegmentTitle: { fontSize: 10.5 * scaleFactor },
    scaledSegmentDetail: { fontSize: 10 * scaleFactor },
    scaledSegmentNote: { fontSize: 9.5 * scaleFactor },
    scaledRecesoTitle: { fontSize: 11 * scaleFactor },
    scaledRecesoNote: { fontSize: 9.5 * scaleFactor },
  });

  // Separate render function for Standard Weekly Service Column (e.g. 9:30am, 11:30am)
  const renderStandardServiceColumn = (timeSlot, timeLabel, segments) => {
    // If no segments or empty list
    if (!segments || segments.length === 0) {
      return (
        <View style={styles.column}>
          <Text style={[styles.columnHeader, scaledStyles.scaledColumnHeader]}>
            <Text style={styles.timeAccent}>{timeLabel}</Text>
          </Text>
          <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
            No hay segmentos
          </Text>
        </View>
      );
    }

    const validSegments = segments.filter(s => s && s.type !== 'break');

    if (validSegments.length === 0) {
      return (
        <View style={styles.column}>
          <Text style={[styles.columnHeader, scaledStyles.scaledColumnHeader]}>
            <Text style={styles.timeAccent}>{timeLabel}</Text>
          </Text>
          <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
            No hay segmentos
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.column}>
        <Text style={[styles.columnHeader, scaledStyles.scaledColumnHeader]}>
          <Text style={styles.timeAccent}>{timeLabel}</Text>
        </Text>
        {validSegments.map((segment, idx) => (
          <View key={idx} style={styles.segment}>
            {segment.duration && (
              <Text style={[styles.segmentTime, scaledStyles.scaledSegmentTime]}>
                {segment.duration} min
              </Text>
            )}
            
            <Text style={[styles.segmentTitle, scaledStyles.scaledSegmentTitle]}>
              {(['Especial', 'Special', 'special'].includes(segment.segment_type || segment.type || segment.data?.type || segment.data?.segment_type)) && (
                <Text style={{ color: '#f59e0b' }}>★ </Text>
              )}
              {segment.title}
            </Text>
            
            {segment.data?.leader && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                Dirige: <Text style={styles.segmentName}>{segment.data.leader}</Text>
              </Text>
            )}

            {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
              <View style={{ marginTop: 3 }}>
                {segment.songs.filter(s => s.title).map((song, sIdx) => (
                  <Text key={sIdx} style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                    • {song.title} {song.lead && `(${song.lead})`}
                  </Text>
                ))}
              </View>
            )}

            {/* Sub-assignments (excluding cierre, shown after speaker) */}
            {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name !== 'cierre_leader').map((subAssign, saIdx) => {
              const personValue = segment.data?.[subAssign.person_field_name];
              if (!personValue) return null;
              return (
                <Text key={saIdx} style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                  • {subAssign.label}: <Text style={styles.segmentName}>{personValue}</Text> {subAssign.duration_min && `(${subAssign.duration_min} min)`}
                </Text>
              );
            })}

            {/* Legacy ministry_leader fallback */}
            {(!segment.sub_assignments || segment.sub_assignments.length === 0) && segment.data?.ministry_leader && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                • Ministración: <Text style={styles.segmentName}>{segment.data.ministry_leader}</Text> (5 min)
              </Text>
            )}

            {segment.data?.translator && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                Traduce: <Text style={styles.segmentName}>{segment.data.translator}</Text>
              </Text>
            )}

            {segment.data?.presenter && !segment.data?.ministry_leader && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                <Text style={styles.segmentName}>{segment.data.presenter}</Text>
              </Text>
            )}

            {segment.data?.preacher && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                <Text style={styles.segmentName}>{segment.data.preacher}</Text>
              </Text>
            )}

            {/* Cierre sub-assignment (shown after speaker) */}
            {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name === 'cierre_leader').map((subAssign, saIdx) => {
              const personValue = segment.data?.[subAssign.person_field_name];
              if (!personValue) return null;
              return (
                <Text key={saIdx} style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                  • {subAssign.label}: <Text style={styles.segmentName}>{personValue}</Text> {subAssign.duration_min && `(${subAssign.duration_min} min)`}
                </Text>
              );
            })}

            {segment.data?.title && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                {segment.data.title}
              </Text>
            )}

            {segment.data?.verse && (
              <Text style={[styles.segmentNote, scaledStyles.scaledSegmentNote]}>
                {segment.data.verse}
              </Text>
            )}

            {segment.data?.notes && (
              <Text style={[styles.segmentNote, scaledStyles.scaledSegmentNote]}>
                {segment.data.notes}
              </Text>
            )}

            {segment.actions && segment.actions.length > 0 && (
              <View style={{ marginTop: 3 }}>
                {segment.actions.map((action, aIdx) => {
                  const safeAction = typeof action === 'object' && action !== null ? action : {};
                  return (
                  <Text key={aIdx} style={[styles.segmentNote, scaledStyles.scaledSegmentNote]}>
                    • {safeAction.label || ''}
                    {safeAction.timing === "before_end" && safeAction.offset_min ? ` (${safeAction.offset_min} min antes)` : ''}
                  </Text>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Separate render function for Custom Service (Single Full Column)
  const renderCustomServiceLayout = (segments) => {
    if (!segments || segments.length === 0) {
      return (
        <View style={styles.column}>
           <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail, { textAlign: 'center', marginTop: 20 }]}>
            No hay segmentos definidos para este servicio.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.column}>
        {/* No column header for custom single layout */}
        {segments.map((segment, idx) => {
          const getData = (field) => getSegmentData(segment, field);
          const segmentType = segment.segment_type || segment.type || getData('type') || 'Especial';
          const isWorship = ['Alabanza', 'worship'].includes(segmentType);
          const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
          const isOffering = ['Ofrenda', 'offering'].includes(segmentType);

          const leader = isWorship ? getData('leader') : null;
          const preacher = isMessage ? getData('preacher') : null;
          const presenter = (!isWorship && !isMessage) ? getData('presenter') : null;
          
          const translator = getData('translator');
          const songs = isWorship ? getData('songs') : null;
          const messageTitle = isMessage ? getData('messageTitle') : null;
          const verse = (isMessage || isOffering) ? getData('verse') : null;
          
          const description = getData('description');
          const description_details = getData('description_details');
          const coordinator_notes = getData('coordinator_notes');
          const projection_notes = getData('projection_notes');
          const sound_notes = getData('sound_notes');
          const ushers_notes = getData('ushers_notes');
          const actions = getData('actions');

          return (
          <View key={idx} style={styles.segment}>
            {segment.duration && (
              <Text style={[styles.segmentTime, scaledStyles.scaledSegmentTime]}>
                {segment.duration} min
              </Text>
            )}
            
            <Text style={[styles.segmentTitle, scaledStyles.scaledSegmentTitle]}>
              {(['Especial', 'Special', 'special'].includes(segment.segment_type || segment.type || segment.data?.type || segment.data?.segment_type)) && (
                <Text style={{ color: '#f59e0b' }}>★ </Text>
              )}
              {segment.title}
            </Text>
            
            {/* Custom Service Specific Fields (Top Level) */}
            {leader && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                Dirige: <Text style={styles.segmentName}>{leader}</Text>
              </Text>
            )}
            {preacher && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                Predica: <Text style={styles.segmentName}>{preacher}</Text>
              </Text>
            )}
            {presenter && !leader && !preacher && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                <Text style={styles.segmentName}>{presenter}</Text>
              </Text>
            )}
            {translator && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                Traduce: <Text style={styles.segmentName}>{translator}</Text>
              </Text>
            )}

            {songs && songs.filter(s => s.title).length > 0 && (
              <View style={{ marginTop: 3 }}>
                {songs.filter(s => s.title).map((song, sIdx) => (
                  <Text key={sIdx} style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                    • {song.title} {song.lead && `(${song.lead})`}
                  </Text>
                ))}
              </View>
            )}

            {messageTitle && (
              <Text style={[styles.segmentDetail, scaledStyles.scaledSegmentDetail]}>
                {messageTitle}
              </Text>
            )}

            {verse && (
              <Text style={[styles.segmentNote, scaledStyles.scaledSegmentNote]}>
                {verse}
              </Text>
            )}

            {/* Additional Custom Service Fields */}
            {(description || description_details) && (
              <Text style={[styles.segmentNote, scaledStyles.scaledSegmentNote]}>
                {description || description_details}
              </Text>
            )}
            
            {/* Technical Notes Block for Custom Services */}
            {(coordinator_notes || projection_notes || sound_notes || ushers_notes) && (
              <View style={{ marginTop: 4, paddingLeft: 4, borderLeftWidth: 1, borderLeftColor: '#DDD' }}>
                {coordinator_notes && <Text style={[styles.segmentNote, scaledStyles.scaledSegmentNote, {color: '#4F46E5'}]}>Coord: {coordinator_notes}</Text>}
                {projection_notes && <Text style={[styles.segmentNote, scaledStyles.scaledSegmentNote, {color: '#7C3AED'}]}>Proj: {projection_notes}</Text>}
                {sound_notes && <Text style={[styles.segmentNote, scaledStyles.scaledSegmentNote, {color: '#DC2626'}]}>Sound: {sound_notes}</Text>}
              </View>
            )}

            {actions && actions.length > 0 && (
              <View style={{ marginTop: 3 }}>
                {actions.map((action, aIdx) => {
                  const safeAction = typeof action === 'object' && action !== null ? action : {};
                  return (
                  <Text key={aIdx} style={[styles.segmentNote, scaledStyles.scaledSegmentNote]}>
                    • {safeAction.label || ''}
                    {safeAction.timing === "before_end" && safeAction.offset_min ? ` (${safeAction.offset_min} min antes)` : ''}
                  </Text>
                  );
                })}
              </View>
            )}
          </View>
        )})}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.container}>
          <Image src={LOGO_URL} style={styles.logo} />
          
          <View style={styles.header}>
            <Text style={[styles.title, scaledStyles.scaledTitle]}>{serviceData?.name || "ORDEN DE SERVICIO"}</Text>
            <Text style={[styles.date, scaledStyles.scaledDate]}>
              {serviceData?.day_of_week || "Domingo"} {selectedDate} {serviceData?.time && `• ${serviceData.time}`}
            </Text>
            {rolesLine && (
              <Text style={[styles.rolesLine, scaledStyles.scaledRolesLine]}>
                {rolesLine}
              </Text>
            )}
          </View>

          <View style={styles.columnsContainer}>
            {isCustomService ? (
              // Single column for custom services
              renderCustomServiceLayout(serviceData.segments)
            ) : (
              // Dual column for weekly services
              <>
                {renderStandardServiceColumn('9:30am', '9:30 A.M.', serviceData?.['9:30am'])}
                {renderStandardServiceColumn('11:30am', '11:30 A.M.', serviceData?.['11:30am'])}
              </>
            )}
          </View>

          {/* Only show Receso block for Standard Services */}
          {!isCustomService && serviceData?.receso_notes?.['9:30am'] && (
            <View style={styles.recesoBlock}>
              <Text style={[styles.recesoTitle, scaledStyles.scaledRecesoTitle]}>Receso</Text>
              <Text style={[styles.recesoNote, scaledStyles.scaledRecesoNote]}>
                {serviceData.receso_notes['9:30am']}
              </Text>
            </View>
          )}

          <Text style={styles.footer}>
            Palabras de Vida • <Text style={styles.footerAccent}>¡Atrévete a cambiar!</Text>
          </Text>
        </View>
      </Page>
    </Document>
  );
}