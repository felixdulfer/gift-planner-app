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

export interface Assignment {
  id: string;
  eventId: string;
  wishlistId: string;
  assignedTo: string; // userId of the buyer
  assignedBy: string; // userId of the event organizer
  createdAt: Timestamp;
  status: 'pending' | 'purchased';
}

export const createAssignment = async (
  eventId: string,
  wishlistId: string,
  assignedTo: string,
  assignedBy: string
): Promise<string> => {
  try {
    // Check if assignment already exists
    const existingQuery = query(
      collection(db, 'assignments'),
      where('eventId', '==', eventId),
      where('wishlistId', '==', wishlistId),
      where('assignedTo', '==', assignedTo)
    );
    const existingDocs = await getDocs(existingQuery);
    if (!existingDocs.empty) {
      throw new Error('Assignment already exists');
    }

    const assignmentData = {
      eventId,
      wishlistId,
      assignedTo,
      assignedBy,
      createdAt: serverTimestamp(),
      status: 'pending' as const,
    };

    const docRef = await addDoc(collection(db, 'assignments'), assignmentData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create assignment');
  }
};

export const getAssignment = async (
  assignmentId: string
): Promise<Assignment | null> => {
  try {
    const docRef = doc(db, 'assignments', assignmentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Assignment;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get assignment');
  }
};

export const getAssignmentsForEvent = async (
  eventId: string
): Promise<Assignment[]> => {
  try {
    const q = query(
      collection(db, 'assignments'),
      where('eventId', '==', eventId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Assignment[];
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get assignments');
  }
};

export const getAssignmentsForUser = async (
  userId: string
): Promise<Assignment[]> => {
  try {
    const q = query(
      collection(db, 'assignments'),
      where('assignedTo', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Assignment[];
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get assignments');
  }
};

export const getAssignmentForWishlist = async (
  wishlistId: string
): Promise<Assignment | null> => {
  try {
    const q = query(
      collection(db, 'assignments'),
      where('wishlistId', '==', wishlistId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Assignment;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get assignment');
  }
};

export const updateAssignmentStatus = async (
  assignmentId: string,
  status: 'pending' | 'purchased'
): Promise<void> => {
  try {
    const docRef = doc(db, 'assignments', assignmentId);
    await updateDoc(docRef, { status });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update assignment');
  }
};

export const deleteAssignment = async (
  assignmentId: string
): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'assignments', assignmentId));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete assignment');
  }
};

export const subscribeToAssignmentsForEvent = (
  eventId: string,
  callback: (assignments: Assignment[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'assignments'),
    where('eventId', '==', eventId)
  );

  return onSnapshot(q, (querySnapshot) => {
    const assignments = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Assignment[];
    callback(assignments);
  });
};

