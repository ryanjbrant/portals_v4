import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';

export const CreateCaptureScreen = () => {
    const navigation = useNavigation<any>();

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.overlay}>
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="close" size={28} color={theme.colors.white} />
                </TouchableOpacity>

                <View style={styles.controls}>
                    <TouchableOpacity style={styles.recordButton} onPress={() => navigation.navigate('PostDetails')}>
                        <View style={styles.recordInner} />
                    </TouchableOpacity>
                </View>

                <View style={styles.bottomBar}>
                    <TouchableOpacity><Text style={styles.optionText}>Gallery</Text></TouchableOpacity>
                    <Text style={styles.activeOptionText}>Video</Text>
                    <TouchableOpacity><Text style={styles.optionText}>Templates</Text></TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', // Camera view placeholder
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
    },
    closeButton: {
        marginLeft: theme.spacing.m,
        marginTop: theme.spacing.m,
    },
    controls: {
        alignItems: 'center',
        marginBottom: 40,
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 6,
        borderColor: 'rgba(255,255,255,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.colors.primary,
    },
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 30,
        marginBottom: 20,
    },
    optionText: {
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    activeOptionText: {
        color: theme.colors.white,
        fontWeight: '700',
    }
});
