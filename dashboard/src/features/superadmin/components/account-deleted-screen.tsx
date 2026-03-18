import { useAuth } from '@/app/providers'

export function AccountDeletedScreen() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-background">
      <div className="max-w-md space-y-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/10 border border-muted/20 mx-auto text-3xl">
          🗑️
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Tu cuenta ha sido eliminada</h1>
          <p className="text-muted leading-relaxed">
            Tu organización y todos los datos asociados han sido eliminados. Si crees que esto es un error, contacta con soporte.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-left space-y-2">
          <p className="text-sm font-medium text-foreground">¿Necesitas ayuda?</p>
          <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
            <li>Contacta con soporte en <a href="mailto:hello@mrrlytics.com" className="text-primary-400 hover:underline">hello@mrrlytics.com</a></li>
            <li>Si quieres crear una nueva cuenta, cierra sesión y regístrate de nuevo</li>
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
