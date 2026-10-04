import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import { t } from "@/utils/translation";
import CategoryTree from "./CategoryTree";

interface CategorySearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Flat top-level categories, raw API shape (same rows as allCategories) —
   * each carries its own nested cat_active_childs, same as the inline list. */
  categories: any[];
  selectedCategories: (number | string)[];
  onCategoryChange: (categoryIds: (number | string)[], slugs: string[]) => void;
  /** More top-level categories exist on the server than are loaded locally —
   * search here only covers what's loaded, so let the user pull more in
   * without leaving the modal. */
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

const ALPHABET = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

const categoryName = (category: any): string =>
  category?.translations?.name ?? category?.name ?? "";

const groupKeyFor = (name: string): string => {
  const first = name?.trim()?.[0]?.toUpperCase();
  return first && /[A-Z]/.test(first) ? first : "#";
};

// Every node (top-level AND nested) whose own name matches `query`, paired
// with its immediate parent's name for context. Search reaches into
// cat_active_childs so e.g. "Dal" (nested under Dairy & Eggs) is findable —
// the inline tree only ever shows/searches top-level names.
const searchTree = (
  nodes: any[],
  query: string,
  parentName: string | null = null,
): { node: any; parentName: string | null }[] => {
  const q = query.toLowerCase();
  const out: { node: any; parentName: string | null }[] = [];
  nodes.forEach((node) => {
    if (categoryName(node).toLowerCase().includes(q)) {
      out.push({ node, parentName });
    }
    const children = node?.cat_active_childs;
    if (Array.isArray(children) && children.length > 0) {
      out.push(...searchTree(children, query, categoryName(node)));
    }
  });
  return out;
};

// Same tree as the inline Browse Categories list — CategoryTree owns all
// tri-state selection/expand logic (see its own header comment) and every
// instance here shares the SAME live `selectedCategories` state, so a click
// in any letter group (or inline) stays in sync everywhere. `compact` swaps
// CategoryTree's spacious sidebar spacing for tight grid-friendly rows — see
// its own compact prop comment.
//
// No `initialFilter` is passed: that prop exists only to seed selection from
// the URL on first mount, which the inline tree already does once. Passing it
// again here — a differently-scoped CategoryTree instance, since the modal
// splits categories by letter — re-ran that seed effect against a lagging
// `filter.category_id` and stomped real clicks (fixed by dropping it).
//
// Grouping by letter is purely a DISPLAY split for the A-Z rail — each group
// gets its own CategoryTree instance over the same shared selection state, so
// splitting never affects what's selectable together.
const CategorySearchModal = ({
  open,
  onOpenChange,
  categories,
  selectedCategories,
  onCategoryChange,
  onLoadMore,
  hasMore,
  loadingMore,
}: CategorySearchModalProps) => {
  const [query, setQuery] = useState("");

  // Browsing (no query): plain top-level categories, full nesting, grouped by
  // each category's own letter — unchanged behavior.
  //
  // Searching: reach into every level (searchTree) so a nested child like
  // "Dal" is findable, not just top-level names. Each match is grouped by ITS
  // OWN letter (so "Dal" sits under D, not under its parent's letter), shown
  // as its own collapsed row (see the render below — the real node is passed
  // through untouched so CategoryTree's tri-state click still has its actual
  // leaf descendants to work with), and carries its parent's name for context
  // since a matched child alone can be ambiguous.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byLetter: Record<
      string,
      { node: any; parentName: string | null }[]
    > = {};

    if (!q) {
      categories.forEach((category) => {
        const key = groupKeyFor(categoryName(category));
        byLetter[key] ??= [];
        byLetter[key].push({ node: category, parentName: null });
      });
    } else {
      searchTree(categories, q).forEach((match) => {
        const key = groupKeyFor(categoryName(match.node));
        byLetter[key] ??= [];
        byLetter[key].push(match);
      });
    }

    Object.values(byLetter).forEach((list) =>
      list.sort((a, b) => categoryName(a.node).localeCompare(categoryName(b.node))),
    );
    return byLetter;
  }, [categories, query]);

  const availableLetters = new Set(Object.keys(groups));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-full max-h-full w-full max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-lg lg:max-w-4xl"
        title={t("browse_categories") || "Browse Categories"}
      >
        <button
          type="button"
          aria-label={t("close")}
          onClick={() => onOpenChange(false)}
          className="absolute end-3 top-3 z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <RiCloseFill size={20} />
        </button>
        <DialogHeader className="sr-only">
          {t("browse_categories") || "Browse Categories"}
        </DialogHeader>
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 dark:border-zinc-800 p-4 pe-14 sm:flex-row sm:items-start sm:gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchCategory") || t("search") || "Search"}
            className="w-full shrink-0 rounded-md border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:primaryColorBorder sm:w-60"
            autoFocus
          />

          <div className="flex flex-1 flex-wrap content-start gap-x-1 gap-y-1">
            {ALPHABET.map((letter) => {
              const has = availableLetters.has(letter);
              return (
                <a
                  key={letter}
                  href={`#category-group-${letter}`}
                  aria-disabled={!has}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold leading-none sm:h-[18px] sm:w-[18px] ${
                    has
                      ? "textColor hover:primaryBackColor hover:text-white cursor-pointer"
                      : "text-gray-300 dark:text-zinc-700 pointer-events-none"
                  }`}
                >
                  {letter}
                </a>
              );
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4">
          {Object.keys(groups).length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {t("no_data_found")}
            </p>
          ) : (
            ALPHABET.filter((letter) => groups[letter]?.length).map(
              (letter) => (
                <div key={letter} id={`category-group-${letter}`} className="mb-2">
                  <div className="mb-1 text-sm font-bold textColor">
                    {letter}
                  </div>
                  {/* One CategoryTree instance PER ITEM, laid out in a 2-col
                      grid — each cell is fully independent (its own
                      expand/collapse state), so a taller expanded cell never
                      shifts alignment in neighboring cells or columns. This
                      is why the earlier attempt at column-splitting INSIDE a
                      single CategoryTree (width classes on shared TreeNode
                      rows) broke: rows within one tree instance aren't
                      independent grid cells, expand/indent misaligned them
                      across columns. */}
                  <div className="grid grid-cols-2 gap-x-3">
                    {groups[letter].map(({ node, parentName }) => (
                      <div key={node.id} className="mb-2 min-w-0">
                        {parentName && (
                          // Aligned to sit exactly above the child's own name
                          // below (chevron slot w-4 + gap-2 + outer ml-1 =
                          // 28px = ms-7), so it reads as "belongs to this
                          // row" instead of a stray floating label.
                          <div className="ms-7 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                            {parentName}
                          </div>
                        )}
                        <CategoryTree
                          // Real node, own children intact (NOT stripped) —
                          // CategoryTree's tri-state click needs the actual
                          // leaf descendants to select/deselect correctly. It
                          // renders collapsed by default (its own
                          // expandedKeys starts empty), so an expand arrow
                          // still lets the user drill in when the node has
                          // children, without pre-expanding every cell.
                          categories={[node]}
                          selectedCategories={selectedCategories}
                          onCategoryChange={onCategoryChange}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )
          )}
          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="mt-1 px-2.5 py-2 text-sm font-semibold text-[var(--color-primary,#DB3D26)] hover:underline disabled:opacity-50"
            >
              {loadingMore
                ? t("loading") || "Loading..."
                : t("load_more") || "Load More"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategorySearchModal;
