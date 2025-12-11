import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const StorageService = {
    uploadFile: async (uri: string, path: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            const storageRef = ref(storage, path);
            const snapshot = await uploadBytes(storageRef, blob);

            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error) {
            console.error("Upload failed", error);
            throw error;
        }
    }
};
