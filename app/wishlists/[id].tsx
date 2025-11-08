import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getUserData, UserData } from '../../lib/auth';
import {
  getAssignmentForWishlist,
  updateAssignmentStatus,
} from '../../lib/firestore/assignments';
import { Event, subscribeToEvent } from '../../lib/firestore/events';
import {
  addItemToWishlist,
  deleteWishlist,
  deleteWishlistItem,
  markItemAsPurchased,
  reorderWishlistItems,
  subscribeToWishlist,
  unmarkItemAsPurchased,
  updateWishlistItem,
  Wishlist,
  WishlistItem,
} from '../../lib/firestore/wishlists';

export default function WishlistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemLink, setItemLink] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [userDataMap, setUserDataMap] = useState<Map<string, UserData>>(new Map());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');

  const loadUserData = useCallback(async (userIds: string[]) => {
    // Get current map to check what we already have
    setUserDataMap((currentMap) => {
      const userIdsToFetch = userIds.filter(userId => !currentMap.has(userId));
      
      if (userIdsToFetch.length === 0) {
        return currentMap; // Already have all user data
      }
      
      // Fetch user data for users we don't have yet
      Promise.all(
        userIdsToFetch.map(async (userId) => {
          try {
            const userData = await getUserData(userId);
            return { userId, userData };
          } catch (error) {
            console.error(`Error loading user ${userId}:`, error);
            return null;
          }
        })
      ).then((results) => {
        setUserDataMap((prevMap) => {
          const updatedMap = new Map(prevMap);
          results.forEach((result) => {
            if (result && result.userData) {
              updatedMap.set(result.userId, result.userData);
            }
          });
          return updatedMap;
        });
      });
      
      return currentMap;
    });
  }, []);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    let unsubscribeEvent: (() => void) | null = null;
    
    const unsubscribeWishlist = subscribeToWishlist(id, (wishlistData) => {
      setWishlist(wishlistData);
      
      // Load user data for purchasers
      if (wishlistData?.items) {
        const purchaserIds = wishlistData.items
          .map(item => item.purchasedBy)
          .filter((id): id is string => !!id);
        
        if (purchaserIds.length > 0) {
          loadUserData(purchaserIds);
        }
      }
      
      // Fetch event data when wishlist is loaded
      if (wishlistData?.eventId) {
        // Clean up previous event subscription if it exists
        if (unsubscribeEvent) {
          unsubscribeEvent();
        }
        
        unsubscribeEvent = subscribeToEvent(wishlistData.eventId, (eventData) => {
          setEvent(eventData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeWishlist();
      if (unsubscribeEvent) {
        unsubscribeEvent();
      }
    };
  }, [id, loadUserData]);

  const handleAddItem = async () => {
    if (!itemName.trim() || !id) return;

    try {
      await addItemToWishlist(id, {
        name: itemName.trim(),
        description: itemDescription.trim() || undefined,
        link: itemLink.trim() || undefined,
        price: itemPrice ? parseFloat(itemPrice) : undefined,
      });
      setItemName('');
      setItemDescription('');
      setItemLink('');
      setItemPrice('');
      setShowAddItem(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleMarkPurchased = async (itemId: string) => {
    if (!id || !user) return;

    try {
      await markItemAsPurchased(id, itemId, user.uid);
      
      // Update assignment status if this wishlist has an assignment
      try {
        const assignment = await getAssignmentForWishlist(id);
        if (assignment && assignment.status === 'pending') {
          await updateAssignmentStatus(assignment.id, 'purchased');
        }
      } catch (assignmentError) {
        // Assignment update is optional, don't fail the whole operation
        console.error('Error updating assignment:', assignmentError);
      }
      
      // Wishlist will update automatically via real-time listener
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUnmarkPurchased = async (itemId: string) => {
    if (!id || !user) return;

    try {
      await unmarkItemAsPurchased(id, itemId);
      
      // Update assignment status back to pending if this wishlist has an assignment
      try {
        const assignment = await getAssignmentForWishlist(id);
        if (assignment && assignment.status === 'purchased') {
          await updateAssignmentStatus(assignment.id, 'pending');
        }
      } catch (assignmentError) {
        // Assignment update is optional, don't fail the whole operation
        console.error('Error updating assignment:', assignmentError);
      }
      
      // Wishlist will update automatically via real-time listener
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;

    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWishlistItem(id, itemId);
              // Wishlist will update automatically via real-time listener
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteWishlist = async () => {
    if (!id) return;

    Alert.alert(
      'Delete Wishlist',
      'Are you sure you want to delete this wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWishlist(id);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDragEnd = async ({ data }: { data: WishlistItem[] }) => {
    if (!id || !wishlist || !event || !user) return;
    
    const isEventMember = event.members?.includes(user.uid) || false;
    if (!isEventMember) return;

    try {
      await reorderWishlistItems(id, data);
      // Wishlist will update automatically via real-time listener
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleStartEditItem = (item: WishlistItem) => {
    if (!canEdit) return;
    setEditingItemId(item.id);
    setEditingItemName(item.name);
  };

  const handleSaveEditItem = async () => {
    if (!id || !editingItemId || !editingItemName.trim()) return;

    try {
      await updateWishlistItem(id, editingItemId, {
        name: editingItemName.trim(),
      });
      setEditingItemId(null);
      setEditingItemName('');
      // Wishlist will update automatically via real-time listener
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setEditingItemName('');
  };

  const handleToggleFavorite = async (itemId: string, currentFavorite: boolean) => {
    if (!id || !wishlist || !event || !user) return;
    
    const isEventMember = event.members?.includes(user.uid) || false;
    if (!isEventMember) return;

    try {
      await updateWishlistItem(id, itemId, {
        isFavorite: !currentFavorite,
      });
      // Wishlist will update automatically via real-time listener
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading wishlist...</Text>
      </View>
    );
  }

  if (!wishlist) {
    return (
      <View style={styles.center}>
        <Text>Wishlist not found</Text>
      </View>
    );
  }

  const isCreator = wishlist.createdBy === user?.uid;
  const isEventMember = event?.members?.includes(user?.uid || '') || false;
  const canEdit = isEventMember; // All event members can edit

  // Sort items: favorites first, then by current order
  const sortedItems = [...(wishlist.items || [])].sort((a, b) => {
    const aFavorite = a.isFavorite ? 1 : 0;
    const bFavorite = b.isFavorite ? 1 : 0;
    return bFavorite - aFavorite; // Favorites first
  });

  const renderItem = ({ item, drag, isActive }: RenderItemParams<WishlistItem>) => {
    const purchaserData = item.purchasedBy ? userDataMap.get(item.purchasedBy) : null;
    const purchaserName = purchaserData?.displayName || item.purchasedBy || 'Unknown';
    
    return (
      <ScaleDecorator>
        <View
          style={[
            styles.itemCard,
            isActive && styles.itemCardActive,
          ]}
        >
          {canEdit && (
            <TouchableOpacity
              onPress={() => handleToggleFavorite(item.id, item.isFavorite || false)}
              style={styles.favoriteButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.isFavorite ? "star" : "star-outline"}
                size={24}
                color={item.isFavorite ? "#FFD700" : "#999"}
              />
            </TouchableOpacity>
          )}
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              {editingItemId === item.id ? (
                <View style={styles.editNameContainer}>
                  <TextInput
                    style={styles.editNameInput}
                    value={editingItemName}
                    onChangeText={setEditingItemName}
                    autoFocus
                    onSubmitEditing={handleSaveEditItem}
                    onBlur={handleSaveEditItem}
                  />
                  <TouchableOpacity
                    style={styles.editNameButton}
                    onPress={handleSaveEditItem}
                  >
                    <Ionicons name="checkmark" size={20} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editNameButton}
                    onPress={handleCancelEditItem}
                  >
                    <Ionicons name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleStartEditItem(item)}
                  disabled={!canEdit}
                  style={styles.itemNameTouchable}
                >
                  <Text style={styles.itemName}>{item.name}</Text>
                </TouchableOpacity>
              )}
              {item.purchasedBy && (
                <View style={styles.purchasedBadge}>
                  <Text style={styles.purchasedText}>
                    Purchased by {purchaserName}
                  </Text>
                </View>
              )}
            </View>
            {item.description && (
              <Text style={styles.itemDescription}>{item.description}</Text>
            )}
            {item.link && (
              <Text style={styles.itemLink} numberOfLines={1}>
                {item.link}
              </Text>
            )}
            {item.price && (
              <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            )}
            {item.purchasedBy ? (
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.unmarkPurchaseButton}
                  onPress={() => handleUnmarkPurchased(item.id)}
                >
                  <Text style={styles.unmarkPurchaseButtonText}>Unmark as Purchased</Text>
                </TouchableOpacity>
                {canEdit && (
                  <TouchableOpacity
                    style={styles.deleteItemButton}
                    onPress={() => handleDeleteItem(item.id)}
                  >
                    <Ionicons name="trash" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.itemActions}>
                {item.isFavorite && (
                  <TouchableOpacity
                    style={styles.purchaseButton}
                    onPress={() => handleMarkPurchased(item.id)}
                  >
                    <Text style={styles.purchaseButtonText}>Mark as Purchased</Text>
                  </TouchableOpacity>
                )}
                {canEdit && (
                  <TouchableOpacity
                    style={styles.deleteItemButton}
                    onPress={() => handleDeleteItem(item.id)}
                  >
                    <Ionicons name="trash" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          {canEdit && (
            <TouchableOpacity
              onLongPress={drag}
              disabled={isActive}
              style={styles.dragHandle}
              activeOpacity={0.6}
            >
              <Ionicons name="reorder-three-outline" size={24} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.wishlistName}>{wishlist.name}</Text>
        </View>
        {isCreator && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteWishlist}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {canEdit && (
        <View style={styles.addSection}>
          {!showAddItem ? (
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowAddItem(true)}
            >
              <Text style={styles.addItemButtonText}>+ Add Item</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addItemForm}>
              <TextInput
                style={styles.input}
                placeholder="Item name *"
                value={itemName}
                onChangeText={setItemName}
              />
              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                value={itemDescription}
                onChangeText={setItemDescription}
                multiline
              />
              <TextInput
                style={styles.input}
                placeholder="Link (optional)"
                value={itemLink}
                onChangeText={setItemLink}
                keyboardType="url"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Price (optional)"
                value={itemPrice}
                onChangeText={setItemPrice}
                keyboardType="decimal-pad"
              />
              <View style={styles.addItemActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddItem(false);
                    setItemName('');
                    setItemDescription('');
                    setItemLink('');
                    setItemPrice('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleAddItem}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      <DraggableFlatList
        data={sortedItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onDragEnd={handleDragEnd}
        activationDistance={10}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items yet</Text>
            {canEdit && (
              <Text style={styles.emptySubtext}>
                Add items to this wishlist
              </Text>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  wishlistName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addItemButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addItemButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addItemForm: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  addItemActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  itemCardActive: {
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  dragHandle: {
    marginLeft: 12,
    paddingTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  favoriteButton: {
    marginRight: 12,
    paddingTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  itemNameTouchable: {
    flex: 1,
    marginRight: 8,
  },
  editNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  editNameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#fff',
  },
  editNameButton: {
    marginLeft: 8,
    padding: 4,
  },
  purchasedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    maxWidth: '70%',
  },
  purchasedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemLink: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  unmarkPurchaseButton: {
    flex: 1,
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmarkPurchaseButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteItemButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    marginLeft: 'auto',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});

