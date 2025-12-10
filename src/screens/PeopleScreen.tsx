import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { USERS } from '../mock';

import { useRoute } from '@react-navigation/native';

export const PeopleScreen = () => {
    const route = useRoute<any>();
    const initialTab = route.params?.tab || 'Friends';
    const [activeTab, setActiveTab] = useState(initialTab);

    // Need to sync state if params change while screen is mounted
    React.useEffect(() => {
        if (route.params?.tab) {
            setActiveTab(route.params.tab);
        }
    }, [route.params]);

    const [search, setSearch] = useState('');

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.userRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.userStatus}>Online now</Text>
            </View>
            <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionText}>{activeTab === 'Friends' ? 'Message' : 'Follow'}</Text>
            </TouchableOpacity>
            <TouchableOpacity>
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>People</Text>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for a person"
                        placeholderTextColor={theme.colors.textDim}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            <View style={styles.tabs}>
                {['Team', 'Friends', 'Invites', 'Following'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={USERS}
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
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
        marginBottom: theme.spacing.m,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceHighlight,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: theme.spacing.m,
    },
    searchIcon: {
        marginRight: theme.spacing.s,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        color: theme.colors.text,
        fontSize: 16,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing.m,
        gap: 12,
        marginBottom: theme.spacing.m,
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.borderRadius.l,
        backgroundColor: theme.colors.surface,
    },
    activeTab: {
        backgroundColor: theme.colors.white,
    },
    tabText: {
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: theme.colors.background,
    },
    list: {
        padding: theme.spacing.m,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: theme.spacing.m,
    },
    userInfo: {
        flex: 1,
    },
    username: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    userStatus: {
        color: theme.colors.textDim,
        fontSize: 12,
    },
    actionButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 4,
        marginRight: theme.spacing.m,
    },
    actionText: {
        color: theme.colors.white,
        fontWeight: '600',
        fontSize: 12,
    }
});
