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
  columnsContainer: {
    flexDirection: 'row',
    gap: 22,
    flex: 1,
  },
  column: {
    flex: 1,
  },
  announcement: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  announcementMarker: {
    width: 3,
    height: 10,
    backgroundColor: '#1FBA70',
    marginRight: 6,
  },
  announcementTitle: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  announcementContent: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.3,
    marginTop: 3,
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
    marginTop: 3,
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

// Strip HTML tags and sanitize text
const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
};

const stripCuePrefix = (text) => {
  if (!text) return '';
  return text.replace(/^CUE:\s*/i, '');
};

export default function ServiceProgramPage2({
  selectedDate,
  fixedAnnouncements,
  dynamicAnnouncements,
  selectedAnnouncements,
  scale = 100
}) {
  const scaleFactor = scale / 100;

  const scaledStyles = StyleSheet.create({
    scaledTitle: { fontSize: 20 * scaleFactor },
    scaledDate: { fontSize: 13 * scaleFactor },
    scaledAnnouncementTitle: { fontSize: 10.5 * scaleFactor },
    scaledAnnouncementContent: { fontSize: 10 * scaleFactor },
    scaledAnnouncementCue: { fontSize: 9.5 * scaleFactor },
    scaledAnnouncementDate: { fontSize: 9 * scaleFactor },
    scaledCueLabel: { fontSize: 8.5 * scaleFactor },
  });

  const selectedFixed = (fixedAnnouncements || []).filter(a => 
    selectedAnnouncements?.includes(a.id)
  );

  const selectedDynamic = (dynamicAnnouncements || []).filter(a => 
    selectedAnnouncements?.includes(a.id)
  );

  const renderAnnouncement = (announcement) => {
    const title = announcement.title || announcement.announcement_title || 'Sin título';
    const content = sanitizeText(announcement.content || announcement.announcement_description || '');
    const cue = announcement.instructions ? sanitizeText(stripCuePrefix(announcement.instructions)) : '';
    const date = announcement.date_of_occurrence || '';

    return (
      <View key={announcement.id} style={styles.announcement}>
        <View style={styles.announcementTitle}>
          <View style={styles.announcementMarker} />
          <Text style={scaledStyles.scaledAnnouncementTitle}>{title}</Text>
        </View>
        
        {content && (
          <Text style={[styles.announcementContent, scaledStyles.scaledAnnouncementContent]}>
            {content}
          </Text>
        )}
        
        {cue && (
          <Text style={[styles.announcementCue, scaledStyles.scaledAnnouncementCue]}>
            <Text style={[styles.cueLabel, scaledStyles.scaledCueLabel]}>CUE:</Text> {cue}
          </Text>
        )}
        
        {date && (
          <Text style={[styles.announcementDate, scaledStyles.scaledAnnouncementDate]}>
            {date}
          </Text>
        )}
      </View>
    );
  };

  const renderEvent = (event) => {
    const name = event.name || 'Evento sin nombre';
    const description = sanitizeText(event.announcement_blurb || event.description || '');
    const date = event.start_date || '';

    return (
      <View key={event.id} style={styles.announcement}>
        <View style={styles.announcementTitle}>
          <View style={styles.announcementMarker} />
          <Text style={scaledStyles.scaledAnnouncementTitle}>{name}</Text>
        </View>
        
        {date && (
          <Text style={[styles.announcementDate, scaledStyles.scaledAnnouncementDate]}>
            {date}
          </Text>
        )}
        
        {description && (
          <Text style={[styles.announcementContent, scaledStyles.scaledAnnouncementContent]}>
            {description}
          </Text>
        )}
      </View>
    );
  };

  // Split announcements between columns
  const midpoint = Math.ceil(selectedFixed.length / 2);
  const leftAnnouncements = selectedFixed.slice(0, midpoint);
  const rightAnnouncements = selectedFixed.slice(midpoint);

  return (
    <View style={styles.container}>
      <Image src={LOGO_URL} style={styles.logo} />
      
      <View style={styles.header}>
        <Text style={[styles.title, scaledStyles.scaledTitle]}>ANUNCIOS</Text>
        <Text style={[styles.date, scaledStyles.scaledDate]}>
          Domingo {selectedDate}
        </Text>
      </View>

      <View style={styles.columnsContainer}>
        <View style={styles.column}>
          {leftAnnouncements.length === 0 ? (
            <Text style={[styles.announcementContent, scaledStyles.scaledAnnouncementContent]}>
              No hay anuncios seleccionados
            </Text>
          ) : (
            leftAnnouncements.map(renderAnnouncement)
          )}
        </View>

        <View style={styles.column}>
          {rightAnnouncements.length > 0 && rightAnnouncements.map(renderAnnouncement)}
          {selectedDynamic.length > 0 && selectedDynamic.map(renderEvent)}
          {rightAnnouncements.length === 0 && selectedDynamic.length === 0 && (
            <Text style={[styles.announcementContent, scaledStyles.scaledAnnouncementContent]}>
              No hay eventos seleccionados
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.footer}>
        Palabras de Vida • <Text style={styles.footerAccent}>¡Atrévete a cambiar!</Text>
      </Text>
    </View>
  );
}