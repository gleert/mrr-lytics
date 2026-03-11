import { AppProviders } from './app/providers'
import { AppRoutes } from './app/routes'
import { AmbientBackground } from './shared/components/ui/ambient-background'

function App() {
  return (
    <AppProviders>
      <AmbientBackground />
      <AppRoutes />
    </AppProviders>
  )
}

export default App
