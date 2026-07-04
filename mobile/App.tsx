import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from './src/stores/auth.store'
import LoginScreen from './src/screens/LoginScreen'
import RootNavigator from './src/navigation/RootNavigator'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <SafeAreaProvider>
      {isAuthenticated ? <RootNavigator /> : <LoginScreen />}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  )
}
