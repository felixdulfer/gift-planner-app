import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { subscribeToWishlistsForEvent, Wishlist } from '../../../lib/firestore/wishlists';
import { getColors } from '../../../lib/theme';

export default function EventWishlistsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const unsubscribe = subscribeToWishlistsForEvent(id, (updatedWishlists) => {
      setWishlists(updatedWishlists);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const renderWishlist = ({ item }: { item: Wishlist }) => (
    <TouchableOpacity
      style={[styles.wishlistCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/wishlists/${item.id}`)}
    >
      <Text style={[styles.wishlistName, { color: colors.text }]}>{item.name}</Text>
      <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
        {item.items?.length || 0} item{item.items?.length !== 1 ? 's' : ''}
      </Text>
      <Text style={[styles.purchasedCount, { color: colors.success }]}>
        {item.items?.filter((i) => i.purchasedBy).length || 0} purchased
      </Text>
    </TouchableOpacity>
  );

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
          <Text style={[styles.title, { color: colors.text }]}>Wishlists</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push(`/wishlists/create?eventId=${id}`)}
        >
          <Text style={styles.addButtonText}>+ New Wishlist</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={{ color: colors.text }}>Loading wishlists...</Text>
        </View>
      ) : wishlists.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No wishlists yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Create a wishlist to get started!
          </Text>
        </View>
      ) : (
        <FlatList
          data={wishlists}
          renderItem={renderWishlist}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  wishlistCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
  wishlistName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 14,
    marginBottom: 4,
  },
  purchasedCount: {
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
});

