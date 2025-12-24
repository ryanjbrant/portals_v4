/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors in child component tree and displays fallback UI.
 * Logs errors to analytics for monitoring.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);

        // Log to analytics (Firebase/Crashlytics when integrated)
        try {
            // Future: analytics.logEvent('app_error', { 
            //   error: error.message,
            //   componentStack: errorInfo.componentStack 
            // });
        } catch {
            // Ignore analytics errors
        }

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <Ionicons name="warning-outline" size={64} color="#FF6B6B" />
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.message}>
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </Text>
                        <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                            <Ionicons name="refresh" size={20} color="#FFF" />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
        marginTop: 16,
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 24,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF6B6B',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
    },
    retryText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ErrorBoundary;
