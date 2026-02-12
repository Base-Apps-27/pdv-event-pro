
import { timeFormatTests } from './timeFormat.test';
import { segmentDataUtilsTests } from './segmentDataUtils.test';
import { segmentValidationTests } from './segmentValidation.test';
import { textNormalizationTests } from './textNormalization.test';
import { segmentFlexibilityTests } from './segmentFlexibility.test';
import { segmentTypeDisplayTests } from './segmentTypeDisplay.test';
import { segmentNormalizationTests } from './segmentNormalization.test';
import { permissionsTests } from './permissions.test';
import { reportHelpersTests } from './reportHelpers.test';
import { pdfScalingTests } from './pdfScaling.test.jsx';
import { i18nTests } from './i18n.test.jsx';

export const ALL_SUITES = [
  { name: 'timeFormat', run: timeFormatTests },
  { name: 'segmentDataUtils', run: segmentDataUtilsTests },
  { name: 'segmentValidation', run: segmentValidationTests },
  { name: 'textNormalization', run: textNormalizationTests },
  { name: 'segmentFlexibility', run: segmentFlexibilityTests },
  { name: 'segmentTypeDisplay', run: segmentTypeDisplayTests },
  { name: 'segmentNormalization', run: segmentNormalizationTests },
  { name: 'permissions', run: permissionsTests },
  { name: 'reportHelpers', run: reportHelpersTests },
  { name: 'pdfScaling', run: pdfScalingTests },
  { name: 'i18n', run: i18nTests },
];
