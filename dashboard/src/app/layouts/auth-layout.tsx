import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo-white.svg" alt="MRRlytics" className="h-10 w-auto hidden dark:block" />
          <img src="/logo-purple.svg" alt="MRRlytics" className="h-10 w-auto block dark:hidden" />
          <p className="mt-3 text-sm text-muted">
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
