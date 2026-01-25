"use client";

import { Lock, ShieldCheck, Mail, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [isSignUp, setIsSignUp] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const supabase = createClient();

        let error;
        if (isSignUp) {
            const res = await supabase.auth.signUp({
                email,
                password,
            });
            error = res.error;
            if (!error && res.data.user) {
                toast.success("Account Created!", { description: "You can now sign in." });
                setIsSignUp(false); // Switch back to login
                setIsLoading(false);
                return;
            }
        } else {
            const res = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            error = res.error;
        }

        if (error) {
            toast.error(isSignUp ? "Sign Up Failed" : "Login Failed", { description: error.message });
            setIsLoading(false);
        } else {
            // Check if session is established?
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                toast.success("Welcome back!", { description: "Redirecting to dashboard..." });
                router.push("/dashboard");
                router.refresh();
            } else {
                toast.error("Login successful but no session??");
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans overflow-hidden relative">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full" />

            <div className="w-full max-w-[420px] z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mb-2">
                        <ShieldCheck size={32} className="text-blue-500" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">employeeOS</h1>
                    <p className="text-zinc-500 text-sm">Secure Management System for Enterprises</p>
                </div>

                <form onSubmit={handleLogin} className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl shadow-canvas backdrop-blur-xl space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest ml-1">Work Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : (isSignUp ? "Create Account" : "Sign In")}
                        {!isLoading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                    </button>

                    <div className="pt-4 text-center space-y-2">
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-zinc-400 text-sm hover:text-white transition-colors"
                        >
                            {isSignUp ? "Already have an account? Sign In" : "Need an account? Create one"}
                        </button>
                        {!isSignUp && (
                            <div className="block">
                                <Link href="/dashboard" className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
                                    Forgot password? Contact your System Administrator.
                                </Link>
                            </div>
                        )}
                    </div>
                </form>

                <p className="text-center text-[10px] text-zinc-500 uppercase tracking-widest">
                    Secured by RLS Isolation & 256-bit Encryption
                </p>
            </div>
        </div>
    );
}
