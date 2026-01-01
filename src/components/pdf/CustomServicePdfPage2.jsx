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
    fontSize: 24 * scale,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#1a1a1a',
    marginBottom: 4 * scale
  },
  subtitle: {
    fontSize: 16 * scale,
    color: '#4b5563'
  },
  twoCol: {
    flexDirection: 'row',
    gap: 20 * scale
  },
  col: {
    flex: 1
  },
  colRight: {
    flex: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
    paddingLeft: 20 * scale
  },
  sectionTitle: {
    fontSize: 10 * scale,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 12 * scale,
    paddingBottom: 8 * scale,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb'
  },
  annItem: {
    marginBottom: 8 * scale,
    paddingBottom: 8 * scale,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  annItemEmphasized: {
    backgroundColor: '#fef3c7',
    padding: 6 * scale,
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 4,
    marginBottom: 8 * scale
  },
  annTitle: {
    fontSize: 11 * scale,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#1a1a1a',
    marginBottom: 3 * scale
  },
  annTitleDynamic: {
    color: '#16a34a'
  },
  dateLine: {
    fontSize: 10 * scale,
    color: '#4b5563',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2 * scale
  },
  annContent: {
    fontSize: 10 * scale,
    color: '#374151',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap'
  },
  annInstructions: {
    fontSize: 9 * scale,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4 * scale,
    paddingLeft: 6 * scale,
    borderLeftWidth: 2,
    borderLeftColor: '#fbbf24'
  },
  cueLabel: {
    fontFamily: 'Helvetica-Bold',
    fontStyle: 'normal',
    textTransform: 'uppercase',
    fontSize: 8 * scale
  },
  videoIndicator: {
    fontSize: 9 * scale,
    color: '#8b5cf6',
    marginTop: 3 * scale
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
  }
});

export default function CustomServicePdfPage2({ model }) {
  const styles = createStyles(model.page2Scale);

  return (
    <>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>ANUNCIOS</Text>
          <Text style={styles.subtitle}>Domingo {model.date}</Text>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            {model.annFixed.length > 0 && model.annFixed.map((ann) => (
              <View key={ann.id} style={styles.annItem}>
                <Text style={styles.annTitle}>{ann.title}</Text>
                {ann.content && <Text style={styles.annContent}>{ann.content}</Text>}
                {ann.instructions && (
                  <Text style={styles.annInstructions}>
                    <Text style={styles.cueLabel}>CUE: </Text>
                    {ann.instructions}
                  </Text>
                )}
                {ann.hasVideo && <Text style={styles.videoIndicator}>📹 Video</Text>}
              </View>
            ))}
          </View>

          <View style={styles.colRight}>
            {model.annDynamic.length > 0 && (
              <Text style={styles.sectionTitle}>Próximos Eventos</Text>
            )}
            {model.annDynamic.map((ann) => (
              <View 
                key={ann.id} 
                style={ann.isEmphasized ? styles.annItemEmphasized : styles.annItem}
              >
                <Text style={[styles.annTitle, styles.annTitleDynamic]}>{ann.title}</Text>
                {ann.dateLine && <Text style={styles.dateLine}>{ann.dateLine}</Text>}
                {ann.content && <Text style={styles.annContent}>{ann.content}</Text>}
                {ann.instructions && (
                  <Text style={styles.annInstructions}>
                    <Text style={styles.cueLabel}>CUE: </Text>
                    {ann.instructions}
                  </Text>
                )}
                {ann.hasVideo && <Text style={styles.videoIndicator}>📹 Video</Text>}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¡Atrévete a cambiar!</Text>
      </View>
    </>
  );
}