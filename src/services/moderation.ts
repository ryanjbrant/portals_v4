import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Comprehensive violation types with detailed descriptions
export const VIOLATION_TYPES = [
    {
        id: 'violence',
        label: 'Violence, abuse, and criminal exploitation',
        description: "We don't allow the following:",
        policies: [
            'Promoting or glorifying acts of violence, physical harm, or criminal activities.',
            'Encouraging or endorsing abusive behavior towards individuals or groups.',
            'Sharing content that supports or incites criminal exploitation.'
        ]
    },
    {
        id: 'hate',
        label: 'Hate and harassment',
        description: "We don't allow the following:",
        policies: [
            'Targeting individuals or groups based on protected characteristics (race, ethnicity, religion, gender, sexual orientation, disability, etc.).',
            'Persistent harassment, bullying, or intimidation of others.',
            'Content designed to demean, shame, or humiliate others.'
        ]
    },
    {
        id: 'self_harm',
        label: 'Suicide and self-harm',
        description: "We don't allow the following:",
        policies: [
            'Content that promotes, glorifies, or instructs self-harm or suicide.',
            'Sharing methods or encouraging self-destructive behavior.',
            'Content that trivializes or mocks mental health struggles.'
        ]
    },
    {
        id: 'misinformation',
        label: 'Misinformation',
        description: "We don't allow the following:",
        policies: [
            'Deliberately spreading false or misleading information.',
            'Content that could cause real-world harm if believed.',
            'Manipulated media presented as authentic.'
        ]
    },
    {
        id: 'fraud',
        label: 'Frauds and scams',
        description: "We don't allow the following:",
        policies: [
            'Phishing attempts or financial scams.',
            'Fake giveaways or deceptive prize offers.',
            'Impersonation for fraudulent purposes.'
        ]
    },
    {
        id: 'spam',
        label: 'Deceptive behavior and spam',
        description: "We don't allow the following:",
        policies: [
            'Excessive posting of repetitive or unwanted content.',
            'Artificial engagement manipulation.',
            'Misleading links or clickbait tactics.'
        ]
    },
    {
        id: 'dangerous',
        label: 'Dangerous activities and challenges',
        description: "We don't allow the following:",
        policies: [
            'Content promoting dangerous stunts or challenges.',
            'Instructions for creating weapons or harmful substances.',
            'Encouraging illegal or life-threatening activities.'
        ]
    },
    {
        id: 'nudity',
        label: 'Nudity and graphic content',
        description: "We don't allow the following:",
        policies: [
            'Sexually explicit content or pornography.',
            'Non-consensual intimate imagery.',
            'Graphic violence or gore.'
        ]
    },
    {
        id: 'privacy',
        label: 'Sharing personal information',
        description: "We don't allow the following:",
        policies: [
            'Sharing private information without consent (doxxing).',
            'Posting personal documents, addresses, or financial info.',
            'Revealing private communications without permission.'
        ]
    },
    {
        id: 'intellectual_property',
        label: 'Counterfeits and intellectual property',
        description: "We don't allow the following:",
        policies: [
            'Copyright infringement or pirated content.',
            'Selling or promoting counterfeit goods.',
            'Trademark violations or brand impersonation.'
        ]
    }
];

export type ViolationType = typeof VIOLATION_TYPES[number]['id'];
export type ContentType = 'comments' | 'media' | 'messages' | 'scenes';

export interface ViolationReport {
    id?: string;
    contentId: string;
    contentType: ContentType;
    violationType: ViolationType;
    violationLabel: string;
    reporterId: string;
    reportedUserId: string;
    // Additional context
    postId?: string;
    contentText?: string;
    contentUrl?: string;
    // Metadata
    timestamp?: any;
    status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
}

export const ModerationService = {
    /**
     * Report a violation and flag the content for review
     */
    async reportViolation(report: Omit<ViolationReport, 'id' | 'timestamp' | 'status'>): Promise<string> {
        const violationsRef = collection(db, 'violations', report.contentType, 'reports');

        const docRef = await addDoc(violationsRef, {
            ...report,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        // Auto-hide the flagged content by marking it as flagged
        if (report.contentType === 'comments' && report.postId) {
            const commentRef = doc(db, 'posts', report.postId, 'comments', report.contentId);
            await updateDoc(commentRef, {
                flagged: true,
                flaggedAt: serverTimestamp()
            });
            console.log(`[Moderation] Comment ${report.contentId} marked as flagged`);
        }

        console.log(`[Moderation] Violation reported: ${report.violationType} on ${report.contentType}/${report.contentId}`);
        return docRef.id;
    },

    /**
     * Check if content has already been reported by this user
     */
    async hasUserReported(contentType: ContentType, contentId: string, reporterId: string): Promise<boolean> {
        const violationsRef = collection(db, 'violations', contentType, 'reports');
        const q = query(
            violationsRef,
            where('contentId', '==', contentId),
            where('reporterId', '==', reporterId)
        );

        const snapshot = await getDocs(q);
        return !snapshot.empty;
    },

    /**
     * Get all reports for a specific content item
     */
    async getReportsForContent(contentType: ContentType, contentId: string): Promise<ViolationReport[]> {
        const violationsRef = collection(db, 'violations', contentType, 'reports');
        const q = query(violationsRef, where('contentId', '==', contentId));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ViolationReport));
    },

    /**
     * Get violation type details by ID
     */
    getViolationType(id: ViolationType) {
        return VIOLATION_TYPES.find(v => v.id === id);
    }
};
