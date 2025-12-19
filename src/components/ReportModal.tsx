import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Alert,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { theme } from '../theme/theme';
import { VIOLATION_TYPES, ModerationService, ViolationType, ContentType } from '../services/moderation';

const { height } = Dimensions.get('window');

interface ReportModalProps {
    visible: boolean;
    onClose: () => void;
    contentType: ContentType;
    contentId: string;
    contentText?: string;
    postId?: string;
    reportedUserId: string;
    reporterId: string;
}

export const ReportModal = ({
    visible,
    onClose,
    contentType,
    contentId,
    contentText,
    postId,
    reportedUserId,
    reporterId
}: ReportModalProps) => {
    const [stage, setStage] = useState<'select' | 'confirm'>('select');
    const [selectedViolation, setSelectedViolation] = useState<typeof VIOLATION_TYPES[number] | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSelectViolation = (violation: typeof VIOLATION_TYPES[number]) => {
        setSelectedViolation(violation);
        setStage('confirm');
    };

    const handleBack = () => {
        setStage('select');
        setSelectedViolation(null);
    };

    const handleClose = () => {
        setStage('select');
        setSelectedViolation(null);
        onClose();
    };

    const handleConfirm = async () => {
        if (!selectedViolation || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Check if already reported
            const alreadyReported = await ModerationService.hasUserReported(
                contentType,
                contentId,
                reporterId
            );

            if (alreadyReported) {
                Alert.alert(
                    'Already Reported',
                    'You have already reported this content. Our team is reviewing it.',
                    [{ text: 'OK', onPress: handleClose }]
                );
                return;
            }

            // Submit the report
            await ModerationService.reportViolation({
                contentId,
                contentType,
                violationType: selectedViolation.id as ViolationType,
                violationLabel: selectedViolation.label,
                reporterId,
                reportedUserId,
                postId,
                contentText
            });

            Alert.alert(
                'Report Submitted',
                'Thank you for keeping our community safe. We will review this content shortly.',
                [{ text: 'OK', onPress: handleClose }]
            );
        } catch (error) {
            console.error('Failed to submit report:', error);
            Alert.alert(
                'Error',
                'Failed to submit report. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // Debug log
    console.log('[ReportModal] Rendering - Stage:', stage, 'Violations count:', VIOLATION_TYPES.length);

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.dismissArea} onPress={handleClose} />

                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        {stage === 'confirm' ? (
                            <TouchableOpacity onPress={handleBack}>
                                <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 24 }} />
                        )}
                        <Text style={styles.headerTitle}>Report</Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Ionicons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Stage 1: Select Reason */}
                    {stage === 'select' && (
                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                            <Text style={styles.sectionTitle}>Select a reason</Text>

                            {VIOLATION_TYPES.map((violation) => (
                                <TouchableOpacity
                                    key={violation.id}
                                    style={styles.violationItem}
                                    onPress={() => handleSelectViolation(violation)}
                                >
                                    <Text style={styles.violationLabel}>{violation.label}</Text>
                                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textDim} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Stage 2: Confirmation */}
                    {stage === 'confirm' && selectedViolation && (
                        <View style={styles.content}>
                            <Text style={styles.confirmTitle}>{selectedViolation.label}</Text>

                            <Text style={styles.policyHeader}>{selectedViolation.description}</Text>

                            {selectedViolation.policies.map((policy, index) => (
                                <View key={index} style={styles.policyItem}>
                                    <Text style={styles.policyBullet}>•</Text>
                                    <Text style={styles.policyText}>{policy}</Text>
                                </View>
                            ))}

                            {/* Content Preview */}
                            {contentText && (
                                <View style={styles.contentPreview}>
                                    <Text style={styles.contentPreviewLabel}>Reported content:</Text>
                                    <Text style={styles.contentPreviewText} numberOfLines={3}>
                                        "{contentText}"
                                    </Text>
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.button, styles.confirmButton]}
                                    onPress={handleConfirm}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.buttonText}>
                                        {isSubmitting ? 'Submitting...' : 'Confirm'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={handleClose}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.buttonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    dismissArea: {
        flex: 1,
    },
    container: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        minHeight: height * 0.6,
        maxHeight: height * 0.85,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 24,
    },
    violationItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    violationLabel: {
        fontSize: 16,
        color: theme.colors.textDim,
        flex: 1,
        marginRight: 12,
    },
    confirmTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#E6B980', // Gold/amber color like in the reference
        marginBottom: 24,
    },
    policyHeader: {
        fontSize: 16,
        color: theme.colors.textDim,
        marginBottom: 16,
    },
    policyItem: {
        flexDirection: 'row',
        marginBottom: 12,
        paddingRight: 16,
    },
    policyBullet: {
        fontSize: 16,
        color: theme.colors.textDim,
        marginRight: 8,
    },
    policyText: {
        fontSize: 15,
        color: theme.colors.textDim,
        flex: 1,
        lineHeight: 22,
    },
    contentPreview: {
        marginTop: 24,
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
    },
    contentPreviewLabel: {
        fontSize: 12,
        color: theme.colors.textDim,
        marginBottom: 8,
    },
    contentPreviewText: {
        fontSize: 14,
        color: theme.colors.text,
        fontStyle: 'italic',
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 32,
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
});
