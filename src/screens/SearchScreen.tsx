/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/SearchScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSearchStore } from '../stores/useSearchStore';
import { MediaItem } from '../types/media';
import { SafeContainer } from '../components/layout';
import { SearchBar } from '../components/ui/SearchBar';
import { MediaCard } from '../components/media/MediaCard';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import {
  RATING_OPTIONS,
  SORT_OPTIONS,
  RAIL_LETTERS,
  activeLetters,
  hasActiveFilters,
  type MediaFilters,
  type SortOption,
  type SortOrder,
} from './search/searchScreenHelpers';

type SearchNavigationProp = NativeStackNavigationProp<any>;

const SearchScreen: React.FC = () => {
  const navigation = useNavigation<SearchNavigationProp>();

  const query = useSearchStore((s) => s.query);
  const filters = useSearchStore((s) => s.filters);
  const results = useSearchStore((s) => s.results);
  const total = useSearchStore((s) => s.total);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const letterIndex = useSearchStore((s) => s.letterIndex);

  const setQuery = useSearchStore((s) => s.setQuery);
  const setFilters = useSearchStore((s) => s.setFilters);
  const runSearch = useSearchStore((s) => s.search);
  const loadLetterIndex = useSearchStore((s) => s.loadLetterIndex);
  const jumpToLetter = useSearchStore((s) => s.jumpToLetter);
  const resetStore = useSearchStore((s) => s.reset);

  const [hasSearched, setHasSearched] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Draft filter state for the modal — committed on "Apply".
  const [draft, setDraft] = useState<MediaFilters>(filters);
  const [genreText, setGenreText] = useState('');
  const [yearFromText, setYearFromText] = useState('');
  const [yearToText, setYearToText] = useState('');

  // Rail visibility: only in BROWSE mode (no text query) AND when results are
  // name-sorted (server letter-index is name-asc; with a text query the server
  // ignores topLevel and the rail's offsets no longer line up).
  const isTextSearch = query.trim() !== '';
  const isNameSorted = filters.sort === undefined || filters.sort === 'name';
  const showRail = !isTextSearch && isNameSorted && results.length > 0;
  const enabledLetters = useMemo(
    () => activeLetters(letterIndex),
    [letterIndex]
  );

  const performSearch = useCallback(async () => {
    setHasSearched(true);
    await runSearch(true);
    // Refresh the rail index alongside browse-mode results.
    if (query.trim() === '') {
      await loadLetterIndex();
    }
  }, [runSearch, loadLetterIndex, query]);

  const handleChangeText = (text: string) => {
    setQuery(text);
  };

  const handleClear = () => {
    setQuery('');
    setHasSearched(false);
    resetStore();
  };

  const handleMediaPress = (item: MediaItem) => {
    navigation.navigate('MediaDetail', { itemId: item.id });
  };

  const handleLoadMore = () => {
    if (!loading && results.length < total) {
      runSearch(false);
    }
  };

  // ----- Filter modal -----
  const openFilters = () => {
    setDraft(filters);
    setGenreText((filters.genres ?? []).join(', '));
    setYearFromText(filters.yearFrom !== undefined ? String(filters.yearFrom) : '');
    setYearToText(filters.yearTo !== undefined ? String(filters.yearTo) : '');
    setFiltersOpen(true);
  };

  const toggleRating = (rating: string) => {
    setDraft((d) => {
      const current = d.ratings ?? [];
      const next = current.includes(rating)
        ? current.filter((r) => r !== rating)
        : [...current, rating];
      return { ...d, ratings: next.length > 0 ? next : undefined };
    });
  };

  const setSort = (sort: SortOption) => {
    setDraft((d) => ({ ...d, sort: d.sort === sort ? undefined : sort }));
  };

  const toggleOrder = () => {
    setDraft((d) => {
      const next: SortOrder = d.order === 'desc' ? 'asc' : 'desc';
      return { ...d, order: next };
    });
  };

  const applyFilters = async () => {
    const genres = genreText
      .split(',')
      .map((g) => g.trim())
      .filter((g) => g !== '');
    const yearFrom = parseInt(yearFromText, 10);
    const yearTo = parseInt(yearToText, 10);
    const next: MediaFilters = {
      ...draft,
      genres: genres.length > 0 ? genres : undefined,
      yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
      yearTo: Number.isFinite(yearTo) ? yearTo : undefined,
    };
    setFilters(next);
    setFiltersOpen(false);
    setHasSearched(true);
    // Re-run with the new filters (browse mode also refreshes the rail).
    await runSearch(true);
    if (query.trim() === '') {
      await loadLetterIndex();
    }
  };

  const clearFilters = () => {
    setDraft({});
    setGenreText('');
    setYearFromText('');
    setYearToText('');
  };

  const filtersActive = hasActiveFilters(filters);

  const renderItem = ({ item }: { item: MediaItem }) => (
    <MediaCard item={item} onPress={() => handleMediaPress(item)} />
  );

  const renderRail = () => (
    <View style={styles.rail}>
      {RAIL_LETTERS.map((letter) => {
        const enabled = enabledLetters.has(letter);
        return (
          <TouchableOpacity
            key={letter}
            disabled={!enabled}
            onPress={() => jumpToLetter(letter)}
            style={styles.railButton}
          >
            <Text
              style={[styles.railText, !enabled && styles.railTextDisabled]}
            >
              {letter}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderResults = () => {
    if (loading && results.length === 0) {
      return <LoadingSpinner fullScreen />;
    }
    if (error && results.length === 0) {
      return <ErrorView message={error} onRetry={() => runSearch(true)} />;
    }
    if (hasSearched && results.length === 0) {
      return (
        <EmptyState
          icon="🔍"
          title="No Results"
          message={
            isTextSearch
              ? `No results found for "${query.trim()}"`
              : 'No results match these filters'
          }
        />
      );
    }
    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Search for movies, TV shows, and more — or tap Filters to browse.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.resultsRow}>
        <FlatList
          style={styles.flex}
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && results.length > 0 ? (
              <LoadingSpinner size="small" />
            ) : null
          }
        />
        {showRail && renderRail()}
      </View>
    );
  };

  return (
    <SafeContainer edges={['top']}>
      <SearchBar
        value={query}
        onChangeText={handleChangeText}
        placeholder="Search movies, shows..."
        onSubmit={performSearch}
        onClear={handleClear}
      />

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.filterButton, filtersActive && styles.filterButtonActive]}
          onPress={openFilters}
        >
          <Text style={styles.filterButtonText}>
            {filtersActive ? '⚙ Filters •' : '⚙ Filters'}
          </Text>
        </TouchableOpacity>
        {total > 0 && (
          <Text style={styles.resultCount}>{total} results</Text>
        )}
      </View>

      {renderResults()}

      <Modal
        visible={filtersOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.modalClear}>Clear</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Genres (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={genreText}
                onChangeText={setGenreText}
                placeholder="Action, Drama"
                placeholderTextColor="#888"
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Rating</Text>
              <View style={styles.chipRow}>
                {RATING_OPTIONS.map((rating) => {
                  const active = (draft.ratings ?? []).includes(rating);
                  return (
                    <TouchableOpacity
                      key={rating}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleRating(rating)}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {rating}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Year range</Text>
              <View style={styles.yearRow}>
                <TextInput
                  style={[styles.input, styles.yearInput]}
                  value={yearFromText}
                  onChangeText={setYearFromText}
                  placeholder="From"
                  placeholderTextColor="#888"
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, styles.yearInput]}
                  value={yearToText}
                  onChangeText={setYearToText}
                  placeholder="To"
                  placeholderTextColor="#888"
                  keyboardType="number-pad"
                />
              </View>

              <Text style={styles.fieldLabel}>Sort by</Text>
              <View style={styles.chipRow}>
                {SORT_OPTIONS.map((sort) => {
                  const active = draft.sort === sort;
                  return (
                    <TouchableOpacity
                      key={sort}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSort(sort)}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {sort}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Order</Text>
              <TouchableOpacity style={styles.orderToggle} onPress={toggleOrder}>
                <Text style={styles.orderToggleText}>
                  {draft.order === 'desc' ? '↓ Descending' : '↑ Ascending'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setFiltersOpen(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  filterButton: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#0066cc',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultCount: {
    color: '#888',
    fontSize: 13,
  },
  resultsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
  },
  // A–Z rail
  rail: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  railButton: {
    paddingVertical: 1,
  },
  railText: {
    color: '#0066cc',
    fontSize: 11,
    fontWeight: '700',
  },
  railTextDisabled: {
    color: '#444',
  },
  // Filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalClear: {
    color: '#0066cc',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  fieldLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#0066cc',
  },
  chipText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yearInput: {
    flex: 1,
    marginRight: 8,
  },
  orderToggle: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  orderToggleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2d2d44',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default SearchScreen;
