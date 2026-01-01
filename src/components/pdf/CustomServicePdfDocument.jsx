import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import CustomServicePdfPage1 from './CustomServicePdfPage1';
import CustomServicePdfPage2 from './CustomServicePdfPage2';

const styles = StyleSheet.create({
  page: {
    padding: '0.5in',
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff'
  }
});

export default function CustomServicePdfDocument({ model }) {
  if (!model) return null;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <CustomServicePdfPage1 model={model} />
      </Page>
      <Page size="LETTER" style={styles.page}>
        <CustomServicePdfPage2 model={model} />
      </Page>
    </Document>
  );
}