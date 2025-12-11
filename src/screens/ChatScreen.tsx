import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { USERS, CURRENT_USER } from '../mock';
import { User } from '../types';

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: number;
}

export const ChatScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { userId } = route.params || {};

    const [targetUser, setTargetUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');

    useEffect(() => {
        if (userId) {
            const user = USERS.find(u => u.id === userId);
            setTargetUser(user || null);
            // Mock some initial messages
            setMessages([
                { id: '1', text: 'Hey there!', senderId: userId, timestamp: Date.now() - 100000 },
                { id: '2', text: 'Hi! How are you?', senderId: CURRENT_USER.id, timestamp: Date.now() - 50000 },
            ]);
        }
    }, [userId]);

    const handleSend = () => {
        if (!inputText.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            senderId: CURRENT_USER.id,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText('');
    };

    const renderItem = ({ item }: { item: Message }) => {
        const isMe = item.senderId === CURRENT_USER.id;
        return (
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
                {!isMe && targetUser && (
                    <Image source={{ uri: targetUser.avatar }} style={styles.avatar} />
                )}
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {item.text}
                    </Text>
                </View>
            </View>
        );
    };

    if (!targetUser) return (
        <View style={styles.loading}>
            <Text style={{ color: 'white' }}>Loading user...</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Image source={{ uri: targetUser.avatar }} style={styles.headerAvatar} />
                    <Text style={styles.headerName}>{targetUser.username}</Text>
                </View>
                <View style={{ width: 32 }} />
            </View>

            <FlatList
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={theme.colors.textDim}
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={handleSend}
                    />
                    <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                        <Ionicons name="send" size={20} color={theme.colors.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loading: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceHighlight,
    },
    backButton: {
        padding: 4,
    },
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
    headerName: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    listContent: {
        padding: theme.spacing.m,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    myMessageRow: {
        justifyContent: 'flex-end',
    },
    theirMessageRow: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 8,
    },
    bubble: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
        maxWidth: '75%',
    },
    myBubble: {
        backgroundColor: theme.colors.primary,
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: theme.colors.surfaceHighlight,
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
    },
    myMessageText: {
        color: 'black', // Assuming high contrast on primary (yellow)
    },
    theirMessageText: {
        color: theme.colors.text,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: theme.spacing.m,
        borderTopWidth: 1,
        borderTopColor: theme.colors.surfaceHighlight,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: theme.colors.surfaceHighlight,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: theme.colors.text,
        marginRight: 10,
    },
    sendButton: {
        backgroundColor: theme.colors.primary,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
