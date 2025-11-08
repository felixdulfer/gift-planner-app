import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

// Helper function to remove undefined values from objects
const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
};

export interface WishlistItem {
  id: string;
  name: string;
  description?: string;
  link?: string;
  price?: number;
  purchasedBy?: string;
  purchasedAt?: Timestamp;
}

export interface Wishlist {
  id: string;
  name: string;
  eventId: string;
  createdBy: string;
  createdAt: Timestamp;
  items: WishlistItem[];
}

// Helper function to clean wishlist items array
const cleanWishlistItems = (items: WishlistItem[]): WishlistItem[] => {
  return items.map((item) => {
    const cleaned = removeUndefined(item);
    return {
      id: item.id,
      name: item.name,
      ...cleaned,
    } as WishlistItem;
  });
};

export const createWishlist = async (
  name: string,
  eventId: string,
  createdBy: string
): Promise<string> => {
  try {
    const wishlistData = {
      name,
      eventId,
      createdBy,
      createdAt: serverTimestamp(),
      items: [],
    };

    const docRef = await addDoc(collection(db, 'wishlists'), wishlistData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create wishlist');
  }
};

export const getWishlist = async (
  wishlistId: string
): Promise<Wishlist | null> => {
  try {
    const docRef = doc(db, 'wishlists', wishlistId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Wishlist;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get wishlist');
  }
};

export const getWishlistsForEvent = async (
  eventId: string
): Promise<Wishlist[]> => {
  try {
    const q = query(
      collection(db, 'wishlists'),
      where('eventId', '==', eventId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Wishlist[];
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get wishlists');
  }
};

export const updateWishlist = async (
  wishlistId: string,
  updates: Partial<{ name: string }>
): Promise<void> => {
  try {
    const docRef = doc(db, 'wishlists', wishlistId);
    await updateDoc(docRef, updates);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update wishlist');
  }
};

export const deleteWishlist = async (wishlistId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'wishlists', wishlistId));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete wishlist');
  }
};

export const addItemToWishlist = async (
  wishlistId: string,
  item: Omit<WishlistItem, 'id'>
): Promise<void> => {
  try {
    const wishlistRef = doc(db, 'wishlists', wishlistId);
    const wishlistSnap = await getDoc(wishlistRef);

    if (!wishlistSnap.exists()) {
      throw new Error('Wishlist not found');
    }

    const wishlistData = wishlistSnap.data() as Wishlist;
    // Remove undefined values before creating the item
    const cleanedItem = removeUndefined(item);
    const newItem: WishlistItem = {
      id: Date.now().toString(),
      name: item.name,
      ...cleanedItem,
    };

    const existingItems = wishlistData.items || [];
    const cleanedExistingItems = cleanWishlistItems(existingItems);
    
    await updateDoc(wishlistRef, {
      items: [...cleanedExistingItems, newItem],
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to add item');
  }
};

export const updateWishlistItem = async (
  wishlistId: string,
  itemId: string,
  updates: Partial<WishlistItem>
): Promise<void> => {
  try {
    const wishlistRef = doc(db, 'wishlists', wishlistId);
    const wishlistSnap = await getDoc(wishlistRef);

    if (!wishlistSnap.exists()) {
      throw new Error('Wishlist not found');
    }

    const wishlistData = wishlistSnap.data() as Wishlist;
    // Remove undefined values from updates
    const cleanedUpdates = removeUndefined(updates);
    const updatedItems = wishlistData.items.map((item) =>
      item.id === itemId ? { ...item, ...cleanedUpdates } : item
    );

    // Clean all items to ensure no undefined values
    const cleanedItems = cleanWishlistItems(updatedItems);

    await updateDoc(wishlistRef, { items: cleanedItems });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update item');
  }
};

export const deleteWishlistItem = async (
  wishlistId: string,
  itemId: string
): Promise<void> => {
  try {
    const wishlistRef = doc(db, 'wishlists', wishlistId);
    const wishlistSnap = await getDoc(wishlistRef);

    if (!wishlistSnap.exists()) {
      throw new Error('Wishlist not found');
    }

    const wishlistData = wishlistSnap.data() as Wishlist;
    const updatedItems = wishlistData.items.filter((item) => item.id !== itemId);

    await updateDoc(wishlistRef, { items: updatedItems });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete item');
  }
};

export const markItemAsPurchased = async (
  wishlistId: string,
  itemId: string,
  purchasedBy: string
): Promise<void> => {
  await updateWishlistItem(wishlistId, itemId, {
    purchasedBy,
    purchasedAt: Timestamp.now(),
  });
};

export const subscribeToWishlistsForEvent = (
  eventId: string,
  callback: (wishlists: Wishlist[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'wishlists'),
    where('eventId', '==', eventId)
  );

  return onSnapshot(q, (querySnapshot) => {
    const wishlists = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Wishlist[];
    callback(wishlists);
  });
};

export const subscribeToWishlist = (
  wishlistId: string,
  callback: (wishlist: Wishlist | null) => void
): Unsubscribe => {
  const docRef = doc(db, 'wishlists', wishlistId);

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Wishlist);
    } else {
      callback(null);
    }
  });
};

