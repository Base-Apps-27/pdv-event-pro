import { timeFormatTests } from './timeFormat.test';
import { segmentDataUtilsTests } from './segmentDataUtils.test';
import { segmentValidationTests } from './segmentValidation.test';
import { textNormalizationTests } from './textNormalization.test';
import { segmentFlexibilityTests } from './segmentFlexibility.test';
import { segmentTypeDisplayTests } from './segmentTypeDisplay.test';
import { segmentNormalizationTests } from './segmentNormalization.test';
import { permissionsTests } from './permissions.test';

export const ALL_SUITES = [
  { name: 'timeFormat', run: timeFormatTests },
  { name: 'segmentDataUtils', run: segmentDataUtilsTests },
  { name: 'segmentValidation', run: segmentValidationTests },
  { name: 'textNormalization', run: textNormalizationTests },
  { name: 'segmentFlexibility', run: segmentFlexibilityTests },
  { name: 'segmentTypeDisplay', run: segmentTypeDisplayTests },
  { name: 'segmentNormalization', run: segmentNormalizationTests },
  { name: 'permissions', run: permissionsTests },
];
