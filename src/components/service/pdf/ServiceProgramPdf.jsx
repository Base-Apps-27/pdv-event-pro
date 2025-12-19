import React from 'react';

export default async function createServiceProgramPdf() {
  const { Document, Page, StyleSheet, Font, View, Text, Image } = await import('@react-pdf/renderer');
  const { base44 } = await import('@/api/base44Client');

  // Register font
  Font.register({
    family: 'Inter',
    fonts: [
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 500 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 600 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2', fontWeight: 700 },
    ],
  });

  const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png';

  // Import Page1 styles inline
  const page1Styles = StyleSheet.create({
    container: { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' },
    logo: { position: 'absolute', left: -12, top: -12, width: 60, height: 60, objectFit: 'contain' },
    header: { textAlign: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#1A1A1A' },
    date: { fontSize: 13, fontWeight: 600, color: '#333333', marginTop: 4 },
    rolesLine: { fontSize: 9.5, color: '#666666', textAlign: 'center', marginTop: 6, maxWidth: '90%', alignSelf: 'center' },
    columnsContainer: { flexDirection: 'row', gap: 22, flex: 1 },
    column: { flex: 1 },
    columnHeader: { fontSize: 12, fontWeight: 700, color: '#1A1A1A', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E6E6E6' },
    timeAccent: { color: '#C0392B', fontWeight: 600 },
    segment: { marginBottom: 10, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
    segmentTime: { fontSize: 10, color: '#C0392B', fontWeight: 600, marginBottom: 3 },
    segmentTitle: { fontSize: 10.5, fontWeight: 600, color: '#1A1A1A', marginBottom: 3 },
    segmentDetail: { fontSize: 10, color: '#333333', marginTop: 2, lineHeight: 1.3 },
    segmentName: { color: '#1FBA70', fontWeight: 600 },
    segmentNote: { fontSize: 9.5, color: '#666666', fontStyle: 'italic', marginTop: 2 },
    recesoBlock: { marginTop: 16, marginBottom: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#E6E6E6', borderBottomWidth: 1, borderBottomColor: '#E6E6E6', textAlign: 'center' },
    recesoTitle: { fontSize: 11, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 },
    recesoNote: { fontSize: 9.5, color: '#666666', fontStyle: 'italic' },
    footer: { position: 'absolute', bottom: -24, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#666666', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E6E6E6' },
    footerAccent: { color: '#1FBA70', fontWeight: 600 },
  });

  // Page2 styles
  const page2Styles = StyleSheet.create({
    container: { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' },
    logo: { position: 'absolute', left: -12, top: -12, width: 60, height: 60, objectFit: 'contain' },
    header: { textAlign: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#1A1A1A' },
    date: { fontSize: 13, fontWeight: 600, color: '#333333', marginTop: 4 },
    columnsContainer: { flexDirection: 'row', gap: 22, flex: 1 },
    column: { flex: 1 },
    announcementItem: { marginBottom: 14 },
    announcementMarker: { width: 3, height: 12, backgroundColor: '#1FBA70', marginRight: 6 },
    announcementTitle: { fontSize: 10.5, fontWeight: 600, color: '#1A1A1A', marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
    announcementContent: { fontSize: 10, color: '#333333', lineHeight: 1.3, marginTop: 4 },
    announcementCue: { fontSize: 9.5, color: '#666666', fontStyle: 'italic', marginTop: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#E6E6E6' },
    cueLabel: { fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', fontSize: 8.5, letterSpacing: 0.5 },
    announcementDate: { fontSize: 9, color: '#666666', marginTop: 4 },
    announcementDivider: { height: 1, backgroundColor: '#F0F0F0', marginTop: 12, marginBottom: 12 },
    footer: { position: 'absolute', bottom: -24, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#666666', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E6E6E6' },
    footerAccent: { color: '#1FBA70', fontWeight: 600 },
  });

  const pageStyles = StyleSheet.create({
    page: { fontFamily: 'Inter', fontSize: 10.5, lineHeight: 1.3, padding: 36, backgroundColor: '#FFFFFF', color: '#333333' }
  });

  // Page 1 Component
  const ServiceProgramPage1 = ({ serviceData, selectedDate, scale }) => {
    const scaleFactor = scale / 100;
    const getScaledSize = (baseSize) => baseSize * scaleFactor;

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

    const renderServiceColumn = (timeSlot, segments) => {
      if (!segments || segments.length === 0) {
        return React.createElement(View, { style: page1Styles.column },
          React.createElement(Text, { style: [page1Styles.columnHeader, { fontSize: getScaledSize(12) }] },
            React.createElement(Text, { style: page1Styles.timeAccent }, timeSlot)
          ),
          React.createElement(Text, { style: { fontSize: getScaledSize(10), color: '#666666' } }, 'No hay segmentos')
        );
      }

      const validSegments = segments.filter(s => s && s.type !== 'break');
      if (validSegments.length === 0) {
        return React.createElement(View, { style: page1Styles.column },
          React.createElement(Text, { style: [page1Styles.columnHeader, { fontSize: getScaledSize(12) }] },
            React.createElement(Text, { style: page1Styles.timeAccent }, timeSlot)
          ),
          React.createElement(Text, { style: { fontSize: getScaledSize(10), color: '#666666' } }, 'No hay segmentos')
        );
      }

      return React.createElement(View, { style: page1Styles.column },
        React.createElement(Text, { style: [page1Styles.columnHeader, { fontSize: getScaledSize(12) }] },
          React.createElement(Text, { style: page1Styles.timeAccent }, timeSlot)
        ),
        validSegments.map((segment, idx) => {
          const title = segment.title || 'Sin título';
          const duration = segment.duration || '';
          const data = segment.data || {};

          return React.createElement(View, { key: idx, style: page1Styles.segment },
            duration && React.createElement(Text, { style: [page1Styles.segmentTime, { fontSize: getScaledSize(10) }] }, `${duration} min`),
            React.createElement(Text, { style: [page1Styles.segmentTitle, { fontSize: getScaledSize(10.5) }] }, title),
            data.leader && React.createElement(Text, { style: [page1Styles.segmentDetail, { fontSize: getScaledSize(10) }] },
              'Dirige: ', React.createElement(Text, { style: page1Styles.segmentName }, data.leader)
            ),
            data.presenter && React.createElement(Text, { style: [page1Styles.segmentDetail, { fontSize: getScaledSize(10) }] },
              React.createElement(Text, { style: page1Styles.segmentName }, data.presenter)
            ),
            data.preacher && React.createElement(Text, { style: [page1Styles.segmentDetail, { fontSize: getScaledSize(10) }] },
              React.createElement(Text, { style: page1Styles.segmentName }, data.preacher)
            ),
            data.title && React.createElement(Text, { style: [page1Styles.segmentDetail, { fontSize: getScaledSize(10) }] }, data.title),
            data.notes && React.createElement(Text, { style: [page1Styles.segmentNote, { fontSize: getScaledSize(9.5) }] }, data.notes)
          );
        })
      );
    };

    return React.createElement(View, { style: page1Styles.container },
      React.createElement(Image, { src: LOGO_URL, style: page1Styles.logo }),
      React.createElement(View, { style: page1Styles.header },
        React.createElement(Text, { style: page1Styles.title }, 'ORDEN DE SERVICIO'),
        React.createElement(Text, { style: page1Styles.date }, `Domingo ${selectedDate}`),
        rolesLine && React.createElement(Text, { style: page1Styles.rolesLine }, rolesLine)
      ),
      React.createElement(View, { style: page1Styles.columnsContainer },
        renderServiceColumn('9:30 A.M.', serviceData?.['9:30am']),
        renderServiceColumn('11:30 A.M.', serviceData?.['11:30am'])
      ),
      serviceData?.receso_notes?.['9:30am'] && React.createElement(View, { style: page1Styles.recesoBlock },
        React.createElement(Text, { style: [page1Styles.recesoTitle, { fontSize: getScaledSize(11) }] }, 'Receso'),
        React.createElement(Text, { style: [page1Styles.recesoNote, { fontSize: getScaledSize(9.5) }] }, serviceData.receso_notes['9:30am'])
      ),
      React.createElement(View, { style: page1Styles.footer },
        React.createElement(Text, null,
          'Palabras de Vida • ', React.createElement(Text, { style: page1Styles.footerAccent }, '¡Atrévete a cambiar!')
        )
      )
    );
  };

  // Page 2 Component
  const ServiceProgramPage2 = ({ selectedDate, selectedAnnouncements, scale }) => {
    const [announcements, setAnnouncements] = React.useState([]);
    const scaleFactor = scale / 100;
    const getScaledSize = (baseSize) => baseSize * scaleFactor;

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

    const sanitizeText = (text) => {
      if (!text) return '';
      return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
    };

    const stripCuePrefix = (text) => {
      if (!text) return '';
      return text.replace(/^CUE:\s*/i, '');
    };

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

      return React.createElement(View, { key: ann.id },
        React.createElement(View, { style: page2Styles.announcementItem },
          React.createElement(View, { style: page2Styles.announcementTitle },
            React.createElement(View, { style: page2Styles.announcementMarker }),
            React.createElement(Text, { style: { fontSize: getScaledSize(10.5) } }, title)
          ),
          content && React.createElement(Text, { style: [page2Styles.announcementContent, { fontSize: getScaledSize(10) }] }, content),
          cue && React.createElement(View, { style: page2Styles.announcementCue },
            React.createElement(Text, { style: { fontSize: getScaledSize(9.5) } },
              React.createElement(Text, { style: page2Styles.cueLabel }, 'CUE:'), ` ${cue}`
            )
          ),
          date && React.createElement(Text, { style: [page2Styles.announcementDate, { fontSize: getScaledSize(9) }] }, date)
        ),
        showDivider && React.createElement(View, { style: page2Styles.announcementDivider })
      );
    };

    return React.createElement(View, { style: page2Styles.container },
      React.createElement(Image, { src: LOGO_URL, style: page2Styles.logo }),
      React.createElement(View, { style: page2Styles.header },
        React.createElement(Text, { style: page2Styles.title }, 'ANUNCIOS'),
        React.createElement(Text, { style: page2Styles.date }, `Domingo ${selectedDate}`)
      ),
      announcements.length > 0
        ? React.createElement(View, { style: page2Styles.columnsContainer },
            React.createElement(View, { style: page2Styles.column },
              leftAnnouncements.map((ann, i) => renderAnnouncement(ann, i, leftAnnouncements.length))
            ),
            React.createElement(View, { style: page2Styles.column },
              rightAnnouncements.map((ann, i) => renderAnnouncement(ann, i, rightAnnouncements.length))
            )
          )
        : React.createElement(View, { style: { padding: 30, textAlign: 'center' } },
            React.createElement(Text, { style: { color: '#666666', fontSize: getScaledSize(10) } },
              'No hay anuncios seleccionados / No announcements selected'
            )
          ),
      React.createElement(View, { style: page2Styles.footer },
        React.createElement(Text, null,
          'Palabras de Vida • ', React.createElement(Text, { style: page2Styles.footerAccent }, '¡Atrévete a cambiar!')
        )
      )
    );
  };

  // Return the main component
  return function ServiceProgramPdf({ serviceData, selectedDate, selectedAnnouncements = [], page1Scale = 100, page2Scale = 100 }) {
    return React.createElement(Document, null,
      React.createElement(Page, { size: "LETTER", style: pageStyles.page },
        React.createElement(ServiceProgramPage1, { serviceData, selectedDate, scale: page1Scale })
      ),
      React.createElement(Page, { size: "LETTER", style: pageStyles.page },
        React.createElement(ServiceProgramPage2, { selectedDate, selectedAnnouncements, scale: page2Scale })
      )
    );
  };
}