import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { AuthService } from '../services/auth';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { BlurView } from 'expo-blur';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

// Static logo
const portalsLogo = require('../../assets/logo/portals-logo.png');

export const LoginScreen = () => {
    const navigation = useNavigation<any>();

    // Google Auth Configuration
    const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: '498765366652-3tkrtesmgfg5i9mvjbq392c9g2k7iubs.apps.googleusercontent.com',
        iosClientId: '498765366652-3tkrtesmgfg5i9mvjbq392c9g2k7iubs.apps.googleusercontent.com', // Using Web ID for now as fallback/universal
        webClientId: '498765366652-3tkrtesmgfg5i9mvjbq392c9g2k7iubs.apps.googleusercontent.com',
    });

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            handleGoogleSignIn(id_token);
        } else if (response?.type === 'error') {
            Alert.alert('Google Sign-In Error', 'Authentication failed');
        }
    }, [response]);

    const handleGoogleSignIn = async (idToken: string) => {
        setLoading(true);
        try {
            const user = await AuthService.googleLogin(idToken);
            useAppStore.setState({ currentUser: user, isAuthenticated: true });
        } catch (error: any) {
            Alert.alert('Google Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setLoading(true);
        try {
            const user = await AuthService.loginUser(email, password);
            useAppStore.setState({ currentUser: user, isAuthenticated: true });
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <AnimatedBackground />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Image
                            source={portalsLogo}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.form}>
                        {/* Unified form group with glass effect */}
                        <BlurView intensity={40} tint="dark" style={styles.formGroup}>
                            <View style={styles.inputRow}>
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
                            <View style={styles.inputDivider} />
                            <View style={styles.inputRow}>
                                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textDim} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor={theme.colors.textDim}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textDim} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputDivider} />
                            <TouchableOpacity
                                style={[styles.formButton, loading && styles.disabledButton]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="black" />
                                ) : (
                                    <Text style={styles.formButtonText}>Log In</Text>
                                )}
                            </TouchableOpacity>
                        </BlurView>

                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.orText}>OR</Text>
                            <View style={styles.line} />
                        </View>

                        <View style={styles.socialButtons}>
                            <TouchableOpacity
                                style={[styles.socialButton, !request && { opacity: 0.5 }]}
                                onPress={() => promptAsync()}
                                disabled={!request}
                            >
                                <Ionicons name="logo-google" size={24} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.socialButton}>
                                <Ionicons name="logo-apple" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.registerText}>Register New</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView >
        </View >
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
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: theme.spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoImage: {
        width: 200,
        height: 200,
    },
    form: {
        width: '100%',
    },
    formGroup: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 54,
    },
    inputDivider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginLeft: 48,
    },
    inputIcon: {
        marginRight: 12,
        width: 20,
    },
    input: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 17,
    },
    formButton: {
        backgroundColor: theme.colors.primary,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
    },
    formButtonText: {
        color: 'black',
        fontSize: 17,
        fontWeight: '600',
    },
    forgotPassword: {
        alignSelf: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: theme.colors.primary,
        fontSize: 14,
    },
    disabledButton: {
        opacity: 0.7,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 32,
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
    socialButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
    },
    socialButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 48,
    },
    footerText: {
        color: theme.colors.textDim,
        fontSize: 14,
    },
    registerText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
    }
});
