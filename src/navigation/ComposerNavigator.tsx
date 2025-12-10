import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ComposerEntryScreen } from '../screens/ComposerEntryScreen';
import { CreateCaptureScreen } from '../screens/CreateCaptureScreen';
import { PostDetailsScreen } from '../screens/PostDetailsScreen';

const Stack = createNativeStackNavigator();

export const ComposerNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ComposerEntry" component={ComposerEntryScreen} />
            <Stack.Screen name="CreateCapture" component={CreateCaptureScreen} />
            <Stack.Screen name="PostDetails" component={PostDetailsScreen} />
        </Stack.Navigator>
    );
};
