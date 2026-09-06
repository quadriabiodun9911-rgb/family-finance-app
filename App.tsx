import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { FinanceProvider } from './src/context/FinanceContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <FinanceProvider>
                    <StatusBar style="light" />
                    <RootNavigator />
                </FinanceProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
