/**
 * SubmissionPathSelector.jsx
 * 
 * 2-step fork: asks the user upfront what type of submission they're making.
 * Eliminates confusion between "paste your message" vs "upload your slideshow".
 * 
 * Path A ("notes"): User has a sermon/outline with verse references → paste is primary
 * Path B ("slides"): User has a finished presentation/slideshow → upload is primary
 * 
 * UX Decision (2026-02-28): Created to prevent users from uploading Word docs
 * in the file upload area instead of pasting their message content.
 * The slides-only checkbox is eliminated — path choice sets content_is_slides_only implicitly.
 * 
 * Used by: SpeakerSubmissionForm, WeeklySubmissionForm
 */
import React from 'react';
import { FileText, Presentation } from 'lucide-react';
import { usePublicLang } from './PublicFormLangContext';

export default function SubmissionPathSelector({ value, onChange }) {
    const { t } = usePublicLang();

    const paths = [
        {
            id: 'notes',
            icon: FileText,
            title: t(
                'Tengo notas o bosquejo de mi mensaje',
                'I have notes or an outline for my message'
            ),
            description: t(
                'Pegue su contenido y el sistema extraerá los versículos automáticamente para proyección.',
                'Paste your content and the system will automatically extract verses for projection.'
            ),
            color: 'teal',
        },
        {
            id: 'slides',
            icon: Presentation,
            title: t(
                'Tengo una presentación terminada (PowerPoint / Keynote)',
                'I have a finished presentation (PowerPoint / Keynote)'
            ),
            description: t(
                'Suba su presentación final lista para proyección. No se requiere extracción de versículos, todo el contenido está en los slides.',
                'Upload your final presentation ready for projection. No verse extraction needed. All content is in the slides.'
            ),
            color: 'blue',
        },
    ];

    return (
        <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-pdv-teal p-6 mb-6">
            <h3 className="text-xl text-pdv-teal tracking-wide mb-2">
                {t('¿QUÉ DESEA ENVIAR?', 'WHAT ARE YOU SUBMITTING?')}
            </h3>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                {t(
                    'Seleccione la opción que mejor describe su material para que podamos guiarle correctamente.',
                    'Select the option that best describes your material so we can guide you correctly.'
                )}
            </p>
            <div className="grid gap-3">
                {paths.map(path => {
                    const isSelected = value === path.id;
                    const Icon = path.icon;
                    return (
                        <button
                            key={path.id}
                            type="button"
                            onClick={() => onChange(path.id)}
                            className={`
                                w-full text-left rounded-lg border-2 p-4 transition-all
                                ${isSelected
                                    ? 'border-[#1F8A70] bg-[#1F8A70]/5 shadow-sm'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }
                            `}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`
                                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                                    ${isSelected ? 'bg-[#1F8A70] text-white' : 'bg-gray-100 text-gray-400'}
                                `}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-bold ${isSelected ? 'text-[#1F8A70]' : 'text-gray-700'}`}>
                                            {path.title}
                                        </span>
                                        {isSelected && (
                                            <span className="w-2 h-2 rounded-full bg-[#1F8A70] flex-shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        {path.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}