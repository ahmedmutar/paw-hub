import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import PetsListScreen from '../screens/customer/PetsListScreen'
import PetDetailScreen from '../screens/customer/PetDetailScreen'

export type CustomerStackParamList = {
  PetsList: undefined
  PetDetail: { petId: string; petName: string }
}

const Stack = createNativeStackNavigator<CustomerStackParamList>()

export default function CustomerNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PetsList" component={PetsListScreen} />
        <Stack.Screen name="PetDetail" component={PetDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
