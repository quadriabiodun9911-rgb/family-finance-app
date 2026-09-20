import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { FinanceProvider } from './src/context/FinanceContext';
import { ActionSheetProvider } from './src/context/ActionSheetContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <FinanceProvider>
                    <ActionSheetProvider>
                        <StatusBar style="light" />
                        <RootNavigator />
                    </ActionSheetProvider>
                </FinanceProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
