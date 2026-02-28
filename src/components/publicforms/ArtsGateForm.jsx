/**
 * ArtsGateForm.jsx
 * 
 * Name/email identification gate before accessing the arts form.
 * CSP Migration (2026-02-27): Replaces inline JS gate from serveArtsSubmission.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { usePublicLang } from './PublicFormLangContext';

export default function ArtsGateForm({ onEnter }) {
    const { t } = usePublicLang();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!name || name.length < 2) {
            setError(t('Por favor ingrese su nombre.', 'Please enter your name.'));
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError(t('Por favor ingrese un correo válido.', 'Please enter a valid email.'));
            return;
        }
        // Analytics: track gate entry (user identified themselves)
        base44.analytics.track({
            eventName: 'arts_gate_entered',
            properties: { success: true }
        });
        onEnter({ name, email });
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 border-l-4 p-6 mb-6" style={{ borderLeftColor: '#1F8A70' }}>
            <h3 className="text-xl tracking-wide mb-3" style={{ color: '#1F8A70' }}>
                {t('IDENTIFICACIÓN', 'IDENTIFICATION')}
            </h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                {t('Ingrese su nombre y correo para acceder al formulario.', 'Enter your name and email to access the form.')}
            </p>
            <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('Nombre completo', 'Full name')}
                className="w-full p-3 border border-gray-200 rounded-md text-sm bg-white mb-3 focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
            />
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('Correo electrónico', 'Email')}
                className="w-full p-3 border border-gray-200 rounded-md text-sm bg-white mb-3 focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
            />
            {error && <p className="text-red-700 text-sm mb-3">{error}</p>}
            <button
                onClick={handleSubmit}
                className="w-full py-3.5 text-white font-bold text-sm uppercase tracking-wider rounded-lg hover:shadow-md transition-all"
                style={{ background: 'linear-gradient(90deg, #0F5C4D 0%, #4A7C2F 50%, #7A8C1A 100%)' }}
            >
                {t('Continuar', 'Continue')}
            </button>
        </div>
    );
}