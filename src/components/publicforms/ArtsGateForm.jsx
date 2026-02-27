/**
 * ArtsGateForm.jsx
 * 
 * Name/email identification gate before accessing the arts form.
 * CSP Migration (2026-02-27): Replaces inline JS gate from serveArtsSubmission.
 */
import React, { useState } from 'react';

export default function ArtsGateForm({ onEnter }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!name || name.length < 2) {
            setError('Por favor ingrese su nombre. / Please enter your name.');
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Por favor ingrese un correo válido. / Please enter a valid email.');
            return;
        }
        onEnter({ name, email });
    };

    return (
        <div className="bg-gray-50 rounded-lg border-l-4 border-[#1F8A70] p-6 mb-6">
            <h3 className="font-['Bebas_Neue'] text-xl text-[#1F8A70] tracking-wide mb-3">
                IDENTIFICACIÓN / IDENTIFICATION
            </h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Ingrese su nombre y correo para acceder al formulario. / Enter your name and email to access the form.
            </p>
            <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nombre completo / Full name"
                className="w-full p-3 border border-gray-200 rounded-md text-base bg-white mb-3 focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
            />
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Correo electrónico / Email"
                className="w-full p-3 border border-gray-200 rounded-md text-base bg-white mb-3 focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10"
            />
            {error && <p className="text-red-700 text-sm mb-3">{error}</p>}
            <button
                onClick={handleSubmit}
                className="w-full py-4 bg-gradient-to-r from-[#1F8A70] to-[#8DC63F] text-white font-bold text-base uppercase tracking-wide rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
                Continuar / Continue
            </button>
        </div>
    );
}