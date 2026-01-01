import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const createStyles = (scale = 1.0) => StyleSheet.create({
  content: {
    flex: 1,
    paddingBottom: 20
  },
  header: {
    textAlign: 'center',
    marginBottom: 12 * scale,
    paddingBottom: 8 * scale,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  title: {
    fontSize: 20 * scale,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#1a1a1a',
    marginBottom: 4 * scale
  },
  subtitle: {
    fontSize: 14 * scale,
    color: '#4b5563',
    marginBottom: 4 * scale
  },
  teamLine: {
    fontSize: 11 * scale,
    color: '#6b7280',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4
  },
  teamItem: {
    marginHorizontal: 4
  },
  segment: {
    marginBottom: 8 * scale,
    paddingBottom: 6 * scale,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3 * scale
  },
  segmentTitle: {
    fontSize: 12 * scale,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#1a1a1a'
  },
  timeLabel: {
    fontSize: 12 * scale,
    color: '#4b5563',
    marginRight: 8 * scale
  },
  duration: {
    fontSize: 10 * scale,
    color: '#9ca3af',
    marginLeft: 4 * scale
  },
  personLine: {
    fontSize: 11 * scale,
    color: '#2563eb',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2 * scale
  },
  translator: {
    fontSize: 10 * scale,
    color: '#6b7280',
    marginBottom: 2 * scale
  },
  songsContainer: {
    marginTop: 4 * scale,
    paddingLeft: 8 * scale,
    borderLeftWidth: 2,
    borderLeftColor: '#16a34a'
  },
  song: {
    fontSize: 10 * scale,
    color: '#16a34a',
    marginBottom: 2 * scale
  },
  messageTitle: {
    fontSize: 10.5 * scale,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 2 * scale
  },
  verse: {
    fontSize: 10 * scale,
    color: '#9ca3af',
    marginTop: 2 * scale
  },
  noteDesc: {
    fontSize: 10 * scale,
    color: '#14532d',
    backgroundColor: '#f0fdf4',
    padding: 4 * scale,
    marginTop: 4 * scale,
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a'
  },
  noteDetails: {
    fontSize: 10 * scale,
    color: '#1f2937',
    backgroundColor: '#f3f4f6',
    padding: 6 * scale,
    marginTop: 4 * scale,
    borderLeftWidth: 4,
    borderLeftColor: '#4b5563'
  },
  noteLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9 * scale,
    textTransform: 'uppercase',
    marginBottom: 2 * scale
  },
  noteTeam: {
    fontSize: 9.5 * scale,
    marginTop: 3 * scale,
    paddingLeft: 6 * scale,
    borderLeftWidth: 3
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    height: 20,
    backgroundColor: '#1F8A70',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  footerText: {
    fontSize: 10,
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  specialIndicator: {
    color: '#f59e0b',
    marginRight: 4 * scale
  }
});

export default function CustomServicePdfPage1({ model }) {
  const styles = createStyles(model.page1Scale);

  const teamItems = [];
  if (model.coordinators) teamItems.push(`Coord: ${model.coordinators}`);
  if (model.ujieres) teamItems.push(`Ujier: ${model.ujieres}`);
  if (model.sound) teamItems.push(`Sonido: ${model.sound}`);
  if (model.luces) teamItems.push(`Luces: ${model.luces}`);
  if (model.fotografia) teamItems.push(`Foto: ${model.fotografia}`);

  return (
    <>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{model.serviceName}</Text>
          <Text style={styles.subtitle}>
            {model.dayOfWeek} {model.date} {model.time && `• ${model.time}`}
          </Text>
          {teamItems.length > 0 && (
            <View style={styles.teamLine}>
              {teamItems.map((item, idx) => (
                <Text key={idx} style={styles.teamItem}>
                  {idx > 0 && '/ '}
                  {item}
                </Text>
              ))}
            </View>
          )}
        </View>

        {model.segments.map((seg) => (
          <View key={seg.id} style={styles.segment}>
            <View style={styles.segmentHeader}>
              {seg.isSpecial && <Text style={styles.specialIndicator}>✨</Text>}
              {seg.timeLabel && <Text style={styles.timeLabel}>{seg.timeLabel}</Text>}
              <Text style={styles.segmentTitle}>{seg.title}</Text>
              {seg.duration && <Text style={styles.duration}>({seg.duration} min)</Text>}
            </View>

            {seg.personLine && <Text style={styles.personLine}>{seg.personLine}</Text>}
            {seg.translator && <Text style={styles.translator}>🌐 {seg.translator}</Text>}

            {seg.songs && seg.songs.length > 0 && (
              <View style={styles.songsContainer}>
                {seg.songs.map((song, idx) => (
                  <Text key={idx} style={styles.song}>- {song}</Text>
                ))}
              </View>
            )}

            {seg.messageTitle && <Text style={styles.messageTitle}>{seg.messageTitle}</Text>}
            {seg.verse && <Text style={styles.verse}>📖 {seg.verse}</Text>}

            {seg.notes.map((note, idx) => {
              if (note.type === 'description') {
                return <Text key={idx} style={styles.noteDesc}>{note.text}</Text>;
              }
              if (note.type === 'details') {
                return (
                  <View key={idx} style={styles.noteDetails}>
                    <Text style={styles.noteLabel}>📝 {note.label}:</Text>
                    <Text>{note.text}</Text>
                  </View>
                );
              }
              const colors = {
                coord: '#92400e',
                proj: '#1e40af',
                sound: '#991b1b',
                ushers: '#14532d',
                trans: '#4c1d95',
                stage: '#be185d'
              };
              return (
                <Text 
                  key={idx} 
                  style={[styles.noteTeam, { 
                    color: colors[note.type] || '#6b7280',
                    borderLeftColor: colors[note.type] || '#9ca3af'
                  }]}
                >
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>{note.label}:</Text> {note.text}
                </Text>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¡Atrévete a cambiar!</Text>
      </View>
    </>
  );
}