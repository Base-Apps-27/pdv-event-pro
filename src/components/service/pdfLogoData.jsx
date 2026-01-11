/**
 * PDV Logo as base64 data URL for pdfmake
 * Logo source: https://storage2.snappages.site/X99VNZ/assets/images/22614440_1920x1080_2500.png
 */

let cachedLogoDataUrl = null;

export async function getLogoDataUrl() {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }

  try {
    const response = await fetch('https://storage2.snappages.site/X99VNZ/assets/images/22614440_1920x1080_2500.png');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUrl = reader.result;
        resolve(cachedLogoDataUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[PDF] Failed to load logo:', error);
    return null;
  }
}