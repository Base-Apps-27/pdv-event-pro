import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function StandbyScreen() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="fixed inset-0 w-full h-full bg-slate-900 flex flex-col items-center justify-center overflow-hidden z-50">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 opacity-100" />
            
            {/* Animated Glow Orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1F8A70] rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8DC63F] rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse" style={{ animationDuration: '7s' }} />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center text-center p-12">
                
                {/* Main Logo Text */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="mb-8"
                >
                    <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter uppercase mb-2 font-anton drop-shadow-2xl">
                        Palabras de Vida
                    </h1>
                </motion.div>

                {/* Divider */}
                <motion.div 
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="w-32 h-2 bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] rounded-full mb-8"
                />

                {/* Motto */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                >
                    <h2 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#1F8A70] via-[#8DC63F] to-[#D7DF23] uppercase tracking-widest">
                        ¡Atrévete a Cambiar!
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm uppercase tracking-[0.3em] font-medium opacity-60">
                        Dare to Change
                    </p>
                </motion.div>

            </div>

            {/* Footer / Status */}
            <div className="absolute bottom-8 text-slate-600 text-xs font-mono uppercase tracking-widest">
                Standby Mode • Waiting for Program
            </div>
        </div>
    );
}