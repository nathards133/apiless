import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase.js';

export async function uploadNFe(buffer, filename) {
  try {
    const storageRef = ref(storage, `nfe/${filename}`);
    await uploadBytes(storageRef, buffer);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error('Erro ao fazer upload da NFe:', error);
    throw error;
  }
} 