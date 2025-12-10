import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { AuthService } from '../services/auth';
import { useAppStore } from '../store';

export const RegisterScreen = () => {
    const navigation = useNavigation<any>();
    const login = useAppStore(state => state.login); // We might need a raw 'setUser' instead of login which sets mock data

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [avatar, setAvatar] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleRegister = async () => {
        if (!email || !password || !username) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const user = await AuthService.registerUser(email, password, username, avatar || undefined);

            // Update global store with the new real user
            // Note: Our store currently has a simple 'login' that sets mock data. 
            // We should update the store to accept a user object.
            // For now, we will handle this by manually updating the store state if possible, 
            // or we assume the AuthObserver (if we add one) would trigger it.
            // But simply:
            useAppStore.setState({ currentUser: user, isAuthenticated: true });

            Alert.alert('Success', 'Account created!', [
                { text: 'OK', onPress: () => { } } // RootNavigator will auto-switch to Main
            ]);
        } catch (error: any) {
            Alert.alert('Registration Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.white} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join the Portals community</Text>

                    <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="camera" size={32} color={theme.colors.textDim} />
                                <Text style={styles.avatarText}>Add Photo</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color={theme.colors.textDim} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Username"
                                placeholderTextColor={theme.colors.textDim}
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color={theme.colors.textDim} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor={theme.colors.textDim}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textDim} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={theme.colors.textDim}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textDim} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
                                placeholderTextColor={theme.colors.textDim}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.registerButton, loading && styles.disabledButton]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            <Text style={styles.registerButtonText}>{loading ? 'Creating...' : 'Sign Up'}</Text>
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.orText}>OR</Text>
                            <View style={styles.line} />
                        </View>

                        <TouchableOpacity style={styles.googleButton}>
                            <Ionicons name="logo-google" size={20} color={theme.colors.white} />
                            <Text style={styles.googleButtonText}>Sign up with Google</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: theme.spacing.l,
        paddingTop: 60,
    },
    backButton: {
        marginBottom: 20,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.white,
        marginBottom: 8,
    },
    subtitle: {
        color: theme.colors.textDim,
        fontSize: 16,
        marginBottom: 32,
    },
    avatarContainer: {
        alignSelf: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderStyle: 'dashed',
    },
    avatarText: {
        color: theme.colors.textDim,
        fontSize: 12,
        marginTop: 4,
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 16,
    },
    registerButton: {
        backgroundColor: theme.colors.primary,
        height: 56,
        borderRadius: theme.borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    disabledButton: {
        opacity: 0.7,
    },
    registerButtonText: {
        color: theme.colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    orText: {
        color: theme.colors.textDim,
        marginHorizontal: 16,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceHighlight,
        height: 56,
        borderRadius: theme.borderRadius.m,
        gap: 12,
    },
    googleButtonText: {
        color: theme.colors.white,
        fontSize: 16,
        fontWeight: '600',
    }
});
