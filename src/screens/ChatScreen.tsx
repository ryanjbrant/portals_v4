import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { User, Message } from '../types';
import { MessageService } from '../services/messaging';

export const ChatScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { userId } = route.params || {};
    const currentUser = useAppStore(state => state.currentUser);

    const [targetUser, setTargetUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    // Load target user and get/create conversation
    useEffect(() => {
        if (!userId || !currentUser) return;

        const init = async () => {
            setLoading(true);
            try {
                // Fetch target user from Firestore
                const userSnap = await getDoc(doc(db, 'users', userId));
                if (userSnap.exists()) {
                    setTargetUser(userSnap.data() as User);
                }

                // Get or create conversation
                const convId = await MessageService.getOrCreateConversation(currentUser.id, userId);
                setConversationId(convId);

                // Mark messages as read
                await MessageService.markAsRead(convId, currentUser.id);
            } catch (error) {
                console.error('[ChatScreen] Init error:', error);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [userId, currentUser]);

    // Subscribe to real-time messages
    useEffect(() => {
        if (!conversationId) return;

        const unsubscribe = MessageService.subscribeToMessages(conversationId, (msgs) => {
            setMessages(msgs);
            // Scroll to bottom on new messages
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        });

        return () => unsubscribe();
    }, [conversationId]);

    const handleSend = async () => {
        if (!inputText.trim() || !conversationId || !currentUser) return;

        const text = inputText.trim();
        setInputText('');

        try {
            await MessageService.sendMessage(conversationId, currentUser.id, text);
        } catch (error) {
            console.error('[ChatScreen] Send error:', error);
            // Restore input on error
            setInputText(text);
        }
    };

    const renderItem = ({ item }: { item: Message }) => {
        const isMe = item.senderId === currentUser?.id;
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

    if (loading || !currentUser) {
        return (
            <SafeAreaView style={styles.loading}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ color: theme.colors.textDim, marginTop: 12 }}>Loading conversation...</Text>
            </SafeAreaView>
        );
    }

    if (!targetUser) {
        return (
            <SafeAreaView style={styles.loading}>
                <Text style={{ color: theme.colors.text }}>User not found</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                    <Text style={{ color: theme.colors.primary }}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => navigation.navigate('Profile', { userId: targetUser.id })}
                >
                    <Image source={{ uri: targetUser.avatar }} style={styles.headerAvatar} />
                    <Text style={styles.headerName}>{targetUser.username}</Text>
                </TouchableOpacity>
                <View style={{ width: 32 }} />
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
                        returnKeyType="send"
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
        flexGrow: 1,
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
        color: 'black',
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
