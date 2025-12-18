import React from 'react';
import { Document, Page, Font, StyleSheet } from '@react-pdf/renderer';
import ServiceProgramPage1 from './ServiceProgramPage1';
import ServiceProgramPage2 from './ServiceProgramPage2';

// Register Inter fonts
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Regular.ttf', fontWeight: 400 },
    { src: 'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Bold.ttf', fontWeight: 700 },
    { src: 'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Italic.ttf', fontWeight: 400, fontStyle: 'italic' },
    { src: 'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-BoldItalic.ttf', fontWeight: 700, fontStyle: 'italic' },
  ]
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    padding: 48, // 0.5 inch margins
    backgroundColor: '#ffffff',
  }
});

export default function ServiceProgramPdf({
  serviceData,
  selectedDate,
  fixedAnnouncements,
  dynamicAnnouncements,
  selectedAnnouncements,
  page1Scale = 100,
  page2Scale = 100
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <ServiceProgramPage1
          serviceData={serviceData}
          selectedDate={selectedDate}
          scale={page1Scale}
        />
      </Page>
      <Page size="LETTER" style={styles.page}>
        <ServiceProgramPage2
          selectedDate={selectedDate}
          fixedAnnouncements={fixedAnnouncements}
          dynamicAnnouncements={dynamicAnnouncements}
          selectedAnnouncements={selectedAnnouncements}
          scale={page2Scale}
        />
      </Page>
    </Document>
  );
}