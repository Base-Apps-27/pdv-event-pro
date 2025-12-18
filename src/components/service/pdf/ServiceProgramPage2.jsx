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
    left: -12,
    top: -24,
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
  columnsContainer: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1A1A1A',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#1F8A70',
  },
  announcement: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  announcementTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  announcementBody: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.4,
  },
  announcementCue: {
    fontSize: 8,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  announcementDate: {
    fontSize: 8,
    color: '#1F8A70',
    fontWeight: 700,
    marginTop: 4,
  },
  emphasized: {
    backgroundColor: '#FEF3C7',
    padding: 6,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  footer: {
    position: 'absolute',
    bottom: -36,
    left: -12,
    right: -12,
    textAlign: 'center',
    fontSize: 7,
    color: '#9CA3AF',
  },
});

export default function ServiceProgramPage2({
  selectedDate,
  fixedAnnouncements,
  dynamicAnnouncements,
  selectedAnnouncements,
  scale = 100
}) {
  const scaleFactor = scale / 100;

  const scaledStyles = StyleSheet.create({
    scaledTitle: {
      fontSize: 24 * scaleFactor,
    },
    scaledDate: {
      fontSize: 14 * scaleFactor,
    },
    scaledColumnTitle: {
      fontSize: 14 * scaleFactor,
    },
    scaledAnnouncementTitle: {
      fontSize: 11 * scaleFactor,
    },
    scaledAnnouncementBody: {
      fontSize: 9 * scaleFactor,
    },
    scaledAnnouncementCue: {
      fontSize: 8 * scaleFactor,
    },
    scaledAnnouncementDate: {
      fontSize: 8 * scaleFactor,
    },
  });

  // Filter selected announcements
  const selectedFixed = (fixedAnnouncements || []).filter(a => 
    selectedAnnouncements?.includes(a.id)
  );

  const selectedDynamic = (dynamicAnnouncements || []).filter(a => 
    selectedAnnouncements?.includes(a.id)
  );

  // Strip HTML tags for PDF rendering
  const stripHtml = (html) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  };

  const renderAnnouncement = (announcement) => {
    const isEmphasized = announcement.emphasize;
    const containerStyle = isEmphasized 
      ? [styles.announcement, styles.emphasized]
      : styles.announcement;

    return (
      <View key={announcement.id} style={containerStyle}>
        <Text style={[styles.announcementTitle, scaledStyles.scaledAnnouncementTitle]}>
          {announcement.title}
        </Text>
        {announcement.content && (
          <Text style={[styles.announcementBody, scaledStyles.scaledAnnouncementBody]}>
            {stripHtml(announcement.content)}
          </Text>
        )}
        {announcement.instructions && (
          <Text style={[styles.announcementCue, scaledStyles.scaledAnnouncementCue]}>
            CUE: {stripHtml(announcement.instructions)}
          </Text>
        )}
        {announcement.date_label && (
          <Text style={[styles.announcementDate, scaledStyles.scaledAnnouncementDate]}>
            📅 {announcement.date_label}
          </Text>
        )}
      </View>
    );
  };

  const renderEvent = (event) => {
    const isEmphasized = event.emphasize;
    const containerStyle = isEmphasized 
      ? [styles.announcement, styles.emphasized]
      : styles.announcement;

    return (
      <View key={event.id} style={containerStyle}>
        <Text style={[styles.announcementTitle, scaledStyles.scaledAnnouncementTitle]}>
          {event.title}
        </Text>
        {event.content && (
          <Text style={[styles.announcementBody, scaledStyles.scaledAnnouncementBody]}>
            {stripHtml(event.content)}
          </Text>
        )}
        {event.date_of_occurrence && (
          <Text style={[styles.announcementDate, scaledStyles.scaledAnnouncementDate]}>
            📅 {new Date(event.date_of_occurrence).toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        )}
        {event.instructions && (
          <Text style={[styles.announcementCue, scaledStyles.scaledAnnouncementCue]}>
            CUE: {stripHtml(event.instructions)}
          </Text>
        )}
      </View>
    );
  };

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
          <Text style={[styles.columnTitle, scaledStyles.scaledColumnTitle]}>
            Anuncios Fijos / Fixed Announcements
          </Text>
          {selectedFixed.length === 0 ? (
            <Text style={[styles.announcementBody, scaledStyles.scaledAnnouncementBody]}>
              No hay anuncios seleccionados
            </Text>
          ) : (
            selectedFixed.map(renderAnnouncement)
          )}
        </View>

        <View style={styles.column}>
          <Text style={[styles.columnTitle, scaledStyles.scaledColumnTitle]}>
            Eventos / Events
          </Text>
          {selectedDynamic.length === 0 ? (
            <Text style={[styles.announcementBody, scaledStyles.scaledAnnouncementBody]}>
              No hay eventos seleccionados
            </Text>
          ) : (
            selectedDynamic.map(renderEvent)
          )}
        </View>
      </View>

      <Text style={styles.footer}>
        Palabras de Vida • ¡Atrévete a Cambiar!
      </Text>
    </View>
  );
}