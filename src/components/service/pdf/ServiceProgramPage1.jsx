import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';

// Placeholder logo URL - replace with actual logo
const LOGO_URL = 'https://via.placeholder.com/72x72/1F8A70/FFFFFF?text=PDV';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: '100%',
  },
  logo: {
    position: 'absolute',
    left: -12, // 36pt from page edge - 48pt margin = -12pt relative
    top: -24, // 24pt from page edge - 48pt margin = -24pt relative
    width: 72,
    height: 72,
    objectFit: 'contain',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#1A1A1A',
  },
  date: {
    fontSize: 14,
    color: '#1F8A70',
    marginTop: 4,
  },
  rolesLine: {
    fontSize: 9.5,
    color: '#666666',
    textAlign: 'center',
    marginTop: 6,
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
  },
  column: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    padding: 8,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1A1A1A',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#1F8A70',
  },
  segment: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  segmentTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#1A1A1A',
  },
  segmentTime: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 2,
  },
  segmentDetails: {
    fontSize: 8,
    color: '#374151',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: -36, // Below margin
    left: -12,
    right: -12,
    textAlign: 'center',
    fontSize: 7,
    color: '#9CA3AF',
  },
});

export default function ServiceProgramPage1({ serviceData, selectedDate, scale = 100 }) {
  // Build dynamic roles line
  const buildRolesLine = () => {
    if (!serviceData) return '';
    
    const roles = [];
    const rolesData = serviceData.roles || {};
    
    if (rolesData.coordinadores) roles.push(`Coordinador: ${rolesData.coordinadores}`);
    if (rolesData.ujieres) roles.push(`Ujier: ${rolesData.ujieres}`);
    if (rolesData.sound) roles.push(`Sonido: ${rolesData.sound}`);
    if (rolesData.luces) roles.push(`Luces: ${rolesData.luces}`);
    
    return roles.join(' • ');
  };

  const rolesLine = buildRolesLine();
  const scaleFactor = scale / 100;

  // Apply scale to dynamic font sizes
  const scaledStyles = StyleSheet.create({
    scaledTitle: {
      fontSize: 24 * scaleFactor,
    },
    scaledDate: {
      fontSize: 14 * scaleFactor,
    },
    scaledRolesLine: {
      fontSize: 9.5 * scaleFactor,
    },
    scaledColumnHeader: {
      fontSize: 12 * scaleFactor,
    },
    scaledSegmentTitle: {
      fontSize: 10 * scaleFactor,
    },
    scaledSegmentTime: {
      fontSize: 8 * scaleFactor,
    },
    scaledSegmentDetails: {
      fontSize: 8 * scaleFactor,
    },
  });

  const renderServiceColumn = (timeSlot, data) => {
    if (!data?.segments || data.segments.length === 0) {
      return (
        <View style={styles.column}>
          <Text style={[styles.columnHeader, scaledStyles.scaledColumnHeader]}>{timeSlot}</Text>
          <Text style={[styles.segmentDetails, scaledStyles.scaledSegmentDetails]}>
            No hay segmentos / No segments
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.column}>
        <Text style={[styles.columnHeader, scaledStyles.scaledColumnHeader]}>{timeSlot}</Text>
        {data.segments.map((segment, idx) => (
          <View key={idx} style={styles.segment}>
            <Text style={[styles.segmentTitle, scaledStyles.scaledSegmentTitle]}>
              {segment.title || segment.segment_type}
            </Text>
            {segment.start_time && (
              <Text style={[styles.segmentTime, scaledStyles.scaledSegmentTime]}>
                {segment.start_time}
                {segment.duration_min && ` (${segment.duration_min} min)`}
              </Text>
            )}
            {segment.presenter && (
              <Text style={[styles.segmentDetails, scaledStyles.scaledSegmentDetails]}>
                {segment.presenter}
              </Text>
            )}
            {segment.description_details && (
              <Text style={[styles.segmentDetails, scaledStyles.scaledSegmentDetails]}>
                {segment.description_details}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Image src={LOGO_URL} style={styles.logo} />
      
      <View style={styles.header}>
        <Text style={[styles.title, scaledStyles.scaledTitle]}>ORDEN DE SERVICIO</Text>
        <Text style={[styles.date, scaledStyles.scaledDate]}>
          Domingo {selectedDate}
        </Text>
        {rolesLine && (
          <Text style={[styles.rolesLine, scaledStyles.scaledRolesLine]}>
            {rolesLine}
          </Text>
        )}
      </View>

      <View style={styles.columnsContainer}>
        {renderServiceColumn('9:30 AM', serviceData?.['9:30am'])}
        {renderServiceColumn('11:30 AM', serviceData?.['11:30am'])}
      </View>

      <Text style={styles.footer}>
        Palabras de Vida • ¡Atrévete a Cambiar!
      </Text>
    </View>
  );
}