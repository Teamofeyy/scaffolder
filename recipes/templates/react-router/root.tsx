import { Link, Outlet } from 'react-router'

export default function RootRoute() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            {{project_name}}
          </Link>
          <nav className="text-sm text-slate-600">
            <Link to="/" className="hover:text-slate-950">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
