import React, { useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { FeedScreen } from '../screens/FeedScreen';
import { PeopleScreen } from '../screens/PeopleScreen';
import { ComposerNavigator } from './ComposerNavigator';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { View, TouchableOpacity, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const ComposeButton = ({ navigation }: { navigation: any }) => {
    const setVoiceActive = useAppStore((state: any) => state.setVoiceActive);
    const scaleValue = useRef(new Animated.Value(1)).current;

    const handleLongPress = () => {
        Animated.spring(scaleValue, {
            toValue: 1.2,
            friction: 3,
            tension: 40,
            useNativeDriver: true
        }).start();
        setVoiceActive(true);
    };

    const handlePressOut = () => {
        Animated.spring(scaleValue, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true
        }).start();
        setVoiceActive(false);
    };

    return (
        <AnimatedTouchableOpacity
            style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: theme.colors.white,
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: -20,
                borderWidth: 4,
                borderColor: theme.colors.background,
                transform: [{ scale: scaleValue }]
            }}
            onPress={() => navigation.navigate('Compose')}
            onLongPress={handleLongPress}
            onPressOut={handlePressOut}
            delayLongPress={150}
            activeOpacity={1}
        >
            <Ionicons name="add" size={32} color="black" />
        </AnimatedTouchableOpacity>
    );
};

export const BottomTabNavigator = () => {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={({ route, navigation }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: theme.colors.background,
                    borderTopColor: theme.colors.border,
                    height: Platform.OS === 'ios' ? 60 + insets.bottom : 70,
                    paddingBottom: Platform.OS === 'ios' ? insets.bottom : 10,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: theme.colors.white,
                tabBarInactiveTintColor: theme.colors.textDim,
                tabBarShowLabel: true,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: any;

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Friends') {
                        iconName = focused ? 'people' : 'people-outline';
                    } else if (route.name === 'Compose') {
                        return <ComposeButton navigation={navigation} />;
                    } else if (route.name === 'Map') {
                        iconName = focused ? 'map' : 'map-outline';
                    } else if (route.name === 'Me') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={24} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={FeedScreen} />
            <Tab.Screen name="Friends" component={PeopleScreen} />
            <Tab.Screen
                name="Compose"
                component={ComposerNavigator}
                options={{ tabBarLabel: () => null }}
            />
            <Tab.Screen name="Map" component={MapScreen} />
            <Tab.Screen name="Me" component={ProfileScreen} />
        </Tab.Navigator>
    );
};
