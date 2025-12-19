import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { base44 } from '@/api/base44Client';

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
  columnsContainer: {
    flexDirection: 'row',
    gap: 22, // ~0.30in gutter
    flex: 1,
  },
  column: {
    flex: 1,
  },
  announcementItem: {
    marginBottom: 14,
  },
  announcementMarker: {
    width: 3,
    height: 12,
    backgroundColor: '#1FBA70',
    marginRight: 6,
  },
  announcementTitle: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  announcementContent: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.3,
    marginTop: 4,
  },
  announcementCue: {
    fontSize: 9.5,
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 6,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#E6E6E6',
  },
  cueLabel: {
    fontWeight: 600,
    fontStyle: 'normal',
    textTransform: 'uppercase',
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  announcementDate: {
    fontSize: 9,
    color: '#666666',
    marginTop: 4,
  },
  announcementDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginTop: 12,
    marginBottom: 12,
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

// Helper to sanitize and strip HTML
const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

// Strip "CUE:" prefix if present
const stripCuePrefix = (text) => {
  if (!text) return '';
  return text.replace(/^CUE:\s*/i, '');
};

export default function ServiceProgramPage2({
  selectedDate,
  selectedAnnouncements = [],
  scale = 100
}) {
  const scaleFactor = scale / 100;
  const getScaledSize = (baseSize) => baseSize * scaleFactor;

  // Fetch all announcement items (will be filtered by selectedAnnouncements)
  const [announcements, setAnnouncements] = React.useState([]);

  React.useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const allAnnouncements = await base44.entities.AnnouncementItem.list();
        const filtered = allAnnouncements.filter(a => selectedAnnouncements.includes(a.id));
        setAnnouncements(filtered);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      }
    };
    fetchAnnouncements();
  }, [selectedAnnouncements]);

  // Split announcements into two columns
  const midpoint = Math.ceil(announcements.length / 2);
  const leftAnnouncements = announcements.slice(0, midpoint);
  const rightAnnouncements = announcements.slice(midpoint);

  const renderAnnouncement = (ann, index, total) => {
    if (!ann) return null;

    const title = ann.title || ann.announcement_title || 'Sin título';
    const content = sanitizeText(ann.content || ann.announcement_description || '');
    const cue = ann.instructions ? sanitizeText(stripCuePrefix(ann.instructions)) : '';
    const date = ann.date_of_occurrence || '';

    const showDivider = index < total - 1;

    return (
      <View key={ann.id}>
        <View style={styles.announcementItem}>
          <View style={styles.announcementTitle}>
            <View style={styles.announcementMarker} />
            <Text style={{ fontSize: getScaledSize(10.5) }}>{title}</Text>
          </View>
          {content && (
            <Text style={[styles.announcementContent, { fontSize: getScaledSize(10) }]}>
              {content}
            </Text>
          )}
          {cue && (
            <View style={styles.announcementCue}>
              <Text style={{ fontSize: getScaledSize(9.5) }}>
                <Text style={styles.cueLabel}>CUE:</Text> {cue}
              </Text>
            </View>
          )}
          {date && (
            <Text style={[styles.announcementDate, { fontSize: getScaledSize(9) }]}>
              {date}
            </Text>
          )}
        </View>
        {showDivider && <View style={styles.announcementDivider} />}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Image src={LOGO_URL} style={styles.logo} />
      
      <View style={styles.header}>
        <Text style={styles.title}>ANUNCIOS</Text>
        <Text style={styles.date}>Domingo {selectedDate}</Text>
      </View>

      {announcements.length > 0 ? (
        <View style={styles.columnsContainer}>
          <View style={styles.column}>
            {leftAnnouncements.map((ann, i) => renderAnnouncement(ann, i, leftAnnouncements.length))}
          </View>
          <View style={styles.column}>
            {rightAnnouncements.map((ann, i) => renderAnnouncement(ann, i, rightAnnouncements.length))}
          </View>
        </View>
      ) : (
        <View style={{ padding: 30, textAlign: 'center' }}>
          <Text style={{ color: '#666666', fontSize: getScaledSize(10) }}>
            No hay anuncios seleccionados / No announcements selected
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