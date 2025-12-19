import React from 'react';
import { Document, Page, StyleSheet, Font } from '@react-pdf/renderer';
import ServiceProgramPage1 from './ServiceProgramPage1';
import ServiceProgramPage2 from './ServiceProgramPage2';

// Register Inter font (fallback to Helvetica if unavailable)
// Using Google Fonts CDN for Inter
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI2fAZ9hiA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2', fontWeight: 700 },
  ]
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10.5,
    padding: 36, // 0.5 inch margins (36pt = 0.5in)
    backgroundColor: '#ffffff',
    color: '#333333',
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