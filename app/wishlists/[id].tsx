import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
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
  updateWishlist,
  updateWishlistItem,
  Wishlist,
  WishlistItem,
} from '../../lib/firestore/wishlists';
import { getColors } from '../../lib/theme';

export default function WishlistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
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
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingWishlistName, setEditingWishlistName] = useState('');

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
      
      // Collapse the item after marking as purchased
      if (expandedItemId === itemId) {
        setExpandedItemId(null);
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

  const handleOpenSettings = () => {
    if (wishlist) {
      setEditingWishlistName(wishlist.name);
      setShowSettingsModal(true);
    }
  };

  const handleCloseSettings = () => {
    setShowSettingsModal(false);
    setEditingWishlistName('');
  };

  const handleUpdateWishlistName = async () => {
    if (!id || !editingWishlistName.trim()) return;

    try {
      await updateWishlist(id, { name: editingWishlistName.trim() });
      setShowSettingsModal(false);
      setEditingWishlistName('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDragEnd = async ({ data }: { data: WishlistItem[] }) => {
    if (!id || !wishlist || !event || !user) return;
    
    const isEventMember = event.members?.includes(user.uid) || false;
    if (!isEventMember) return;

    try {
      await reorderWishlistItems(id, data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleStartEditItem = (item: WishlistItem) => {
    if (!canEdit) return;
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setShowEditDialog(true);
  };

  const handleSaveEditItem = async () => {
    if (!id || !editingItemId || !editingItemName.trim()) return;

    try {
      await updateWishlistItem(id, editingItemId, {
        name: editingItemName.trim(),
      });
      setEditingItemId(null);
      setEditingItemName('');
      setShowEditDialog(false);
      // Wishlist will update automatically via real-time listener
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setEditingItemName('');
    setShowEditDialog(false);
  };

  const handleToggleExpand = (itemId: string) => {
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
      setEditingItemId(null); // Cancel editing if collapsing
      setEditingItemName('');
    } else {
      setExpandedItemId(itemId);
    }
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

  const isEventMember = event?.members?.includes(user?.uid || '') || false;
  const canEdit = isEventMember; // All event members can edit

  // Split items into three categories:
  // 1. Favorite items that are NOT purchased
  // 2. Purchased items (their own category, including favorited purchased items)
  // 3. Regular items (non-favorite, non-purchased)
  const favoriteItems = (wishlist.items || []).filter(
    item => item.isFavorite && !item.purchasedBy
  );
  const purchasedItems = (wishlist.items || []).filter(item => item.purchasedBy);
  const regularItems = (wishlist.items || []).filter(
    item => !item.isFavorite && !item.purchasedBy
  );
  
  // Combine all items for drag operations (maintaining order)
  const itemsForDrag = [
    ...favoriteItems,
    ...purchasedItems,
    ...regularItems,
  ];

  const renderItem = ({ item, drag, isActive, index }: RenderItemParams<WishlistItem> & { index?: number }) => {
    const purchaserData = item.purchasedBy ? userDataMap.get(item.purchasedBy) : null;
    const purchaserName = purchaserData?.displayName || item.purchasedBy || 'Unknown';
    const isExpanded = expandedItemId === item.id;
    
    // Show section headers before the first item of each section
    const showFavoritesHeader = index === 0 && favoriteItems.length > 0;
    const showPurchasedHeader = index === favoriteItems.length && purchasedItems.length > 0;
    const showRegularHeader = index === favoriteItems.length + purchasedItems.length && regularItems.length > 0;
    
    // Show dividers between sections
    const showDividerBeforePurchased = index === favoriteItems.length && 
      favoriteItems.length > 0 && 
      purchasedItems.length > 0;
    const showDividerBeforeRegular = index === favoriteItems.length + purchasedItems.length &&
      (favoriteItems.length > 0 || purchasedItems.length > 0) &&
      regularItems.length > 0;
    
    const cardStyle = [
      styles.itemCard,
      item.purchasedBy && styles.itemCardPurchased,
      item.isFavorite && !item.purchasedBy && styles.itemCardFavorite,
      isActive && styles.itemCardActive,
    ];

    const cardContent = (
      <>
        <View style={styles.itemHeaderRow}>
          {canEdit && (
            <TouchableOpacity
              onPress={() => handleToggleFavorite(item.id, item.isFavorite || false)}
              style={styles.favoriteButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.isFavorite ? "star" : "star-outline"}
                size={24}
                color={item.isFavorite ? "#FFD700" : colors.textTertiary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.itemTitleArea}
            onPress={() => handleToggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
          </TouchableOpacity>
          {item.purchasedBy && !isExpanded && (
            <Text style={styles.purchasedEmoji}>💰</Text>
          )}
          <TouchableOpacity
            onPress={() => handleToggleExpand(item.id)}
            activeOpacity={0.7}
            style={styles.chevronButton}
          >
            {isExpanded ? (
              <Ionicons name="chevron-up" size={20} color={colors.textTertiary} />
            ) : (
              <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
          {canEdit && (
            <TouchableOpacity
              onLongPress={drag}
              disabled={isActive}
              style={styles.dragHandle}
              activeOpacity={0.6}
            >
              <Ionicons name="reorder-three-outline" size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        {isExpanded && (
          <View style={styles.itemExpandedContent}>
            {item.purchasedBy && (
              <View style={styles.purchasedBadge}>
                <Text style={styles.purchasedText}>
                  Purchased by {purchaserName}
                  {item.purchasedAt && (
                    <Text style={styles.purchasedDate}>
                      {' • '}
                      {new Date(item.purchasedAt.seconds * 1000).toLocaleDateString()}
                    </Text>
                  )}
                </Text>
              </View>
            )}
            {item.description && (
              <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>{item.description}</Text>
            )}
            {item.link && (
              <Text style={[styles.itemLink, { color: colors.primary }]} numberOfLines={1}>
                {item.link}
              </Text>
            )}
            {item.price && (
              <Text style={[styles.itemPrice, { color: colors.text }]}>${item.price.toFixed(2)}</Text>
            )}
            {item.purchasedBy ? (
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.unmarkPurchaseButton}
                  onPress={() => handleUnmarkPurchased(item.id)}
                >
                  <Text style={styles.unmarkPurchaseButtonText}>Unmark as Purchased</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.purchaseButton}
                  onPress={() => handleMarkPurchased(item.id)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.purchaseButtonText}>Mark as Purchased</Text>
                </TouchableOpacity>
              </View>
            )}
            {canEdit && (
              <View style={styles.deleteButtonRow}>
                <TouchableOpacity
                  style={styles.deleteItemButton}
                  onPress={() => handleDeleteItem(item.id)}
                >
                  <Ionicons name="trash" size={18} color={colors.error} />
                  <Text style={styles.deleteItemButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            {canEdit && (
              <TouchableOpacity
                style={styles.editTitleButton}
                onPress={() => handleStartEditItem(item)}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={[styles.editTitleButtonText, { color: colors.primary }]}>Edit Title</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </>
    );

    return (
      <>
        {showFavoritesHeader && (
          <View style={styles.sectionHeaderContainer}>
            <Text style={[styles.sectionHeader, { color: colors.text }]}>Favorites</Text>
          </View>
        )}
        {showPurchasedHeader && (
            <View style={styles.sectionHeaderContainer}>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>Purchased</Text>
            </View>
        )}
        {showRegularHeader && (
          <>
            {showDividerBeforeRegular && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            <View style={styles.sectionHeaderContainer}>
            </View>
          </>
        )}
        {item.purchasedBy ? (
          <LinearGradient
            colors={colorScheme === 'dark'
              ? ['#1a2f1a', '#0f1f0f', '#0a0f0a']
              : ['#E8F8F2', '#D4F4E6', '#C0F0DA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={cardStyle}
          >
            <View style={styles.cardContentWrapper}>
              {cardContent}
            </View>
          </LinearGradient>
        ) : item.isFavorite ? (
          <LinearGradient
            colors={colorScheme === 'dark' 
              ? ['#3a2f1f', '#2a1f0f', '#1a0f0f']
              : ['#FFF9E6', '#FFF4CC', '#FFEFB3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={cardStyle}
          >
            <View style={styles.cardContentWrapper}>
              {cardContent}
            </View>
          </LinearGradient>
        ) : (
          <View style={[cardStyle, { backgroundColor: colors.surface }]}>
            {cardContent}
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.wishlistName, { color: colors.text }]}>{wishlist.name}</Text>
        </View>
        {canEdit && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {canEdit && (
        <View style={[styles.addSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
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
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight, color: colors.text }]}
                placeholder="Item name *"
                placeholderTextColor={colors.textTertiary}
                value={itemName}
                onChangeText={setItemName}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight, color: colors.text }]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textTertiary}
                value={itemDescription}
                onChangeText={setItemDescription}
                multiline
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight, color: colors.text }]}
                placeholder="Link (optional)"
                placeholderTextColor={colors.textTertiary}
                value={itemLink}
                onChangeText={setItemLink}
                keyboardType="url"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight, color: colors.text }]}
                placeholder="Price (optional)"
                placeholderTextColor={colors.textTertiary}
                value={itemPrice}
                onChangeText={setItemPrice}
                keyboardType="decimal-pad"
              />
              <View style={styles.addItemActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => {
                    setShowAddItem(false);
                    setItemName('');
                    setItemDescription('');
                    setItemLink('');
                    setItemPrice('');
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
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

      <View style={styles.scrollContainer}>
        <DraggableFlatList
          data={itemsForDrag}
          renderItem={(params) => {
            const index = itemsForDrag.findIndex(i => i.id === params.item.id);
            return renderItem({ ...params, index });
          }}
          keyExtractor={(item) => item.id}
          onDragEnd={handleDragEnd}
          activationDistance={10}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No items yet</Text>
              {canEdit && (
                <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                  Add items to this wishlist
                </Text>
              )}
            </View>
          }
        />
      </View>

      {showEditDialog && (
        <View style={[styles.modal, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Item Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight, color: colors.text }]}
              value={editingItemName}
              onChangeText={setEditingItemName}
              placeholder="Item name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.surfaceSecondary }]}
                onPress={handleCancelEditItem}
              >
                <Text style={[styles.modalCancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveEditItem}
              >
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseSettings}
      >
        <TouchableOpacity
          style={[styles.modal, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
          activeOpacity={1}
          onPress={handleCloseSettings}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Wishlist Settings</Text>
            <Text style={[styles.modalLabel, { color: colors.text }]}>Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight, color: colors.text }]}
              value={editingWishlistName}
              onChangeText={setEditingWishlistName}
              placeholder="Wishlist name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.surfaceSecondary }]}
                onPress={handleCloseSettings}
              >
                <Text style={[styles.modalCancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleUpdateWishlistName}
              >
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalDeleteButton}
              onPress={handleDeleteWishlist}
            >
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.modalDeleteButtonText}>Delete Wishlist</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  scrollContainer: {
    flex: 1,
  },
  sectionHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  section: {
    paddingHorizontal: 0,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: -16,
  },
  divider: {
    height: 1,
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 0,
  },
  list: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listFooter: {
    height: 100,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
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
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsButton: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
    padding: 16,
    borderBottomWidth: 1,
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
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addItemActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
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
  itemCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
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
  itemCardPurchased: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  itemCardFavorite: {
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  itemCardActive: {
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  cardContentWrapper: {
    backgroundColor: 'transparent',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  favoriteButton: {
    marginRight: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitleArea: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  chevronButton: {
    marginLeft: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandle: {
    marginLeft: 12,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemExpandedContent: {
    marginTop: 12,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemHeaderCollapsed: {
    marginBottom: 0,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
    lineHeight: 24,
    textAlignVertical: 'center',
  },
  itemNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  itemNameTouchable: {
    flex: 1,
    marginRight: 8,
  },
  expandIcon: {
    marginLeft: 8,
  },
  editTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  editTitleButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  purchasedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  purchasedDate: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.9,
  },
  purchasedEmoji: {
    fontSize: 20,
    marginRight: 8,
    lineHeight: 24,
    textAlignVertical: 'center',
  },
  itemDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  itemLink: {
    fontSize: 12,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
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
    flexDirection: 'row',
    gap: 8,
  },
  purchaseButtonText: {
    color: '#fff',
    fontWeight: '600',
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deleteButtonRow: {
    marginTop: 8,
  },
  deleteItemButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 16,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDeleteButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modalDeleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

