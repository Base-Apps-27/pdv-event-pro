// This file exports an async factory to avoid SSR issues with @react-pdf/renderer
export default async function createServiceProgramPdf() {
  // Dynamically import all dependencies
  const [
    { Document, Page, StyleSheet, Font },
    Page1Module,
    Page2Module
  ] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ServiceProgramPage1'),
    import('./ServiceProgramPage2')
  ]);

  const ServiceProgramPage1 = Page1Module.default;
  const ServiceProgramPage2 = Page2Module.default;

  // Register Inter font
  Font.register({
    family: 'Inter',
    fonts: [
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 500 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 600 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2', fontWeight: 700 },
    ],
  });

  const styles = StyleSheet.create({
    page: {
      fontFamily: 'Inter',
      fontSize: 10.5,
      lineHeight: 1.3,
      padding: 36,
      backgroundColor: '#FFFFFF',
      color: '#333333',
    }
  });

  // Return the component
  return function ServiceProgramPdf({ serviceData, selectedDate, selectedAnnouncements = [], page1Scale = 100, page2Scale = 100 }) {
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
            selectedAnnouncements={selectedAnnouncements}
            scale={page2Scale}
          />
        </Page>
      </Document>
    );
  };
}