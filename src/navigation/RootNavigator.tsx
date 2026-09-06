import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from './types';
import AuthScreen from '../screens/AuthScreen';
import HouseholdSetupScreen from '../screens/HouseholdSetupScreen';
import TabNavigator from './TabNavigator';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import AddGoalScreen from '../screens/AddGoalScreen';
import GoalDetailScreen from '../screens/GoalDetailScreen';
import SavingsInvestmentsScreen from '../screens/SavingsInvestmentsScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import ReportsScreen from '../screens/ReportsScreen';
import IncomeInsightsScreen from '../screens/IncomeInsightsScreen';
import CoachScreen from '../screens/CoachScreen';
import HouseholdScreen from '../screens/HouseholdScreen';
import ImportStatementScreen from '../screens/ImportStatementScreen';
import RiskDecisionScreen from '../screens/RiskDecisionScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: Colors.bg, card: Colors.surface, border: Colors.border, primary: Colors.primary, text: Colors.text },
};

export default function RootNavigator() {
    const { isLoading: authLoading, session } = useAuth();
    const { isLoading: financeLoading, isOnboarded } = useFinance();

    if (authLoading || (session && financeLoading)) {
        return (
            <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer theme={navTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!session ? (
                    <Stack.Screen name="Auth" component={AuthScreen} />
                ) : !isOnboarded ? (
                    <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
                ) : (
                    <>
                        <Stack.Screen name="Tabs" component={TabNavigator} />
                        <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ presentation: 'modal' }} />
                        <Stack.Screen name="AddGoal" component={AddGoalScreen} options={{ presentation: 'modal' }} />
                        <Stack.Screen name="GoalDetail" component={GoalDetailScreen} />
                        <Stack.Screen name="SavingsInvestments" component={SavingsInvestmentsScreen} />
                        <Stack.Screen name="Analysis" component={AnalysisScreen} />
                        <Stack.Screen name="Reports" component={ReportsScreen} />
                        <Stack.Screen name="IncomeInsights" component={IncomeInsightsScreen} />
                        <Stack.Screen name="Coach" component={CoachScreen} />
                        <Stack.Screen name="Household" component={HouseholdScreen} />
                        <Stack.Screen name="ImportStatement" component={ImportStatementScreen} />
                        <Stack.Screen name="RiskDecision" component={RiskDecisionScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
