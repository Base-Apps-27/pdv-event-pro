import React from 'react';
import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import ServiceProgramPage1 from './ServiceProgramPage1';
import ServiceProgramPage2 from './ServiceProgramPage2';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
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