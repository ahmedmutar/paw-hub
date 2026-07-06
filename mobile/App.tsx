import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from './src/stores/auth.store'
import { usePortalAuthStore } from './src/stores/portalAuth.store'
import LoginScreen from './src/screens/LoginScreen'
import RootNavigator from './src/navigation/RootNavigator'
import CustomerNavigator from './src/navigation/CustomerNavigator'

export default function App() {
  const isStaffAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isCustomerAuthenticated = usePortalAuthStore((s) => s.isAuthenticated)

  return (
    <SafeAreaProvider>
      {isStaffAuthenticated ? (
        <RootNavigator />
      ) : isCustomerAuthenticated ? (
        <CustomerNavigator />
      ) : (
        <LoginScreen />
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  )
}
