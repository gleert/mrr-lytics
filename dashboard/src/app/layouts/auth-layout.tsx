import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-4xl font-semibold text-transparent">
            MRRlytics
          </h1>
          <p className="mt-2 text-sm text-muted">
            Analytics for your WHMCS business
          </p>
        </div>

        {/* Auth content */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} MRRlytics. All rights reserved.
        </p>
      </div>
    </div>
  )
}
