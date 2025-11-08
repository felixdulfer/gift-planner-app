import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export interface Event {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
  eventDate?: Timestamp;
  members: string[];
  invitations: {
    email: string;
    status: "pending" | "accepted" | "rejected";
    invitedBy: string;
    invitedAt: Timestamp;
  }[];
}

export const createEvent = async (
  name: string,
  createdBy: string,
  eventDate?: Date
): Promise<string> => {
  try {
    const eventData = {
      name,
      createdBy,
      createdAt: serverTimestamp(),
      eventDate: eventDate ? Timestamp.fromDate(eventDate) : null,
      members: [createdBy],
      invitations: [],
    };

    const docRef = await addDoc(collection(db, "events"), eventData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || "Failed to create event");
  }
};

export const getEvent = async (eventId: string): Promise<Event | null> => {
  try {
    const docRef = doc(db, "events", eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Event;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || "Failed to get event");
  }
};

export const getEventsForUser = async (userId: string): Promise<Event[]> => {
  try {
    const q = query(
      collection(db, "events"),
      where("members", "array-contains", userId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Event[];
  } catch (error: any) {
    throw new Error(error.message || "Failed to get events");
  }
};

export const updateEvent = async (
  eventId: string,
  updates: Partial<{
    name: string;
    eventDate: Date;
  }>
): Promise<void> => {
  try {
    const docRef = doc(db, "events", eventId);
    const updateData: any = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.eventDate) {
      updateData.eventDate = Timestamp.fromDate(updates.eventDate);
    }

    await updateDoc(docRef, updateData);
  } catch (error: any) {
    throw new Error(error.message || "Failed to update event");
  }
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "events", eventId));
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete event");
  }
};

export const inviteUserToEvent = async (
  eventId: string,
  email: string,
  invitedBy: string
): Promise<void> => {
  try {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error("Event not found");
    }

    const eventData = eventSnap.data() as Event;
    const existingInvitation = eventData.invitations?.find(
      (inv) => inv.email === email
    );

    if (existingInvitation) {
      throw new Error("User already invited");
    }

    const newInvitation = {
      email,
      status: "pending" as const,
      invitedBy,
      invitedAt: serverTimestamp() as Timestamp,
    };

    await updateDoc(eventRef, {
      invitations: [...(eventData.invitations || []), newInvitation],
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to invite user");
  }
};

export const subscribeToEventsForUser = (
  userId: string,
  callback: (events: Event[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(
    collection(db, "events"),
    where("members", "array-contains", userId)
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const events = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];
      callback(events);
    },
    (error) => {
      console.error("Error subscribing to events:", error);
      if (onError) {
        onError(error as Error);
      } else {
        // If no error handler provided, call callback with empty array
        callback([]);
      }
    }
  );
};

export const subscribeToEvent = (
  eventId: string,
  callback: (event: Event | null) => void
): Unsubscribe => {
  const docRef = doc(db, "events", eventId);

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Event);
    } else {
      callback(null);
    }
  });
};
