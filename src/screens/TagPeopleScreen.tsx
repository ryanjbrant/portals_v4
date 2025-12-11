import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { USERS } from '../mock';

import { useAppStore } from '../store';

export const TagPeopleScreen = () => {
    const navigation = useNavigation<any>();
    // const route = useRoute<any>(); // Not needed unless we want overrides

    const updateDraftPost = useAppStore(state => state.updateDraftPost);
    const draftPost = useAppStore(state => state.draftPost);

    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(draftPost?.taggedUsers || []));

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleDone = () => {
        updateDraftPost({ taggedUsers: Array.from(selectedIds) });
        navigation.goBack();
    };

    const filteredUsers = USERS.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.name?.toLowerCase().includes(search.toLowerCase())
    );

    const renderItem = ({ item }: { item: any }) => {
        const isSelected = selectedIds.has(item.id);
        return (
            <TouchableOpacity style={styles.userRow} onPress={() => toggleSelection(item.id)}>
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.name}>{item.name}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="black" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Tag People</Text>
                <TouchableOpacity onPress={handleDone}>
                    <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={theme.colors.textDim} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search people"
                    placeholderTextColor={theme.colors.textDim}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList
                data={filteredUsers}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceHighlight,
    },
    title: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    cancelText: {
        color: theme.colors.text,
        fontSize: 16,
    },
    doneText: {
        color: theme.colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceHighlight,
        margin: theme.spacing.m,
        paddingHorizontal: theme.spacing.m,
        paddingVertical: 8,
        borderRadius: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: theme.colors.text,
        fontSize: 16,
    },
    list: {
        paddingHorizontal: theme.spacing.m,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: theme.colors.surface,
    },
    userInfo: {
        flex: 1,
    },
    username: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    name: {
        color: theme.colors.textDim,
        fontSize: 14,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: theme.colors.textDim,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    }
});
