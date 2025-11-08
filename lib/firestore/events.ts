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
      invitedAt: Timestamp.now(),
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

export interface EventWithInvitation extends Event {
  invitationIndex: number;
}

export const getEventsWithPendingInvitations = async (
  email: string
): Promise<EventWithInvitation[]> => {
  try {
    // Get all events (we'll filter client-side since Firestore doesn't support
    // querying nested array fields directly)
    const querySnapshot = await getDocs(collection(db, "events"));
    
    const eventsWithInvitations: EventWithInvitation[] = [];
    
    querySnapshot.docs.forEach((doc) => {
      const eventData = { id: doc.id, ...doc.data() } as Event;
      
      if (eventData.invitations) {
        const invitationIndex = eventData.invitations.findIndex(
          (inv) => inv.email === email && inv.status === "pending"
        );
        
        if (invitationIndex !== -1) {
          eventsWithInvitations.push({
            ...eventData,
            invitationIndex,
          });
        }
      }
    });
    
    return eventsWithInvitations;
  } catch (error: any) {
    throw new Error(error.message || "Failed to get events with invitations");
  }
};

export const subscribeToEventsWithPendingInvitations = (
  email: string,
  callback: (events: EventWithInvitation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  // Subscribe to all events and filter client-side
  return onSnapshot(
    collection(db, "events"),
    (querySnapshot) => {
      const eventsWithInvitations: EventWithInvitation[] = [];
      
      querySnapshot.docs.forEach((doc) => {
        const eventData = { id: doc.id, ...doc.data() } as Event;
        
        if (eventData.invitations) {
          const invitationIndex = eventData.invitations.findIndex(
            (inv) => inv.email === email && inv.status === "pending"
          );
          
          if (invitationIndex !== -1) {
            eventsWithInvitations.push({
              ...eventData,
              invitationIndex,
            });
          }
        }
      });
      
      callback(eventsWithInvitations);
    },
    (error) => {
      console.error("Error subscribing to events with invitations:", error);
      if (onError) {
        onError(error as Error);
      } else {
        callback([]);
      }
    }
  );
};

export const acceptInvitation = async (
  eventId: string,
  userId: string,
  email: string
): Promise<void> => {
  try {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error("Event not found");
    }

    const eventData = eventSnap.data() as Event;
    
    // Find the invitation
    const invitationIndex = eventData.invitations?.findIndex(
      (inv) => inv.email === email && inv.status === "pending"
    );

    if (invitationIndex === undefined || invitationIndex === -1) {
      throw new Error("Invitation not found or already processed");
    }

    // Check if user is already a member
    if (eventData.members?.includes(userId)) {
      throw new Error("User is already a member of this event");
    }

    // Update invitation status and add user to members
    const updatedInvitations = [...(eventData.invitations || [])];
    updatedInvitations[invitationIndex] = {
      ...updatedInvitations[invitationIndex],
      status: "accepted" as const,
    };

    const updatedMembers = [...(eventData.members || []), userId];

    console.log("Accepting invitation:", { eventId, userId, email });
    await updateDoc(eventRef, {
      invitations: updatedInvitations,
      members: updatedMembers,
    });
    console.log("Invitation accepted successfully");
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    // Provide more specific error messages
    if (error.code === "permission-denied") {
      throw new Error("Permission denied. Please check Firestore security rules.");
    }
    throw new Error(error.message || "Failed to accept invitation");
  }
};

export const rejectInvitation = async (
  eventId: string,
  email: string
): Promise<void> => {
  try {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error("Event not found");
    }

    const eventData = eventSnap.data() as Event;
    
    // Find the invitation
    const invitationIndex = eventData.invitations?.findIndex(
      (inv) => inv.email === email && inv.status === "pending"
    );

    if (invitationIndex === undefined || invitationIndex === -1) {
      throw new Error("Invitation not found or already processed");
    }

    // Update invitation status
    const updatedInvitations = [...(eventData.invitations || [])];
    updatedInvitations[invitationIndex] = {
      ...updatedInvitations[invitationIndex],
      status: "rejected" as const,
    };

    await updateDoc(eventRef, {
      invitations: updatedInvitations,
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to reject invitation");
  }
};
