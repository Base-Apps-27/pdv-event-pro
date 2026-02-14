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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  LayoutGrid, 
  Monitor, 
  Mic2, 
  Users, 
  Languages, 
  Palette, 
  Coffee, 
  ClipboardList, 
  Video 
} from 'lucide-react';

const DEPARTMENTS = [
  { id: 'general', icon: LayoutGrid },
  { id: 'projection', icon: Monitor },
  { id: 'sound', icon: Mic2 },
  { id: 'ushers', icon: Users },
  { id: 'translation', icon: Languages },
  { id: 'stage_decor', icon: Palette },
  { id: 'hospitality', icon: Coffee },
  { id: 'coordination', icon: ClipboardList },
  { id: 'livestream', icon: Video },
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

  const selectedDept = DEPARTMENTS.find(d => d.id === value) || DEPARTMENTS[0];
  const Icon = selectedDept.icon;

  return (
    <div className="w-full">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-14 bg-white border-gray-200 shadow-sm rounded-xl px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider leading-none mb-1">
                {t('myprogram.filterBy')}
              </span>
              <span className="text-base font-bold text-gray-900 leading-none">
                <SelectValue>{t(`myprogram.dept.${value}`)}</SelectValue>
              </span>
            </div>
          </div>
        </SelectTrigger>
        <SelectContent>
          {DEPARTMENTS.map((dept) => (
            <SelectItem key={dept.id} value={dept.id} className="py-3">
              <div className="flex items-center gap-3">
                <dept.icon className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-base">{t(`myprogram.dept.${dept.id}`)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}