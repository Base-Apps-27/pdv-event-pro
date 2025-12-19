import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';

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
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  header: {
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#1A1A1A',
  },
  date: {
    fontSize: 13,
    fontWeight: 600,
    color: '#333333',
    marginTop: 4,
  },
  rolesLine: {
    fontSize: 9.5,
    color: '#666666',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: '90%',
    alignSelf: 'center',
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: 22, // ~0.30in gutter
    flex: 1,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1A1A1A',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  timeAccent: {
    color: '#C0392B',
    fontWeight: 600,
  },
  segment: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  segmentTime: {
    fontSize: 10,
    color: '#C0392B',
    fontWeight: 600,
    marginBottom: 3,
  },
  segmentTitle: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 3,
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
    marginTop: 16,
    marginBottom: 16,
    paddingTop: 10,
    paddingBottom: 10,
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
    marginBottom: 4,
  },
  recesoNote: {
    fontSize: 9.5,
    color: '#666666',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: -24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#666666',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6E6E6',
  },
  footerAccent: {
    color: '#1FBA70',
    fontWeight: 600,
  },
});

export default function ServiceProgramPage1({ serviceData, selectedDate, scale = 100 }) {
  const scaleFactor = scale / 100;

  // Build dynamic roles line
  const buildRolesLine = () => {
    if (!serviceData) return '';
    
    const roles = [];
    
    const coord = serviceData.coordinators?.['9:30am'] || serviceData.coordinators?.['11:30am'];
    const ujier = serviceData.ujieres?.['9:30am'] || serviceData.ujieres?.['11:30am'];
    const sound = serviceData.sound?.['9:30am'] || serviceData.sound?.['11:30am'];
    const luces = serviceData.luces?.['9:30am'] || serviceData.luces?.['11:30am'];
    
    if (coord) roles.push(`Coordinador: ${coord}`);
    if (ujier) roles.push(`Ujier: ${ujier}`);
    if (sound) roles.push(`Sonido: ${sound}`);
    if (luces) roles.push(`Luces: ${luces}`);
    
    return roles.join(' • ');
  };

  const rolesLine = buildRolesLine();

  // Apply scale to dynamic font sizes (keeping header/footer fixed)
  const getScaledSize = (baseSize) => baseSize * scaleFactor;

  const renderServiceColumn = (timeSlot, segments) => {
    if (!segments || segments.length === 0) {
      return (
        <View style={styles.column}>
          <Text style={[styles.columnHeader, { fontSize: getScaledSize(12) }]}>
            <Text style={styles.timeAccent}>{timeSlot}</Text>
          </Text>
          <Text style={{ fontSize: getScaledSize(10), color: '#666666' }}>
            No hay segmentos
          </Text>
        </View>
      );
    }

    const validSegments = segments.filter(s => s && s.type !== 'break');

    if (validSegments.length === 0) {
      return (
        <View style={styles.column}>
          <Text style={[styles.columnHeader, { fontSize: getScaledSize(12) }]}>
            <Text style={styles.timeAccent}>{timeSlot}</Text>
          </Text>
          <Text style={{ fontSize: getScaledSize(10), color: '#666666' }}>
            No hay segmentos
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.column}>
        <Text style={[styles.columnHeader, { fontSize: getScaledSize(12) }]}>
          <Text style={styles.timeAccent}>{timeSlot}</Text>
        </Text>
        {validSegments.map((segment, idx) => {
          const title = segment.title || 'Sin título';
          const duration = segment.duration || '';
          const data = segment.data || {};

          return (
            <View key={idx} style={styles.segment}>
              {duration && (
                <Text style={[styles.segmentTime, { fontSize: getScaledSize(10) }]}>
                  {duration} min
                </Text>
              )}
              <Text style={[styles.segmentTitle, { fontSize: getScaledSize(10.5) }]}>
                {title}
              </Text>
              {data.leader && (
                <Text style={[styles.segmentDetail, { fontSize: getScaledSize(10) }]}>
                  Dirige: <Text style={styles.segmentName}>{data.leader}</Text>
                </Text>
              )}
              {data.presenter && (
                <Text style={[styles.segmentDetail, { fontSize: getScaledSize(10) }]}>
                  <Text style={styles.segmentName}>{data.presenter}</Text>
                </Text>
              )}
              {data.preacher && (
                <Text style={[styles.segmentDetail, { fontSize: getScaledSize(10) }]}>
                  <Text style={styles.segmentName}>{data.preacher}</Text>
                </Text>
              )}
              {data.title && (
                <Text style={[styles.segmentDetail, { fontSize: getScaledSize(10) }]}>
                  {data.title}
                </Text>
              )}
              {data.notes && (
                <Text style={[styles.segmentNote, { fontSize: getScaledSize(9.5) }]}>
                  {data.notes}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Image src={LOGO_URL} style={styles.logo} />
      
      <View style={styles.header}>
        <Text style={styles.title}>ORDEN DE SERVICIO</Text>
        <Text style={styles.date}>Domingo {selectedDate}</Text>
        {rolesLine && (
          <Text style={styles.rolesLine}>{rolesLine}</Text>
        )}
      </View>

      <View style={styles.columnsContainer}>
        {renderServiceColumn('9:30 A.M.', serviceData?.['9:30am'])}
        {renderServiceColumn('11:30 A.M.', serviceData?.['11:30am'])}
      </View>

      {serviceData?.receso_notes?.['9:30am'] && (
        <View style={styles.recesoBlock}>
          <Text style={[styles.recesoTitle, { fontSize: getScaledSize(11) }]}>
            Receso
          </Text>
          <Text style={[styles.recesoNote, { fontSize: getScaledSize(9.5) }]}>
            {serviceData.receso_notes['9:30am']}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text>
          Palabras de Vida • <Text style={styles.footerAccent}>¡Atrévete a cambiar!</Text>
        </Text>
      </View>
    </View>
  );
}