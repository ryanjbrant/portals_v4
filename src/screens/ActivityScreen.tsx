import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Image, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Notification } from '../types';

export const ActivityScreen = () => {
    const notifications = useAppStore(state => state.notifications);
    const respondToRequest = useAppStore(state => state.respondToRequest);

    const renderItem = ({ item }: { item: Notification }) => (
        <View style={styles.row}>
            <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
            <View style={styles.content}>
                <Text style={styles.text}>
                    <Text style={styles.username}>{item.user.username}</Text> {item.message}
                </Text>
                <Text style={styles.timestamp}>{item.timestamp}</Text>

                {item.type === 'request' && item.status === 'pending' && (
                    <View style={styles.requestActions}>
                        <TouchableOpacity
                            style={[styles.button, styles.acceptButton]}
                            onPress={() => respondToRequest(item.id, 'accepted')}
                        >
                            <Text style={styles.buttonText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.declineButton]}
                            onPress={() => respondToRequest(item.id, 'declined')}
                        >
                            <Text style={styles.buttonText}>Decline</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {item.type === 'request' && item.status && item.status !== 'pending' && (
                    <Text style={styles.statusText}>{item.status === 'accepted' ? 'Request Accepted' : 'Request Declined'}</Text>
                )}
            </View>
            {item.type !== 'request' && (
                <Image source={{ uri: 'https://picsum.photos/50' }} style={styles.postPreview} />
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Activity</Text>
                <View style={styles.filterChip}>
                    <Text style={styles.filterText}>All Activity</Text>
                </View>
            </View>

            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        padding: theme.spacing.m,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceHighlight,
    },
    title: {
        ...theme.typography.h2,
        color: theme.colors.text,
    },
    filterChip: {
        backgroundColor: theme.colors.surfaceHighlight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    filterText: {
        color: theme.colors.text,
        fontSize: 12,
    },
    list: {
        padding: theme.spacing.m,
    },
    row: {
        flexDirection: 'row',
        marginBottom: theme.spacing.l,
        alignItems: 'flex-start',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: theme.spacing.m,
    },
    content: {
        flex: 1,
        marginRight: 8,
    },
    text: {
        color: theme.colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    username: {
        fontWeight: '700',
    },
    timestamp: {
        color: theme.colors.textDim,
        fontSize: 12,
        marginTop: 2,
    },
    postPreview: {
        width: 44,
        height: 44,
        borderRadius: 4,
    },
    requestActions: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 12,
    },
    button: {
        paddingVertical: 6,
        paddingHorizontal: 20,
        borderRadius: 4,
    },
    acceptButton: {
        backgroundColor: theme.colors.primary,
    },
    declineButton: {
        backgroundColor: theme.colors.surfaceHighlight,
    },
    buttonText: {
        color: theme.colors.white,
        fontWeight: '600',
        fontSize: 12,
    },
    statusText: {
        color: theme.colors.textDim,
        marginTop: 8,
        fontSize: 12,
        fontStyle: 'italic',
    }
});
