export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-1 pb-6 border-b border-white/10">
                <h1 className="text-4xl font-extrabold tracking-tight gradient-text">Settings</h1>
                <p className="text-zinc-500 text-sm">Global platform configuration and security.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                <a href="/dashboard/settings/datamodel" className="group block p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-all cursor-pointer">
                    <h3 className="text-lg font-semibold group-hover:text-primary mb-2">Data Model</h3>
                    <p className="text-muted-foreground text-sm">Configure custom fields, attributes, and validation rules for your tenant.</p>
                </a>

                {/* Future settings placeholders */}
                <div className="p-6 bg-card/50 border border-border/50 rounded-xl opacity-60">
                    <h3 className="text-lg font-semibold mb-2">General Settings</h3>
                    <p className="text-muted-foreground text-sm">Tenant details and branding (Coming Soon).</p>
                </div>
            </div>
        </div>
    );
}
