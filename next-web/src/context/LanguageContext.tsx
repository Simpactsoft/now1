"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, Language } from '@/lib/translations';

type Direction = 'ltr' | 'rtl';

interface LanguageContextType {
    language: Language;
    dir: Direction;
    t: (key: keyof typeof translations['en']) => string;
    toggleLanguage: () => void;
    setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('en');
    const [dir, setDir] = useState<Direction>('ltr');

    // Initialize from localStorage or default
    useEffect(() => {
        const savedLang = localStorage.getItem('app-language') as Language;
        if (savedLang && (savedLang === 'en' || savedLang === 'he')) {
            setLanguageState(savedLang);
            updateDir(savedLang);
        }
    }, []);

    const updateDir = (lang: Language) => {
        const newDir = lang === 'he' ? 'rtl' : 'ltr';
        setDir(newDir);
        document.documentElement.dir = newDir;
        document.documentElement.lang = lang;
    };

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        updateDir(lang);
        localStorage.setItem('app-language', lang);
    };

    const toggleLanguage = () => {
        const newLang = language === 'en' ? 'he' : 'en';
        setLanguage(newLang);
    };

    const t = (key: keyof typeof translations['en']) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, dir, t, toggleLanguage, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
