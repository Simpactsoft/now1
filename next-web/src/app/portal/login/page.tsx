"use client";

import { useState, useEffect } from "react";
import { sendPortalMagicLink, portalSignInWithPassword } from "@/app/actions/portal-auth-actions";
import { verifyPortalTokenAndLogin } from "@/app/actions/portal-auth";
import { ArrowRight, Mail, Loader2, CheckCircle2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';

export default function PortalLoginPage() {
    const router = useRouter();
    const [loginMethod, setLoginMethod] = useState<'magic_link' | 'password'>('magic_link');

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error, setError] = useState("");
    // Listen for auth state changes and parse URL hash for magic links
    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get('token');
        if (token) {
            setLoading(true);
            verifyPortalTokenAndLogin(token).then((res) => {
                if (res.success) {
                    window.location.href = "/portal/dashboard";
                } else {
                    setError(res.error || "Invalid or expired link.");
                    setLoading(false);
                }
            }).catch(() => {
                setError("An error occurred during secure login.");
                setLoading(false);
            });
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');

            if (access_token && refresh_token) {
                setLoading(true);
                supabase.auth.setSession({
                    access_token,
                    refresh_token
                }).then(({ error }) => {
                    if (error) {
                        setError("Link expired or invalid. Please request a new one.");
                        setLoading(false);
                    } else {
                        router.push("/portal/dashboard");
                    }
                });
            } else if (hashParams.get('error_description')) {
                setError(hashParams.get('error_description')!.replace(/\+/g, ' '));
            }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    router.push("/portal/dashboard");
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccessMessage("");
        try {
            if (loginMethod === 'magic_link') {
                const res = await sendPortalMagicLink(email);
                if (res.success) {
                    setSuccessMessage(res.data?.message || "Check your email for the secure login link.");
                } else {
                    setError(res.error || "Failed to send magic link.");
                }
            } else {
                const res = await portalSignInWithPassword(email, password);
                if (res.success) {
                    // Redirect to portal dashboard on successful password login
                    router.push("/portal/dashboard");
                } else {
                    setError(res.error || "Incorrect email or password.");
                }
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border p-8">
                <div className="text-center mb-8">
                    <div className="bg-indigo-600 text-white w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
                        <span className="font-bold text-2xl leading-none">N</span>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to your Portal</h1>
                    <p className="text-muted-foreground text-sm">Sign in to view your quotes, invoices, and subscriptions securely.</p>
                </div>

                {successMessage ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
                        <h3 className="text-emerald-800 font-semibold text-lg mb-2">Check your email</h3>
                        <p className="text-emerald-700 text-sm mb-6">{successMessage}</p>
                        <button
                            onClick={() => {
                                setSuccessMessage("");
                                setEmail("");
                            }}
                            className="bg-card border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-medium py-2 px-6 rounded-lg transition-colors text-sm shadow-sm"
                        >
                            Try another email
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100 flex items-start gap-2">
                                <span className="mt-0.5">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex bg-muted p-1 rounded-lg border border-border/50">
                            <button
                                type="button"
                                onClick={() => { setLoginMethod('magic_link'); setError(''); }}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${loginMethod === 'magic_link' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Magic Link
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLoginMethod('password'); setError(''); }}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${loginMethod === 'password' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Password
                            </button>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5 text-left">
                                Work Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        {loginMethod === 'password' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5 text-left">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                                        placeholder="Enter your password"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !email || (loginMethod === 'password' && !password)}
                            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin h-5 w-5" />
                                    {loginMethod === 'magic_link' ? 'Sending Link...' : 'Signing In...'}
                                </>
                            ) : (
                                <>
                                    {loginMethod === 'magic_link' ? 'Send Login Link' : 'Sign In'}
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
