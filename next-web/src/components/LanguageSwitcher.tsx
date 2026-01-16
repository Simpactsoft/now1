"use client";

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

export default function LanguageSwitcher() {
    const { language, toggleLanguage } = useLanguage();

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={language === 'en' ? "Switch to Hebrew" : "עבור לאנגלית"}
        >
            <span className="text-xl leading-none">
                {language === 'en' ? '🇺🇸' : '🇮🇱'}
            </span>
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                {language === 'en' ? 'EN' : 'HE'}
            </span>
        </button>
    );
}
