import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { LinearGradient } from 'expo-linear-gradient';

export const ComposerEntryScreen = () => {
    const navigation = useNavigation<any>();
    const drafts = useAppStore(state => state.drafts);
    const fetchDrafts = useAppStore(state => state.fetchDrafts);

    React.useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchDrafts();
        });
        return unsubscribe;
    }, [navigation]);
    const [activeTab, setActiveTab] = React.useState<'Drafts' | 'Collabs'>('Drafts');

    // Mock Collabs Data
    const collabs = [
        { id: 'c1', title: 'Fashion Week', date: 'w/ @gucci' },
        { id: 'c2', title: 'Skate Comp', date: '4 members' },
    ];

    const currentData = activeTab === 'Drafts' ? drafts : collabs;

    const renderDraft = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.draftCard}
            onPress={() => navigation.navigate('ComposerEditor', {
                draftData: item.sceneData,
                draftTitle: item.title || "Untitled"
            })}
        >
            {item.coverImage ? (
                <Image source={{ uri: item.coverImage }} style={[styles.draftPreview, { marginBottom: 8 }]} />
            ) : (
                <View style={styles.draftPreview} />
            )}
            <Text style={styles.draftTitle} numberOfLines={1}>{item.title || "Untitled"}</Text>
            <Text style={styles.draftDate}>{new Date(item.updatedAt || Date.now()).toLocaleDateString()}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a2e', '#000000']}
                style={StyleSheet.absoluteFillObject}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.heroSection}>
                    <View style={styles.orb}>
                        <Ionicons name="planet" size={60} color={theme.colors.secondary} />
                    </View>
                    <Text style={styles.heroTitle}>Create Logic</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.tabs}>
                        <TouchableOpacity onPress={() => setActiveTab('Drafts')}>
                            <Text style={activeTab === 'Drafts' ? styles.activeTab : styles.inactiveTab}>Drafts</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveTab('Collabs')}>
                            <Text style={activeTab === 'Collabs' ? styles.activeTab : styles.inactiveTab}>Collabs</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 200, marginTop: 20 }}>
                        <FlatList
                            horizontal
                            data={[{ id: 'new', title: 'New' }, ...currentData]}
                            renderItem={({ item }) => {
                                if (item.id === 'new') {
                                    return (
                                        <TouchableOpacity style={styles.newCard} onPress={() => navigation.navigate('ComposerEditor')}>
                                            <Ionicons name="add-circle" size={40} color={theme.colors.text} />
                                            <Text style={styles.cardText}>New {activeTab === 'Drafts' ? 'Project' : 'Collab'}</Text>
                                        </TouchableOpacity>
                                    )
                                }
                                return renderDraft({ item });
                            }}
                            keyExtractor={item => item.id}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20 }}
                        />

                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    safeArea: {
        flex: 1,
        justifyContent: 'space-between',
    },
    heroSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    orb: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(37, 244, 238, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(37, 244, 238, 0.3)',
        marginBottom: 20,
    },
    heroTitle: {
        ...theme.typography.h1,
        color: theme.colors.white,
        letterSpacing: 1,
    },
    content: {
        flex: 1,
        paddingBottom: 40,
    },
    tabs: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    activeTab: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
        borderBottomWidth: 2,
        borderBottomColor: theme.colors.white,
        paddingBottom: 4,
    },
    inactiveTab: {
        color: theme.colors.textDim,
        fontSize: 16,
        paddingBottom: 4,
    },
    draftCard: {
        width: 140,
        height: 180,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        marginRight: 12,
        padding: 12,
        justifyContent: 'flex-end',
    },
    newCard: {
        width: 140,
        height: 180,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderStyle: 'dashed',
    },
    draftPreview: {
        flex: 1,
        backgroundColor: theme.colors.surfaceHighlight,
        borderRadius: 8,
        marginBottom: 8,
    },
    draftTitle: {
        color: theme.colors.white,
        fontWeight: '600',
        fontSize: 14,
    },
    draftDate: {
        color: theme.colors.textDim,
        fontSize: 12,
    },
    cardText: {
        color: theme.colors.white,
        marginTop: 8,
        fontWeight: '600',
    }
});
