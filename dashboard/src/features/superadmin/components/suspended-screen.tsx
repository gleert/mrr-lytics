import { useAuth } from '@/app/providers'

export function SuspendedScreen() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-background">
      <div className="max-w-md space-y-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-error/10 border border-error/20 mx-auto">
          <span className="text-3xl">🔒</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Cuenta suspendida</h1>
          <p className="text-muted leading-relaxed">
            Tu cuenta ha sido suspendida temporalmente. Por favor, contacta con soporte para obtener más información y resolver la situación.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-left space-y-2">
          <p className="text-sm font-medium text-foreground">¿Qué puedo hacer?</p>
          <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
            <li>Contacta con soporte en <a href="mailto:support@mrrlytics.com" className="text-primary-400 hover:underline">support@mrrlytics.com</a></li>
            <li>Revisa el estado de tu suscripción</li>
            <li>Verifica que no haya pagos pendientes</li>
          </ul>
        </div>

        <button
          onClick={() => signOut()}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
