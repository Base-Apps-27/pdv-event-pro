import React from 'react';

// This component will be loaded dynamically, so we export an async loader
export default async function createServiceProgramPdf() {
  // Dynamic imports to avoid SSR issues
  const [
    { Document, Page, StyleSheet, Font },
    ServiceProgramPage1Module,
    ServiceProgramPage2Module
  ] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ServiceProgramPage1'),
    import('./ServiceProgramPage2')
  ]);

  const ServiceProgramPage1 = ServiceProgramPage1Module.default;
  const ServiceProgramPage2 = ServiceProgramPage2Module.default;

  // Register Inter font
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

  // Return the component factory
  return function ServiceProgramPdf({
    serviceData,
    selectedDate,
    selectedAnnouncements = [],
    page1Scale = 100,
    page2Scale = 100
  }) {
    return React.createElement(Document, null,
      React.createElement(Page, { size: "LETTER", style: styles.page },
        React.createElement(ServiceProgramPage1, {
          serviceData,
          selectedDate,
          scale: page1Scale
        })
      ),
      React.createElement(Page, { size: "LETTER", style: styles.page },
        React.createElement(ServiceProgramPage2, {
          selectedDate,
          selectedAnnouncements,
          scale: page2Scale
        })
      )
    );
  };
}