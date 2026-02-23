import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Client Portal | NOW System',
    description: 'Manage your quotes, invoices, and subscriptions.',
}

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            {/* Top Navbar specifically for Portal, totally distinct from the internal CRM dashboard */}
            <header className="bg-card border-b border-border sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2">
                            <div className="bg-indigo-600 text-white p-1.5 rounded-lg flex items-center justify-center">
                                <span className="font-bold text-lg leading-none tracking-tight">N</span>
                            </div>
                            <span className="font-semibold text-foreground tracking-tight text-lg hidden sm:block">Client Portal</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative w-full h-full">
                {children}
            </main>

            {/* Simple Footer */}
            <footer className="bg-card border-t border-border mt-auto py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} NOW System. All rights reserved.
                </div>
            </footer>
        </div>
    )
}
