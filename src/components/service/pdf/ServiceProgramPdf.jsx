import React, { useEffect, useState } from 'react';
import { Document, Page, StyleSheet, Font } from '@react-pdf/renderer';
import ServiceProgramPage1 from './ServiceProgramPage1';
import ServiceProgramPage2 from './ServiceProgramPage2';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.3,
    padding: 36,
    backgroundColor: '#FFFFFF',
    color: '#333333',
  }
});

export default function ServiceProgramPdf({
  serviceData,
  selectedDate,
  selectedAnnouncements = [],
  page1Scale = 100,
  page2Scale = 100
}) {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    try {
      Font.register({
        family: 'Inter',
        fonts: [
          {
            src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
            fontWeight: 400,
          },
          {
            src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2',
            fontWeight: 500,
          },
          {
            src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2',
            fontWeight: 600,
          },
          {
            src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2',
            fontWeight: 700,
          },
        ],
      });
      setFontsLoaded(true);
    } catch (e) {
      setFontsLoaded(true);
    }
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const pageStyle = fontsLoaded 
    ? { ...styles.page, fontFamily: 'Inter' }
    : styles.page;

  return (
    <Document>
      <Page size="LETTER" style={pageStyle}>
        <ServiceProgramPage1
          serviceData={serviceData}
          selectedDate={selectedDate}
          scale={page1Scale}
        />
      </Page>
      <Page size="LETTER" style={pageStyle}>
        <ServiceProgramPage2
          selectedDate={selectedDate}
          selectedAnnouncements={selectedAnnouncements}
          scale={page2Scale}
        />
      </Page>
    </Document>
  );
}