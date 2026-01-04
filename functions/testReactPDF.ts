/**
 * TEST FUNCTION - @react-pdf/renderer Proof of Concept
 * 
 * PURPOSE: Verify that react-pdf works in Base44 Deno environment before full implementation
 * 
 * USAGE: Call from frontend to download a minimal test PDF
 * - If PDF downloads with text → react-pdf is viable for production
 * - If this fails → escalate to Base44 support (package may not work in Deno Deploy)
 * 
 * DELETE THIS FILE after confirming viability
 */

import React from 'npm:react';
import { Document, Page, Text, View, StyleSheet, pdf } from 'npm:@react-pdf/renderer';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Test PDF styles - minimal but covers key features
const styles = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: '#ffffff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1F8A70' // PDV brand teal
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 10,
    color: '#374151'
  },
  content: {
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 10
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#6B7280'
  }
});

// Test PDF document component
const TestDocument = ({ timestamp }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.title}>✅ React-PDF Test Successful</Text>
      <Text style={styles.subtitle}>Base44 + Deno + @react-pdf/renderer</Text>
      
      <View style={{ marginTop: 30 }}>
        <Text style={styles.content}>
          If you can read this PDF, the following features work:
        </Text>
        <Text style={styles.content}>• Package imports (npm:react, npm:@react-pdf/renderer)</Text>
        <Text style={styles.content}>• JSX rendering in Deno environment</Text>
        <Text style={styles.content}>• PDF buffer generation</Text>
        <Text style={styles.content}>• Binary response streaming</Text>
        <Text style={styles.content}>• Font rendering (base fonts)</Text>
        <Text style={styles.content}>• Color styling</Text>
      </View>
      
      <View style={{ marginTop: 30, padding: 15, backgroundColor: '#F3F4F6', borderRadius: 4 }}>
        <Text style={{ fontSize: 11, color: '#1F2937' }}>
          Next Steps:
        </Text>
        <Text style={{ fontSize: 10, color: '#4B5563', marginTop: 5 }}>
          1. Confirm this PDF looks correct on all devices
        </Text>
        <Text style={{ fontSize: 10, color: '#4B5563' }}>
          2. Build production ServiceProgramPDF component
        </Text>
        <Text style={{ fontSize: 10, color: '#4B5563' }}>
          3. Replace html2canvas approach with this
        </Text>
        <Text style={{ fontSize: 10, color: '#4B5563' }}>
          4. Delete this test function
        </Text>
      </View>
      
      <Text style={styles.footer}>
        Generated at {timestamp} EST
      </Text>
    </Page>
  </Document>
);

Deno.serve(async (req) => {
  try {
    // Auth check (optional - remove if you want to test without login)
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[TEST-REACT-PDF] Generating test PDF for user:', user.email);
    
    // Generate timestamp in EST
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    
    // Generate PDF buffer
    console.log('[TEST-REACT-PDF] Rendering PDF document...');
    const pdfBuffer = await pdf(<TestDocument timestamp={timestamp} />).toBuffer();
    
    console.log('[TEST-REACT-PDF] PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    
    // Return PDF as downloadable file
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="react-pdf-test.pdf"',
        'Content-Length': pdfBuffer.length.toString()
      }
    });
    
  } catch (error) {
    console.error('[TEST-REACT-PDF] Error:', error);
    
    // Return detailed error for debugging
    return Response.json({
      error: error.message,
      stack: error.stack,
      name: error.name
    }, { status: 500 });
  }
});