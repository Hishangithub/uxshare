// src/app/page.tsx
export default function HomePage() {
    return (
        <section className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Welcome to UXShare</h2>
                <p className="mt-2 max-w-2xl text-gray-700">
                    Upload your UI/UX work, get structured feedback, and keep it
                    constructive with built-in moderation.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="font-semibold">Core idea</h3>
                    <p className="mt-1 text-sm text-gray-700">
                        Designers share work and receive ratings + actionable suggestions
                        across usability, aesthetics, accessibility, and copy.
                    </p>
                </div>
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="font-semibold">Next steps</h3>
                    <ul className="mt-1 text-sm text-gray-700 list-disc pl-5">
                        <li>Add Supabase (auth, database, storage)</li>
                        <li>Build Upload page</li>
                        <li>Add feedback form + rules-based moderation</li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
