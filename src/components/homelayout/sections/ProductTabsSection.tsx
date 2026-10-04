"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { IoArrowForward } from "react-icons/io5";
import { AnimatePresence, motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import HomeVerticleProductCard from "../../productcards/HomeVerticleProductCard";
import HomeListViewCard from "../../productcards/HomeListViewCard";
import useDir from "@/hooks/useDir";
import useIsRtl from "@/hooks/useIsRtl";
import useT from "@/hooks/useT";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
import useNavClick from "@/hooks/useNavClick";
import * as api from "@/api/apiRoutes";
import { findNodeById } from "@/utils/categorySlugResolver";
import {
  clearAllFilter,
  setBlockSource,
  setListingSource,
  setCategorySlug,
  setCategoryBreadcrumb,
} from "@/redux/slices/productFilterSlice";
import {
  toCssAspectRatio,
  pickDeviceNumber,
  pickDeviceImage,
} from "@/utils/helperFunction";

// Folder-tab silhouette as a SINGLE path: bottom-left flare, up the left side,
// across the rounded top, down the right side, bottom-right flare. Drawing it in
// one stroke is what keeps the curves continuous — the previous version pieced it
// together from two background divs, a bordered div and two corner svgs, and the
// seams between those pieces were the visible break.
//
// The svg is positioned to overflow FLARE px on each side (that's where the
// outward curves live) and sized in real pixels from the measured tab, so
// nothing is scaled/skewed.
const FLARE = 8;
const TOP_RADIUS = 12;
// The tab group and the mask that cuts the baseline under it must travel
// together, or the line would briefly reappear through the moving tab.
const TAB_SLIDE_TRANSITION = {
  type: "spring" as const,
  stiffness: 420,
  damping: 38,
  mass: 0.7,
};

const FolderTabOutline = ({
  tabLeft,
  width,
  height,
  stripWidth,
  fill,
  stroke,
  gradientFrom,
  gradientTo,
  backgroundImageUrl,
}: {
  /** Active tab's offsetLeft within the strip. */
  tabLeft: number;
  width: number;
  height: number;
  /** Full scroll width of the strip — the baseline spans all of it. */
  stripWidth: number;
  fill?: string;
  stroke: string;
  gradientFrom?: string;
  gradientTo?: string;
  backgroundImageUrl?: string;
}) => {
  if (!width || !height) return null;
  // The svg covers the WHOLE strip and never moves; only the tab group inside
  // it slides. That's what keeps the transition smooth — animating the svg's
  // own position meant its baseline runway shifted with it, so the line
  // visibly dragged along instead of staying put under the tabs.
  const w = Math.max(stripWidth, tabLeft + width) + FLARE;
  const h = height;
  const sw = 1.5;
  // Inset by half the stroke so it sits fully inside the box rather than being
  // clipped in half along the top and sides.
  const half = sw / 2;
  const baseline = h - half;
  const radius = Math.min(TOP_RADIUS, width / 2, Math.max(h - FLARE - half, 0));
  const uid = `${Math.round(width)}x${Math.round(h)}`;
  const patternId = `folderTabFill-${uid}`;
  const gradientId = `folderTabGradient-${uid}`;
  const hasImage = !!backgroundImageUrl;
  const hasGradient = !hasImage && !!gradientFrom;
  const pathFill = (() => {
    if (hasImage) return `url(#${patternId})`;
    if (hasGradient) return `url(#${gradientId})`;
    return fill || "none";
  })();

  // Tab silhouette drawn at x=0 and positioned by the group's transform, so
  // the geometry is identical every frame and only a translate animates.
  const tabOutline = [
    `M ${-FLARE} ${baseline}`,
    `A ${FLARE} ${FLARE} 0 0 0 0 ${baseline - FLARE}`,
    `V ${radius + half}`,
    `A ${radius} ${radius} 0 0 1 ${radius} ${half}`,
    `H ${width - radius}`,
    `A ${radius} ${radius} 0 0 1 ${width} ${radius + half}`,
    `V ${baseline - FLARE}`,
    `A ${FLARE} ${FLARE} 0 0 0 ${width + FLARE} ${baseline}`,
  ].join(" ");
  const tabFillD = `${tabOutline} Z`;

  return (
    <svg
      className="absolute bottom-0 left-0 pointer-events-none"
      style={{ width: w, height: h, overflow: "visible" }}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <defs>
        {hasImage && (
          // Sized to the TAB, not the strip: the pattern lives in the sliding
          // group's coordinate space, so anchoring it to the strip would drag
          // the artwork across the tab as it moves.
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            x={-FLARE}
            width={width + FLARE * 2}
            height={h}
          >
            <image
              href={backgroundImageUrl}
              width={width + FLARE * 2}
              height={h}
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        )}
        {hasGradient && (
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo || "transparent"} />
          </linearGradient>
        )}
      </defs>

      {/* Baseline + tab as ONE sliding group: the line is drawn as two runs
          that stop at the flares (`-w` back to the left edge, `+w` out to the
          right), so it reads as one continuous line running into the tab
          without needing a mask — an svg <mask> whose contents are animated by
          framer rendered as a fully-opaque cover here, which erased the
          baseline entirely. Because the runs are part of the same group, they
          travel with the tab and always meet its feet exactly. */}
      <motion.g
        initial={false}
        animate={{ x: tabLeft }}
        transition={TAB_SLIDE_TRANSITION}
      >
        {pathFill !== "none" && (
          <path d={tabFillD} fill={pathFill} stroke="none" />
        )}
        <path
          d={`M ${-FLARE} ${baseline} H ${-w}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
        <path
          d={`M ${width + FLARE} ${baseline} H ${w}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
        <path
          d={tabOutline}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
};

interface ProductTabsSectionProps {
  block: any;
  borderRadius?: string | number;
  device?: string;
}

const ProductTabsSection = ({
  block,
  borderRadius,
  device = "web",
}: ProductTabsSectionProps) => {
  const dir = useDir();
  const rtl = useIsRtl();
  const tr = useT();
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const dispatch = useDispatch();
  const router = useRouter();
  const { run: runNavClick } = useNavClick();
  // Primitives, not the City object: the category lookup in handleSeeAll needs
  // coords, but selecting the slice object would re-render every tab on any
  // unrelated City change.
  const cityLat = useSelector((state: any) => state.City.city?.latitude);
  const cityLng = useSelector((state: any) => state.City.city?.longitude);
  const config = block?.config || {};
  // Memoized: the `[]` fallback below is a fresh array on every render, which
  // would otherwise re-run the ResizeObserver effect further down (it watches
  // `tabs` by reference) on every render regardless of whether the tabs
  // actually changed.
  const tabs = useMemo(
    () => (Array.isArray(block?.tabs) ? block.tabs : []),
    [block?.tabs],
  );

  // `direction` rides along with the index so the slide animation can travel the
  // way the user actually moved (forward tab enters from the end edge, back tab
  // from the start edge) instead of always the same way.
  const [{ activeIndex, direction }, setActive] = useState({
    activeIndex: 0,
    direction: 1,
  });
  const selectTab = (index: number) =>
    setActive((prev) =>
      prev.activeIndex === index
        ? prev
        : { activeIndex: index, direction: index > prev.activeIndex ? 1 : -1 },
    );
  // Clamped rather than stored raw: the payload can shrink on a refetch (fewer
  // tabs than before), which would otherwise leave the index pointing past the end.
  const activeTab = tabs[Math.min(activeIndex, Math.max(tabs.length - 1, 0))];

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [activeTabRect, setActiveTabRect] = useState<{
    left: number;
    width: number;
    height: number;
    stripWidth: number;
  } | null>(null);

  // The folder-tab outline is drawn as a pixel-exact svg, so it needs the tab's
  // real box plus the strip's full scroll width (the baseline runs the whole
  // strip, not just the visible part). A ResizeObserver — not just an effect on
  // activeIndex — keeps it correct when the row reflows: a font swap or a label
  // wrapping to two lines changes the height under it, which would otherwise
  // leave the curve floating above or below the baseline.
  useEffect(() => {
    const activeEl = tabRefs.current[activeIndex];
    if (!activeEl) return;
    const measure = () =>
      setActiveTabRect({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        stripWidth: stripRef.current?.scrollWidth ?? activeEl.offsetWidth,
      });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(activeEl);
    if (stripRef.current) observer.observe(stripRef.current);
    return () => observer.disconnect();
  }, [activeIndex, tabs]);

  // Same three layouts as ProductSliderSection: a horizontal swipe track, a
  // grid, or a stack of full-width list rows. "grid_<n>" is the legacy spelling
  // that carries its column count in the name.
  const layout = String(block?.layout || "horizontal");
  const isGrid = layout.startsWith("grid");
  const isList = layout === "list";
  const gap = pickDeviceNumber(config?.product_grid_gap, device, 0);
  const gridCols =
    pickDeviceNumber(config?.grid_columns, device, 0) ||
    parseInt(layout.split("_")[1], 10) ||
    0;

  // Mirrors ProductSliderSection's variant vocabulary so a block authored there
  // and switched to tabs keeps the same adornment rules.
  const variant = config?.variant;
  const isDefault = !variant || variant === "default";
  const isColorVariant = variant === "with_color";

  const showTitle = isDefault ? false : !!config?.section_title;
  const title = showTitle ? config?.section_title : null;

  const bgImageUrl =
    config?.background_image_url &&
    typeof config.background_image_url === "object"
      ? pickDeviceImage(config.background_image_url, device)
      : config?.background_image_url;
  // "with_color" paints a flat colour instead of artwork, so it opts out of the
  // image even when the admin left a URL behind from a previous variant.
  const hasBg =
    !isDefault && variant !== "with_title" && variant !== "with_color"
      ? !!bgImageUrl
      : false;

  const backgroundColor = isColorVariant
    ? config?.background_color || null
    : null;
  const textColor = isDefault ? null : config?.text_color || null;

  const cardRadius = config?.product_card_radius;
  const blockPadding = Number.isFinite(Number(config?.block_padding))
    ? Number(config.block_padding)
    : null;
  const hasPadding = blockPadding != null;
  // Same rule as ProductSliderSection: the horizontal track runs past the block
  // edge, so it needs a base 10px gutter even when the backend sent no
  // block_padding — without it the first card sits flush against the edge while
  // the tab strip and title above it do not, and the two rows visibly misalign.
  // Grid and list lay their cards out inside the block already, so they take
  // block_padding alone (the extra gutter only narrowed them).
  const inlinePadding =
    isGrid || isList
      ? hasPadding
        ? blockPadding
        : 0
      : hasPadding
        ? blockPadding
        : 10;
  const inlinePaddingStyle = {
    paddingLeft: inlinePadding,
    paddingRight: inlinePadding,
  };
  const blockPaddingStyle = {
    paddingTop: hasPadding ? blockPadding : 0,
    paddingBottom: hasPadding ? blockPadding : 0,
  };

  // Same zero-width float trick as ProductSliderSection: percentage padding
  // resolves against width, giving the artwork its shape as a MINIMUM height
  // while the panel still grows to fit the tabs + grid.
  const bgAspectPadding = (() => {
    if (!hasBg) return undefined;
    const imageAspectRaw =
      config?.image_aspect && typeof config.image_aspect === "object"
        ? pickDeviceImage(config.image_aspect, device)
        : config?.image_aspect;
    const ratio = toCssAspectRatio(imageAspectRaw);
    if (!ratio) return undefined;
    const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
    if (!w || !h) return undefined;
    return `${(h / w) * 100}%`;
  })();

  const tabImageRatio =
    toCssAspectRatio(
      config?.tab_image_aspect && typeof config.tab_image_aspect === "object"
        ? pickDeviceImage(config.tab_image_aspect, device)
        : config?.tab_image_aspect,
    ) || "1/1";

  // tab_style: icon_top | text
  const rawTabStyle = String(config?.tab_style || "text").toLowerCase();
  const isIconTop = rawTabStyle.includes("icon");
  const showTabImage = isIconTop;

  // Defaults per spec:
  // tab_text_color: Empty → #6c757d
  // active_tab_color: Empty → #212529
  // active_outline_color: Empty → active_tab_color
  const tabTextColor = config?.tab_text_color || "#6c757d";
  const activeTabColor = config?.active_tab_color || "#212529";
  const activeOutlineColor = config?.active_outline_color || activeTabColor;
  const activeTabColor2 = config?.active_tab_color_2 || "";

  const activeBgImageUrl =
    config?.active_bg_image_url &&
    typeof config.active_bg_image_url === "object"
      ? pickDeviceImage(config.active_bg_image_url, device)
      : config?.active_bg_image_url;

  // Aspect ratio for the active tab's own fill/backdrop image (independent of
  // tab_image_aspect, which is the small icon above the label) — same
  // per-device shape as image_aspect/tab_image_aspect above. Undefined (no
  // aspect-ratio applied) lets the backdrop keep stretching to the tab's own
  // box via backgroundSize: cover, matching pre-existing behaviour when the
  // admin never set this.
  const activeBgImageAspect =
    toCssAspectRatio(
      config?.active_bg_image_aspect &&
        typeof config.active_bg_image_aspect === "object"
        ? pickDeviceImage(config.active_bg_image_aspect, device)
        : config?.active_bg_image_aspect,
    ) || undefined;

  // active_indicator: underline | fill | outline | none
  const rawIndicator = String(config?.active_indicator || "none").toLowerCase();
  const isUnderline = ["underline", "under_line", "line"].includes(
    rawIndicator,
  );
  const isOutline = [
    "outline",
    "outlined",
    "outlined_tab",
    "outlined tab",
    "border",
    "folder",
    "folder tab",
  ].includes(rawIndicator);
  const isFill = [
    "fill",
    "filled",
    "filled_background",
    "filled background",
    "filled_bg",
    "fill background",
    "background",
    "bg",
  ].includes(rawIndicator);
  const isNone = !isUnderline && !isOutline && !isFill;

  // active_bg_style: none | solid | gradient | image
  // Rules per spec:
  // "Only for fill and outline; ignore for underline / none. none is only ever sent with outline (hollow tab)."
  const rawBgStyle = String(config?.active_bg_style || "none").toLowerCase();

  const effectiveBgStyle = (() => {
    if (isUnderline || isNone) return "none";
    if (isFill && (rawBgStyle === "none" || !rawBgStyle)) return "solid";
    return rawBgStyle;
  })();

  const hasActiveBackdrop = effectiveBgStyle !== "none";

  const activeBackgroundImage = (() => {
    if (effectiveBgStyle === "gradient") {
      const endColor = activeTabColor2 || "transparent";
      return `linear-gradient(180deg, ${activeTabColor}, ${endColor})`;
    }
    if (effectiveBgStyle === "image") {
      if (activeBgImageUrl) return `url(${activeBgImageUrl})`;
      return undefined; // fallback to solid if image URL empty
    }
    return undefined;
  })();

  const activeBackgroundSolid = (() => {
    if (effectiveBgStyle === "solid") return activeTabColor;
    if (effectiveBgStyle === "image" && !activeBgImageUrl)
      return activeTabColor; // empty image URL fallback
    return undefined;
  })();

  // The bottom fill color for outward SVG curves on painted folder tabs:
  const curveFillColor = (() => {
    if (!hasActiveBackdrop) return undefined;
    if (effectiveBgStyle === "gradient") {
      return activeTabColor2 || activeTabColor;
    }
    if (effectiveBgStyle === "solid" || effectiveBgStyle === "image") {
      return activeBackgroundSolid;
    }
    return undefined;
  })();

  // Active title colour per spec:
  // fill / outline with background: tab_text_color (white `#ffffff` if empty)
  // underline / none / hollow outline: active_tab_color
  // active_tab_text_color, when set, overrides both branches outright — it's
  // the explicit "colour of the active tab's own label" knob, distinct from
  // tab_text_color (the INACTIVE tabs' label colour) and active_tab_color
  // (the indicator/backdrop colour, not necessarily legible as text).
  const activeTitleColor = (() => {
    if (config?.active_tab_text_color) return config.active_tab_text_color;
    if (isFill || (isOutline && hasActiveBackdrop)) {
      return config?.tab_text_color || "#ffffff";
    }
    return activeTabColor;
  })();

  const animation = String(config?.tab_animation || "none").toLowerCase();

  const firstImage = (p: any) => {
    const img = p?.images?.[0];
    return (
      p?.image_url || (typeof img === "string" ? img : img?.image_url) || ""
    );
  };

  const adaptVariant = (v: any, p: any) => ({
    ...v,
    price: v?.price ?? p?.price ?? p?.min_price ?? 0,
    discounted_price: v?.discounted_price ?? 0,
    stock: v?.stock ?? 0,
    is_unlimited_stock: v?.is_unlimited_stock ?? p?.is_unlimited_stock ?? 0,
    status: v?.status ?? 1,
    measurement: v?.measurement ?? v?.attributes_text ?? "",
    unit: v?.unit ?? { short_code: "" },
  });

  const adaptProduct = (p: any) => {
    const hasVariants = Array.isArray(p?.variants) && p.variants.length > 0;
    return {
      ...p,
      name: p?.name || p?.short_description || "",
      image_url: firstImage(p),
      total_allowed_quantity: p?.total_allowed_quantity ?? p?.stock ?? 999,
      average_rating: p?.average_rating ?? p?.rating ?? 0,
      variants: hasVariants
        ? p.variants.map((v: any) => adaptVariant(v, p))
        : [
            {
              id: p?.variant_id ?? p?.id,
              price: p?.price ?? p?.min_price ?? 0,
              discounted_price: p?.discounted_price ?? 0,
              stock: p?.stock ?? 0,
              is_unlimited_stock: 1,
              status: 1,
              measurement: "",
              unit: { short_code: "" },
            },
          ],
    };
  };

  if (tabs.length === 0) return null;

  // Per-tab `limit` overrides the block-level one, matching how the backend
  // authors it (a tab can show fewer than the block default).
  const limit = Number(activeTab?.limit ?? config?.limit) || 0;
  const products = Array.isArray(activeTab?.products)
    ? limit > 0
      ? activeTab.products.slice(0, limit)
      : activeTab.products
    : [];

  // Every source/CTA field below is read off the ACTIVE TAB first, not the
  // block: in a tabs block each tab carries its own data_source + ids +
  // viewMorePreviewImages (verified against home_layout), so a block-level read
  // would send every tab's See All to whichever source the block happened to
  // carry. The block/config values remain as the fallback for blocks authored
  // before tabs had their own.
  const dataSource =
    activeTab?.data_source ?? config?.data_source ?? block?.data_source ?? "";
  const viewMorePreviewImages = (
    activeTab?.viewMorePreviewImages ??
    config?.viewMorePreviewImages ??
    block?.viewMorePreviewImages ??
    []
  ).filter(Boolean);
  const hasViewMore = viewMorePreviewImages.length > 0;
  const previewThumbs = viewMorePreviewImages.slice(0, 3);
  const manualProductIds =
    activeTab?.manual_product_ids ?? config?.manual_product_ids ?? "";

  // Same normaliser as ProductSliderSection: `??` alone is not enough because
  // the payload marks "no ids of this kind" with "" or [], which a ?? chain
  // stops on, and the id arrives as a number, a CSV string, or an array.
  const firstId = (...values: any[]) => {
    const hit = values.find(
      (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
    );
    if (hit == null) return "";
    return Array.isArray(hit)
      ? hit.filter((x: any) => x != null && x !== "").join(",")
      : String(hit);
  };

  // Tabs name the category field `category_ids` (PLURAL — see the live payload),
  // unlike slider blocks which use singular `category_id`; both spellings are
  // accepted so either authoring shape resolves.
  const sourceId =
    dataSource === "category"
      ? firstId(
          activeTab?.category_ids,
          activeTab?.category_id,
          config?.category_ids,
          config?.category_id,
        )
      : dataSource === "brand"
        ? firstId(
            activeTab?.brand_ids,
            activeTab?.brand_id,
            config?.brand_ids,
            config?.brand_id,
          )
        : firstId(
            activeTab?.brand_ids,
            activeTab?.brand_id,
            activeTab?.category_ids,
            activeTab?.category_id,
            config?.brand_ids,
            config?.category_ids,
          );

  // Mirrors ProductSliderSection's handleSeeAll so a tab's "View More" lands on
  // /products in the same state a slider block's would.
  const navigateSeeAll = async () => {
    dispatch(clearAllFilter({}));
    dispatch(
      setBlockSource({
        data_source: dataSource,
        manual_product_ids: manualProductIds,
        source_id: sourceId,
      }),
    );
    let categoryIdPatch: string | null = null;
    let brandIdPatch: number[] | null = null;

    // A category tab must enter the same flow as clicking a category chip, or a
    // parent category shows none of its children's products — ProductsList keys
    // that on `category_slug`, which the payload doesn't carry, so look it up.
    if (dataSource === "category" && sourceId) {
      try {
        const res = await api.getCategories({
          latitude: cityLat,
          longitude: cityLng,
        });
        const rows = Array.isArray(res?.data) ? res.data : [];
        const wantedId = String(sourceId).split(",")[0].trim();
        const match = findNodeById(rows, wantedId);
        if (match?.slug) {
          dispatch(setListingSource({ data: "category" }));
          dispatch(setCategorySlug({ data: match.slug }));
          dispatch(
            setCategoryBreadcrumb({
              data: [
                {
                  id: match.id,
                  name: match?.translations?.name || match?.name,
                  slug: match.slug,
                },
              ],
            }),
          );
          // The URL's category_id is a SLUG csv, not the numeric id.
          categoryIdPatch = match.slug;
        }
      } catch (error: any) {
        console.log("Tab See All category resolve failed", error?.message);
      }
    }

    // Brand ids need no lookup — the URL's brand_ids param is already numeric.
    if (dataSource === "brand" && sourceId) {
      brandIdPatch = String(sourceId)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
    }

    const qs = new URLSearchParams(
      buildQueryPatch({
        ...(categoryIdPatch && { category_id: categoryIdPatch }),
        ...(brandIdPatch?.length && { brand_ids: brandIdPatch }),
      }),
    ).toString();
    const dest = zoneHref("/products");
    router.push(qs ? `${dest}?${qs}` : dest);
  };

  // Wrapped so the category branch's `await api.getCategories` above can't
  // leave the click with no on-screen response — this one hits the network on
  // every click (no cache), so the dead window is the full request.
  const handleSeeAll = () => runNavClick(navigateSeeAll);

  const motionProps = (() => {
    if (animation === "fade") {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };
    }
    if (animation === "slide") {
      // Travel follows both the tab direction and the reading direction, so in
      // RTL a "next" tab still enters from the side the user swiped toward.
      const offset = 28 * direction * (rtl ? -1 : 1);
      return {
        initial: { opacity: 0, x: offset },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -offset },
        transition: { duration: 0.26, ease: "easeOut" as const },
      };
    }
    return {};
  })();

  return (
    <section>
      <div
        className="relative overflow-hidden"
        style={{
          ...(borderRadius != null ? { borderRadius } : {}),
          ...(hasBg
            ? {
                backgroundImage: `url(${bgImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : {}),
          ...(backgroundColor ? { backgroundColor } : {}),
          ...(textColor ? { color: textColor } : {}),
        }}
      >
        {bgAspectPadding && (
          <div
            aria-hidden
            className="float-left w-0"
            style={{ paddingTop: bgAspectPadding }}
          />
        )}

        <div className="relative" style={blockPaddingStyle} dir={dir}>
          {title && (
            <div
              className="flex justify-between items-center gap-3 mb-3"
              style={inlinePaddingStyle}
            >
              {/* Deliberately smaller than ProductSliderSection's display
                  heading: a tabs block's title labels the tab strip directly
                  under it, and at 3xl it dwarfed the tabs and pushed the
                  products down — the admin preview shows it as a compact bold
                  label, and the two must match. */}
              <h2
                className={`text-[15px] sm:text-base font-bold leading-snug m-0 ${
                  textColor ? "" : "text-gray-900 dark:text-zinc-100"
                }`}
                style={textColor ? { color: textColor } : undefined}
              >
                {title}
              </h2>
            </div>
          )}

          {/* Tab strip — scrolls horizontally rather than wrapping, so a long
              tab list never pushes the product grid down the page. */}
          <div className="relative">
            <div
              className={`relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isOutline ? "gap-[16px]" : "gap-[10px]"
              }`}
              style={{
                ...inlinePaddingStyle,
                paddingLeft: isOutline
                  ? Math.max(Number(inlinePaddingStyle.paddingLeft || 0), 8)
                  : inlinePaddingStyle.paddingLeft,
                paddingRight: isOutline
                  ? Math.max(Number(inlinePaddingStyle.paddingRight || 0), 16)
                  : inlinePaddingStyle.paddingRight,
                paddingBottom: isOutline || hasActiveBackdrop ? 0 : 4,
              }}
              ref={stripRef}
              role="tablist"
            >
              {tabs.slice(0, 8).map((tab: any, index: number) => {
                const isActive = index === activeIndex;
                const tabImage = pickDeviceImage(tab?.images, device);
                const sectionId =
                  block?.id || block?._id || block?.title || "section";
                return (
                  <button
                    key={tab?.id ?? index}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => selectTab(index)}
                    className={`relative flex shrink-0 items-center transition-colors ${
                      isIconTop
                        ? `w-[64px] min-w-[64px] flex-col text-center gap-1 py-1.5 px-1 ${
                            isOutline ? "justify-center" : "justify-start"
                          }`
                        : "px-3 py-1.5 flex-row justify-center text-center"
                    } ${
                      isOutline
                        ? "rounded-t-xl rounded-b-none"
                        : isFill || hasActiveBackdrop
                          ? isIconTop
                            ? "rounded-xl"
                            : "rounded-full"
                          : "rounded-lg"
                    } ${
                      isActive ? "z-10" : "opacity-70 hover:opacity-100 z-0"
                    }`}
                    style={{
                      color: isActive ? activeTitleColor : tabTextColor,
                      // The active tab's own box grows to this ratio (width
                      // fixed by the w-[64px]/px-3 rules above, height
                      // derived) — the fill backdrop above is inset-0 to
                      // this button, so setting aspect-ratio on the overlay
                      // alone does nothing; the button's box has to be the
                      // one that resizes.
                      ...(isActive &&
                      effectiveBgStyle === "image" &&
                      activeBgImageUrl &&
                      activeBgImageAspect
                        ? { aspectRatio: activeBgImageAspect, height: "auto" }
                        : {}),
                    }}
                  >
                    {/* Active fill / backdrop marker animated slide (for card fill mode) */}
                    {isActive &&
                      (isFill || (hasActiveBackdrop && !isOutline)) && (
                        <motion.div
                          layoutId={`productTabsActiveFill-${sectionId}`}
                          className={`absolute inset-0 pointer-events-none z-0 ${
                            isIconTop ? "rounded-xl" : "rounded-full"
                          }`}
                          style={{
                            ...(activeBackgroundImage
                              ? {
                                  backgroundImage: activeBackgroundImage,
                                  ...(activeBgImageUrl
                                    ? {
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                      }
                                    : {}),
                                  ...(effectiveBgStyle === "image" &&
                                  activeBgImageUrl &&
                                  activeBgImageAspect
                                    ? { aspectRatio: activeBgImageAspect }
                                    : {}),
                                }
                              : {}),
                            ...(activeBackgroundSolid
                              ? { backgroundColor: activeBackgroundSolid }
                              : {}),
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 35,
                          }}
                        />
                      )}

                    {isIconTop && tabImage && (
                      <span
                        className="relative z-10 block w-[26px] h-auto shrink-0 overflow-hidden rounded"
                        style={{ aspectRatio: tabImageRatio }}
                      >
                        <Image
                          src={tabImage}
                          alt={tab?.title || ""}
                          fill
                          className="object-cover"
                          sizes="26px"
                        />
                      </span>
                    )}
                    {tab?.title ? (
                      <span
                        className={`relative z-10 text-[12px] font-semibold leading-tight ${
                          isIconTop
                            ? "w-full line-clamp-2 break-words min-h-[2.4em]"
                            : "whitespace-nowrap"
                        }`}
                      >
                        {tab.title}
                      </span>
                    ) : null}
                    {/* Text-only tabs are flex-row, so an in-flow underline
                        sat BESIDE the label and its w-full pushed the label
                        out of the button — pin it to the bottom edge instead.
                        Icon-top is flex-col, where in-flow already stacks. */}
                    {isActive && isUnderline && (
                      <motion.span
                        layoutId={`productTabsActiveUnderline-${sectionId}`}
                        className={`z-10 block h-[2px] rounded-full ${
                          isIconTop
                            ? "relative mt-1 w-full shrink-0"
                            : "absolute bottom-0 inset-x-3"
                        }`}
                        style={{
                          backgroundColor: activeTabColor,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 35,
                        }}
                      />
                    )}
                  </button>
                );
              })}

              {/* Folder-tab outline — ONE svg for the whole strip, spanning it
                  edge to edge and never moving itself; the tab group inside
                  slides to the active tab. Rendering it per-button under a
                  shared `layoutId` made framer keep a copy alive on the
                  outgoing tab mid-transition, which read as every tab being
                  outlined at once. */}
              {isOutline && activeTabRect && (
                <FolderTabOutline
                  tabLeft={activeTabRect.left}
                  width={activeTabRect.width}
                  height={activeTabRect.height}
                  stripWidth={activeTabRect.stripWidth}
                  fill={curveFillColor}
                  stroke={activeOutlineColor}
                  gradientFrom={
                    effectiveBgStyle === "gradient" ? activeTabColor : undefined
                  }
                  gradientTo={
                    effectiveBgStyle === "gradient"
                      ? activeTabColor2 || "transparent"
                      : undefined
                  }
                  backgroundImageUrl={
                    effectiveBgStyle === "image" ? activeBgImageUrl : undefined
                  }
                />
              )}

              {/* One continuous baseline across the whole strip, UNDER the
                  outline (z-0 vs z-10). Previously each inactive tab drew its
                  own segment with hand-tuned negative offsets to meet its
                  neighbour's curve, and every mismatch showed as a nick in the
                  line — the active tab's own svg paints over the stretch it
                  covers, so a single line needs no per-tab bookkeeping. */}
              {/* Keeps the row's scroll width past the last tab so the baseline
                  runs to the strip's edge instead of stopping at the tab. */}
              {isOutline && (
                <div aria-hidden className="min-w-4 flex-1 shrink-0" />
              )}
            </div>
          </div>

          {/* Product area — no gap when outlined baseline is present */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={animation === "none" ? "static" : activeIndex}
              {...motionProps}
            >
              {products.length === 0 ? null : isGrid ? (
                <div
                  className={`grid ${isOutline ? "mt-1" : "mt-3"} ${
                    gridCols
                      ? ""
                      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  }`}
                  style={{
                    ...inlinePaddingStyle,
                    gap: `${gap}px`,
                    ...(gridCols
                      ? {
                          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                        }
                      : {}),
                  }}
                >
                  {products.map((product: any) => (
                    <div key={product.id} className="h-full">
                      <HomeVerticleProductCard
                        product={adaptProduct(product)}
                        radius={cardRadius}
                      />
                    </div>
                  ))}
                </div>
              ) : isList ? (
                <div
                  className={`${isOutline ? "mt-1" : "mt-3"} grid items-stretch ${
                    device === "web" ? "grid-cols-2" : "grid-cols-1"
                  }`}
                  style={{ ...inlinePaddingStyle, gap: `${gap}px` }}
                >
                  {products.map((product: any) => (
                    <div key={product.id} className="h-full">
                      <HomeListViewCard
                        product={adaptProduct(product)}
                        radius={cardRadius}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`relative ${isOutline ? "mt-1" : "mt-3"}`}>
                  {/* Drag/swipe only, no nav arrows — same affordance as the
                      home product slider. The gutter goes INSIDE the clipper
                      (slidesOffset*) so the first card lines up with the title
                      while the track still bleeds to the block edge. */}
                  <Swiper
                    key={`${activeIndex}-${String(rtl)}`}
                    dir={dir}
                    slidesPerView={1.6}
                    spaceBetween={gap}
                    slidesOffsetBefore={inlinePadding}
                    slidesOffsetAfter={inlinePadding}
                    observer={true}
                    observeParents={true}
                    grabCursor={true}
                    simulateTouch={true}
                    className="brand-swiper [&_.swiper-wrapper]:items-stretch"
                    breakpoints={{
                      1536: { slidesPerView: 6, spaceBetween: gap },
                      1280: { slidesPerView: 6, spaceBetween: gap },
                      1024: { slidesPerView: 4, spaceBetween: gap },
                      768: { slidesPerView: 3, spaceBetween: gap },
                      640: { slidesPerView: 2.5, spaceBetween: gap },
                      480: { slidesPerView: 2.2, spaceBetween: gap },
                      0: { slidesPerView: 1.6, spaceBetween: gap },
                    }}
                  >
                    {products.map((product: any) => (
                      <SwiperSlide key={product.id} className="!h-auto">
                        <div className="h-full">
                          <HomeVerticleProductCard
                            product={adaptProduct(product)}
                            radius={cardRadius}
                          />
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* "View More" pill — one bar for the block, driven by the ACTIVE
              tab's own preview images and source, so switching tabs re-points it
              rather than rendering a second button. Sits OUTSIDE AnimatePresence:
              inside, it would fade/slide along with the cards on every tab tap,
              which reads as the button flickering in and out.
              Rendered only when that tab sent preview images — an empty or
              absent array means the tab has nothing more to show. */}
          {hasViewMore && (
            <div
              className="mt-5 flex justify-center"
              style={inlinePaddingStyle}
            >
              <button
                type="button"
                onClick={handleSeeAll}
                className="inline-flex items-center gap-3 rounded-full bg-white dark:bg-zinc-900 p-1.5 pe-1.5 shadow-[0_3px_14px_rgba(0,0,0,0.16)]"
              >
                {/* Circular thumbnails overlapped into a fanned stack; the thick
                    ring is what separates them where they overlap. object-contain
                    keeps the whole product in frame — cover crops packaged goods. */}
                <span className="flex items-center flex-shrink-0">
                  {previewThumbs.map((src: string, index: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="h-9 w-9 rounded-full object-contain bg-gray-50 dark:bg-zinc-800 p-0.5 ring-[3px] ring-white dark:ring-zinc-900"
                      style={{
                        // Overlap on the logical start edge so the stack still
                        // reads correctly under RTL (the row flips with `dir`).
                        ...(index === 0 ? {} : { marginInlineStart: "-12px" }),
                        zIndex: previewThumbs.length - index,
                      }}
                    />
                  ))}
                </span>

                <span className="px-1 text-[15px] font-bold tracking-tight primaryColor whitespace-nowrap">
                  {tr("view_more")}
                </span>

                {/* Primary colour from the CSS var, so it re-tints per
                    white-label build instead of being hardcoded. */}
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  <IoArrowForward size={17} className="rtl:rotate-180" />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ProductTabsSection;
