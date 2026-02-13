/**
 * DepartmentPicker — MyProgram Step 5
 * 
 * Horizontal pill bar for selecting department filter.
 * Persisted in localStorage via safeLocalStorage.
 * Defaults to 'general'. 9 departments matching report options.
 * 
 * Decision: "MyProgram: hybrid department selection with localStorage persistence"
 */
import React from 'react';
import { useLanguage } from '@/components/utils/i18n';
import { safeGetItem, safeSetItem } from '@/components/utils/safeLocalStorage';

const DEPARTMENTS = [
  'general',
  'projection',
  'sound',
  'ushers',
  'translation',
  'stage_decor',
  'hospitality',
  'coordination',
  'livestream',
];

export function useDepartment() {
  const [dept, setDeptState] = React.useState(() => safeGetItem('myprogram_department', 'general'));

  const setDept = React.useCallback((d) => {
    setDeptState(d);
    safeSetItem('myprogram_department', d);
  }, []);

  return [dept, setDept];
}

export default function DepartmentPicker({ value, onChange }) {
  const { t } = useLanguage();

  return (
    <div className="w-full overflow-x-auto scrollbar-none -mx-1 px-1">
      <div className="flex gap-2 pb-1 min-w-max">
        {DEPARTMENTS.map((dept) => {
          const isActive = value === dept;
          return (
            <button
              key={dept}
              onClick={() => onChange(dept)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all
                ${isActive
                  ? 'bg-gradient-to-r from-[#1F8A70] via-[#4DC15F] to-[#D9DF32] text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900'}
              `}
            >
              {t(`myprogram.dept.${dept}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}