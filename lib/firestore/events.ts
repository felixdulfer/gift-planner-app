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
import { getUserData } from "../auth";
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
    
    // Check if user is already a member
    // We need to check by email, so we'll need to look up the user
    // For now, we'll check invitations and allow re-inviting if user is not a member
    const existingInvitationIndex = eventData.invitations?.findIndex(
      (inv) => inv.email === email
    );

    // If there's an existing invitation, check if user is still a member
    // If user is not a member, we can update the invitation to pending
    if (existingInvitationIndex !== undefined && existingInvitationIndex !== -1) {
      const existingInvitation = eventData.invitations![existingInvitationIndex];
      
      // If invitation is pending, user is already invited
      if (existingInvitation.status === "pending") {
        throw new Error("User already invited");
      }
      
      // If invitation was accepted but user is no longer a member, allow re-inviting
      // Update the existing invitation to pending
      const updatedInvitations = [...(eventData.invitations || [])];
      updatedInvitations[existingInvitationIndex] = {
        email,
        status: "pending" as const,
        invitedBy,
        invitedAt: Timestamp.now(),
      };
      
      await updateDoc(eventRef, {
        invitations: updatedInvitations,
      });
      return;
    }

    // No existing invitation, create new one
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

export const removeMemberFromEvent = async (
  eventId: string,
  memberId: string
): Promise<void> => {
  try {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error("Event not found");
    }

    const eventData = eventSnap.data() as Event;

    // Prevent removing the creator
    if (eventData.createdBy === memberId) {
      throw new Error("Cannot remove the event creator");
    }

    // Check if member exists
    if (!eventData.members?.includes(memberId)) {
      throw new Error("User is not a member of this event");
    }

    // Remove member from members array
    const updatedMembers = eventData.members.filter((id) => id !== memberId);

    // Also clean up accepted invitations for this user
    // Get user's email to find their invitation
    let updatedInvitations = eventData.invitations || [];
    try {
      const userData = await getUserData(memberId);
      if (userData?.email) {
        // Find and remove accepted invitations for this email
        updatedInvitations = updatedInvitations.filter(
          (inv) => !(inv.email === userData.email && inv.status === "accepted")
        );
      }
    } catch (error) {
      // If we can't get user data, continue without cleaning up invitations
      // The inviteUserToEvent function will handle re-inviting anyway
      console.warn("Could not fetch user data to clean up invitations:", error);
    }

    await updateDoc(eventRef, {
      members: updatedMembers,
      invitations: updatedInvitations,
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to remove member");
  }
};
