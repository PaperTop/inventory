"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Archive,
  Briefcase,
  Buildings,
  Camera,
  CarProfile,
  Check,
  Cube,
  Copy,
  Folder,
  Trash,
  Garage,
  House,
  List,
  MagnifyingGlass,
  MapPin,
  Minus,
  Package,
  Plus,
  SlidersHorizontal,
  Star,
  SquaresFour,
  Tag,
  CaretRight,
  CaretDown,
  GearSix,
  AirplaneTilt,
  Sparkle,
  X,
  PencilSimple,
  CalendarBlank,
  Clock,
  CheckCircle,
  Bed,
  Bathtub,
  CookingPot,
  Armchair,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Item, Location } from "@/lib/inventory";
import { ancestors, containerDestinations } from "@/lib/containers";
import { apiRepository } from "@/lib/browser-api";
import { validatePhotoFile } from "@/lib/photos";
import type { SavedInventory } from "./inventory-app";
import {
  duplicateInventoryItem,
  filterInventory,
  type InventoryViewOptions,
} from "@/lib/presentation";
import styles from "./liquid-dashboard.module.css";
import { ContainerGrid } from "./container-grid";
import { SpacesBrowser } from "./spaces-browser";
import { JarvisChat } from "./jarvis-chat";
import { GlassSelect } from "./glass-select";
import {
  useInventoryStore,
  visualItem,
  type VisualItem,
} from "./use-inventory-store";

const owner = "11111111-1111-4111-8111-111111111111";
const baseDate = "2026-09-14T07:24:00.000Z";

const seedItems: VisualItem[] = [
  {
    id: "backpack",
    user_id: owner,
    name: "Backpack",
    kind: "durable",
    description: "Main backpack for school and travel. Fits a 15-inch laptop.",
    category: "Bags",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["school", "travel", "everyday"],
    status: "active",
    condition: "good",
    attributes: { color: "Black", material: "Recycled nylon" },
    version: 1,
    created_at: "2026-09-08T10:20:00.000Z",
    updated_at: baseDate,
    image: "/inventory-assets/backpack.png",
  },
  {
    id: "laptop",
    user_id: owner,
    name: "Laptop",
    kind: "durable",
    description: "13-inch laptop used for work and classes.",
    category: "Electronics",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["work", "school"],
    status: "active",
    condition: "good",
    attributes: { color: "Silver" },
    version: 1,
    created_at: "2026-08-19T08:00:00.000Z",
    updated_at: "2026-09-13T17:10:00.000Z",
    image: "/inventory-assets/laptop.png",
  },
  {
    id: "water-bottle",
    user_id: owner,
    name: "Water bottle",
    kind: "durable",
    description: "One-liter bottle for long days away from home.",
    category: "Everyday carry",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["daily", "gym"],
    status: "active",
    condition: "good",
    attributes: { capacity: "1 L" },
    version: 1,
    created_at: "2026-08-28T08:00:00.000Z",
    updated_at: "2026-09-13T13:42:00.000Z",
    image: "/inventory-assets/bottle.png",
  },
  {
    id: "headphones",
    user_id: owner,
    name: "Headphones",
    kind: "durable",
    description: "Noise-cancelling headphones with a travel case.",
    category: "Electronics",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Bedroom",
    tags: ["music", "travel"],
    status: "active",
    condition: "good",
    attributes: { color: "Black" },
    version: 1,
    created_at: "2026-07-10T08:00:00.000Z",
    updated_at: "2026-09-12T22:12:00.000Z",
    image: "/inventory-assets/headphones.png",
  },
  {
    id: "sneakers",
    user_id: owner,
    name: "Sneakers",
    kind: "durable",
    description: "Everyday white sneakers.",
    category: "Clothing",
    quantity: 1,
    unit: "pair",
    reorder_threshold: null,
    location_id: null,
    location_name: "Bedroom",
    tags: ["everyday"],
    status: "active",
    condition: "fair",
    attributes: { size: "10" },
    version: 1,
    created_at: "2026-06-02T08:00:00.000Z",
    updated_at: "2026-09-11T10:00:00.000Z",
    image: "/inventory-assets/sneakers.png",
  },
  {
    id: "camera",
    user_id: owner,
    name: "Camera",
    kind: "durable",
    description: "Compact camera for trips and weekend walks.",
    category: "Electronics",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    parent_container_id: "drawer",
    location_name: "Bedroom",
    tags: ["travel", "creative"],
    status: "stored",
    condition: "good",
    attributes: { lens: "35 mm" },
    version: 1,
    created_at: "2026-05-18T08:00:00.000Z",
    updated_at: "2026-09-10T09:30:00.000Z",
    image: "/inventory-assets/camera.png",
  },
  {
    id: "hoodie",
    user_id: owner,
    name: "Hoodie",
    kind: "durable",
    description: "Soft charcoal hoodie for cool evenings.",
    category: "Clothing",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Bedroom",
    tags: ["everyday", "warm"],
    status: "active",
    condition: "good",
    attributes: { size: "M" },
    version: 1,
    created_at: "2026-05-05T08:00:00.000Z",
    updated_at: "2026-09-09T19:20:00.000Z",
    image: "/inventory-assets/hoodie.png",
  },
  {
    id: "notebook",
    user_id: owner,
    name: "Notebook",
    kind: "durable",
    description: "Daily notes, sketches, and lists.",
    category: "Stationery",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["school", "work"],
    status: "active",
    condition: "good",
    attributes: { pages: 120 },
    version: 1,
    created_at: "2026-08-30T08:00:00.000Z",
    updated_at: "2026-09-08T14:00:00.000Z",
    image: "/inventory-assets/notebook.png",
  },
  {
    id: "wallet",
    user_id: owner,
    name: "Wallet",
    kind: "durable",
    description: "Slim leather wallet for essential cards.",
    category: "Everyday carry",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Home",
    tags: ["daily"],
    status: "active",
    condition: "good",
    attributes: { material: "Leather" },
    version: 1,
    created_at: "2026-04-02T08:00:00.000Z",
    updated_at: "2026-09-07T08:00:00.000Z",
    image: "/inventory-assets/wallet.png",
  },
  {
    id: "umbrella",
    user_id: owner,
    name: "Umbrella",
    kind: "durable",
    description: "Compact umbrella kept near the front door.",
    category: "Everyday carry",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Car",
    tags: ["travel", "rain"],
    status: "active",
    condition: "new",
    attributes: { color: "Black" },
    version: 1,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-06T16:40:00.000Z",
    image: "/inventory-assets/umbrella.png",
  },
  {
    id: "contact-lenses",
    user_id: owner,
    name: "Contact lenses",
    kind: "durable",
    description: "Daily disposable contact lenses.",
    category: "Personal care",
    quantity: 1,
    unit: "box",
    reorder_threshold: null,
    location_id: null,
    parent_container_id: "drawer",
    location_name: "Bedroom",
    tags: ["personal", "daily", "vision"],
    status: "active",
    condition: "new",
    attributes: { prescription: "-2.50" },
    version: 1,
    created_at: "2026-09-03T08:00:00.000Z",
    updated_at: "2026-09-07T12:00:00.000Z",
    image: "/inventory-assets/contact-lenses.png",
  },
];

const seedContainers: VisualItem[] = [
  {
    id: "cabinet",
    user_id: owner,
    name: "Cabinet",
    kind: "container",
    description: "Bedroom cabinet for everyday gear and small storage.",
    category: "Furniture",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    parent_container_id: null,
    location_name: "Bedroom",
    tags: ["storage", "bedroom"],
    status: "active",
    condition: "good",
    attributes: { material: "Wood" },
    version: 1,
    created_at: baseDate,
    updated_at: baseDate,
    image: "/inventory-assets/container.svg",
  },
  {
    id: "drawer",
    user_id: owner,
    name: "Drawer",
    kind: "container",
    description: "A drawer inside the bedroom cabinet.",
    category: "Furniture",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    parent_container_id: "cabinet",
    location_name: "Bedroom",
    tags: ["storage", "bedroom"],
    status: "active",
    condition: "good",
    attributes: { material: "Wood" },
    version: 1,
    created_at: baseDate,
    updated_at: baseDate,
    image: "/inventory-assets/drawer.png",
  },
];

const seedAccessories: VisualItem[] = [
  {
    id: "tripod",
    name: "Travel tripod",
    image: "/inventory-assets/tripod.png",
    category: "Camera accessories",
    description:
      "Compact tripod for steady camera shots. Check the mount before use.",
  },
  {
    id: "sd-card",
    name: "SD memory card",
    image: "/inventory-assets/sd-card.png",
    category: "Electronics",
    description:
      "Spare 64 GB SD card for photography. Check camera compatibility.",
  },
  {
    id: "camera-lens",
    name: "CRT lens",
    category: "Electronics",
    image: "/inventory-assets/lens.png",
    description: "A compact prime lens for everyday photography.",
  },
  {
    id: "camera-battery",
    name: "Camera battery",
    category: "Electronics",
    image: "/inventory-assets/battery.png",
    description: "A charged spare battery for long days of shooting.",
  },
  {
    id: "lens-cleaner",
    name: "Lens cleaner",
    category: "Cleaning",
    image: "/inventory-assets/blower.png",
    description: "A soft air blower for removing dust from lenses.",
  },
  {
    id: "charging-cable",
    name: "Charging cable",
    category: "Electronics",
    image: "/inventory-assets/cable.png",
    description: "USB-C cable for charging camera gear on the go.",
  },
  {
    id: "sunglasses",
    name: "Sunglasses",
    category: "Accessories",
    image: "/inventory-assets/sunglasses.png",
    description: "Everyday sunglasses with UV protection.",
  },
  {
    id: "cleaning-cloth",
    name: "Cleaning cloth",
    category: "Cleaning",
    image: "/inventory-assets/cloth.png",
    description: "Microfiber cloth for keeping screens and lenses clean.",
  },
  {
    id: "memory-case",
    name: "Memory card case",
    category: "Accessories",
    image: "/inventory-assets/memory-case.png",
    description: "Protective case for memory cards and adapters.",
  },
].map((accessory) => ({
  ...seedItems[0],
  ...accessory,
  location_name: "Bedroom",
  parent_container_id: "drawer",
  tags: ["photography", "camera accessories"],
  attributes: {},
  updated_at: accessory.id === "tripod" ? "2026-09-15T10:00:00.000Z" : baseDate,
}));

const displayOrder = [
  "tripod",
  "camera-lens",
  "backpack",
  "laptop",
  "water-bottle",
  "headphones",
  "sneakers",
  "hoodie",
  "notebook",
  "wallet",
  "umbrella",
  "camera",
  "camera-battery",
  "sd-card",
  "lens-cleaner",
  "charging-cable",
  "sunglasses",
  "cleaning-cloth",
  "memory-case",
  "contact-lenses",
];
const initialItems = [...seedItems, ...seedContainers, ...seedAccessories].map(
  (item) => {
    const index = displayOrder.indexOf(item.id);
    return index < 0
      ? item
      : {
          ...item,
          updated_at: new Date(
            Date.UTC(2026, 8, 14, 12) - index * 3_600_000,
          ).toISOString(),
        };
  },
);

const navItems = [
  {
    label: "Home",
    value: "all",
    Icon: House,
    icon: undefined,
    color: undefined,
    place: undefined,
  },
  {
    label: "College",
    value: "College",
    Icon: Buildings,
    icon: undefined,
    color: undefined,
    place: undefined,
  },
  {
    label: "Car",
    value: "Car",
    Icon: CarProfile,
    icon: undefined,
    color: undefined,
    place: undefined,
  },
] as const;

const initialLocationOptions = [
  "Home",
  "Bedroom",
  "Bathroom",
  "Kitchen",
  "Living Room",
  "College",
  "Car",
] as const;

const placeIconOptions = [
  { value: "MapPin", label: "Pin", Icon: MapPin },
  { value: "Camera", label: "Camera", Icon: Camera },
  { value: "Briefcase", label: "Briefcase", Icon: Briefcase },
  { value: "Archive", label: "Archive", Icon: Archive },
  { value: "Garage", label: "Garage", Icon: Garage },
  { value: "Bed", label: "Bedroom", Icon: Bed },
  { value: "Bathtub", label: "Bathroom", Icon: Bathtub },
  { value: "CookingPot", label: "Kitchen", Icon: CookingPot },
  { value: "Armchair", label: "Living room", Icon: Armchair },
  { value: "House", label: "Home", Icon: House },
  { value: "Buildings", label: "College", Icon: Buildings },
  { value: "CarProfile", label: "Car", Icon: CarProfile },
] as const;

const placeColorOptions = [
  { value: "blue", label: "Blue", color: "#55b7ff" },
  { value: "violet", label: "Violet", color: "#ad9bff" },
  { value: "rose", label: "Rose", color: "#f59ab8" },
  { value: "mint", label: "Mint", color: "#7de5c0" },
] as const;

type PlaceIconValue = (typeof placeIconOptions)[number]["value"];
type PlaceColorValue = (typeof placeColorOptions)[number]["value"];
type Place = {
  name: string;
  icon: PlaceIconValue;
  color: string;
  Icon: Icon;
};

function now() {
  return new Date().toISOString();
}

function defaultPlace(name: string): Place {
  const option =
    placeIconOptions.find(
      (option) => option.label.toLowerCase() === name.toLowerCase(),
    ) ?? placeIconOptions[0];
  return { name, icon: option.value, Icon: option.Icon, color: "#85bce8" };
}

export function LiquidDashboard({
  savedInventory,
  accountControls,
  accountEmail,
}: {
  savedInventory?: SavedInventory;
  accountControls?: ReactNode;
  accountEmail?: string;
} = {}) {
  const storageMode = savedInventory ? "saved" : "sample";
  const [locations, setLocations] = useState<Location[]>(
    savedInventory?.locations ?? [],
  );
  const store = useInventoryStore(
    savedInventory?.items.map(visualItem) ?? initialItems,
    locations,
    storageMode === "saved",
  );
  const {
    items,
    setItems,
    patch: patchItem,
    create: createItem,
    remove: removeItem,
    error: storeError,
  } = store;
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<{
    itemId: string;
    message: string;
  } | null>(null);
  const [places, setPlaces] = useState<Place[]>(() =>
    initialLocationOptions.map(defaultPlace),
  );
  const [deletingPlace, setDeletingPlace] = useState(false);
  const [moveDestination, setMoveDestination] = useState("");
  const [savingPlace, setSavingPlace] = useState(false);
  const [addingPlace, setAddingPlace] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [placeError, setPlaceError] = useState("");
  const [placeIcon, setPlaceIcon] = useState<PlaceIconValue>("MapPin");
  const [placeColor, setPlaceColor] = useState<PlaceColorValue>("blue");
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const addPlaceButton = useRef<HTMLButtonElement>(null);
  const locationOptions =
    storageMode === "saved"
      ? locations.map((location) => location.name)
      : places.map((place) => place.name);
  const managedPlaces: Place[] =
    storageMode === "saved"
      ? locations.map((place) => defaultPlace(place.name))
      : places;
  const navigation = [
    navItems[0],
    ...(storageMode === "saved"
      ? locations.map((location) => ({
          label: location.name,
          value: location.name,
          Icon: MapPin,
          color: undefined,
          icon: undefined,
          place: undefined,
        }))
      : []),
    ...places
      .filter(
        (place) =>
          !["Home", "Bedroom", "Bathroom", "Kitchen", "Living Room"].includes(
            place.name,
          ),
      )
      .map((place) => ({
        label: place.name,
        value: place.name,
        Icon: place.Icon,
        color: place.color,
        icon: place.icon,
        place,
      })),
  ];
  const [selectedId, setSelectedId] = useState(seedItems[0].id);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [section, setSection] = useState("Home");
  const [iconChoicesOpen, setIconChoicesOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [openedContainer, setOpenedContainer] = useState<string | null>(null);
  const spacesLanding = section === "Spaces" && !openedContainer;
  const [tagFilter, setTagFilter] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searchTab, setSearchTab] = useState("All results");
  const [promptRequest, setPromptRequest] = useState<{
    text: string;
    id: number;
  }>();
  const [kind, setKind] = useState<InventoryViewOptions["kind"]>("all");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState<InventoryViewOptions["sort"]>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(seedItems[0].name);
  const [nameError, setNameError] = useState("");
  const [tagDraft, setTagDraft] = useState({ itemId: "", value: "" });
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const tagFormRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState(
    savedInventory ? "Saved inventory ready" : "Sample inventory is ready",
  );

  const filtered = useMemo(
    () =>
      filterInventory(items, { query, kind, location, sort }).filter(
        (item) =>
          (category === "all" || item.category === category) &&
          (status === "all" || item.status === status) &&
          (section !== "Favorites" || item.tags.includes("favorite")) &&
          (section !== "Missing" || item.status === "lost") &&
          (!tagFilter || item.tags.includes(tagFilter)),
      ),
    [items, kind, location, query, sort, category, status, section, tagFilter],
  );
  const selected =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const previewHome =
    section === "Home" &&
    view === "grid" &&
    !query &&
    kind === "all" &&
    category === "all" &&
    status === "all";
  const visibleItems = previewHome
    ? filtered.filter((item) => item.kind !== "container").slice(0, 17)
    : filtered;
  const placementOptions = [
    ...[...new Set(locationOptions)].map((name) => ({
      value: `location:${name}`,
      label: name,
    })),
    ...containerDestinations(items, selected ?? undefined).map((item) => ({
      value: `container:${item.id}`,
      label: item.location_path?.join(" → ") || item.name,
    })),
  ];
  const placementValue = selected?.parent_container_id
    ? `container:${selected.parent_container_id}`
    : `location:${selected?.location_name ?? locationOptions[0] ?? "Unassigned"}`;

  const currentContainer = items.find((item) => item.id === openedContainer);
  const containerChain = currentContainer
    ? [...ancestors(currentContainer, items), currentContainer]
    : [];
  const categories = [
    ...new Set(
      items
        .filter((item) => item.kind !== "container")
        .map((item) => item.category),
    ),
  ]
    .filter(Boolean)
    .sort();
  const relatedItems = selected
    ? items
        .filter(
          (item) =>
            item.id !== selected.id &&
            item.kind !== "container" &&
            (item.category === selected.category ||
              item.tags.some((tag) => selected.tags.includes(tag))),
        )
        .slice(0, 4)
    : [];

  function navigate(label: string, place = "all") {
    setSection(label);
    setLocation(place);
    setOpenedContainer(null);
    setCategory("all");
    setStatus("all");
    setTagFilter("");
    setQuery("");
    setKind(label === "Spaces" ? "container" : "all");
    if (label === "All items") setView("list");
    if (label === "Home" || label === "Spaces") setView("grid");
    setMobileNav(false);
  }

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === "Escape") {
        setDetailsOpen(false);
        setChatOpen(false);
        setMobileNav(false);
        setFilterOpen(false);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (!detailsOpen && !chatOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = detailsOpen ? detailRef.current : chatRef.current;
    panel?.querySelector<HTMLElement>("button, input")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) return;
      const controls = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea, [tabindex="0"]',
        ),
      ].filter((el) => !el.closest("[hidden]"));
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [detailsOpen, chatOpen]);

  async function uploadPhoto(file: File | undefined) {
    if (!file || !selected || uploadingPhoto) return;
    const itemId = selected.id;
    setPhotoError(null);
    try {
      validatePhotoFile(file);
      setUploadingPhoto(true);
      if (storageMode === "saved") {
        const saved = await store.savePhoto(itemId, file);
        if (!saved)
          throw new Error(
            "The photo was not confirmed saved. Reload saved inventory before trying again.",
          );
        setNotice("Photo saved to your inventory");
      } else {
        const image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          const failed = () =>
            reject(
              new Error("Could not read this image. Please try another file."),
            );
          reader.onload = () =>
            typeof reader.result === "string"
              ? resolve(reader.result)
              : failed();
          reader.onerror = failed;
          reader.onabort = failed;
          reader.readAsDataURL(file);
        });
        setItems((current) =>
          current.map((item) =>
            item.id === itemId
              ? { ...item, image, version: item.version + 1, updated_at: now() }
              : item,
          ),
        );
        setNotice(
          "Photo updated for this session — sign in to save photos permanently",
        );
      }
    } catch (error) {
      setPhotoError({
        itemId,
        message:
          error instanceof Error
            ? error.message
            : "Could not save this photo. Please try again.",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  function patchSelected(patch: Partial<VisualItem>) {
    if (!selected) return;
    const nextPatch = { ...patch };
    if (patch.location_name !== undefined) {
      nextPatch.location_id =
        locations.find(
          (location) =>
            location.name.toLowerCase() === patch.location_name?.toLowerCase(),
        )?.id ?? selected.location_id;
      nextPatch.parent_container_id = null;
    }
    if (patch.parent_container_id !== undefined) {
      const parent = patch.parent_container_id
        ? items.find((item) => item.id === patch.parent_container_id)
        : undefined;
      nextPatch.location_id = null;
      nextPatch.location_name = parent?.location_name ?? selected.location_name;
    }
    patchItem(selected.id, nextPatch);
  }

  const allPastTags = useMemo(() => {
    const tagSet = new Set<string>(knownTags);
    for (const item of items) {
      for (const tag of item.tags) {
        const trimmed = tag.trim();
        if (trimmed) tagSet.add(trimmed);
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [items, knownTags]);

  useEffect(() => {
    if (!showTagSuggestions) return;
    const dismiss = (event: PointerEvent) => {
      if (!tagFormRef.current?.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [showTagSuggestions]);

  const currentTagDraft =
    tagDraft.itemId === selected?.id ? tagDraft.value : "";

  const availablePastTags = useMemo(() => {
    if (!selected) return [];
    const currentTagsLower = new Set(selected.tags.map((t) => t.toLowerCase()));
    return allPastTags.filter((tag) => {
      if (currentTagsLower.has(tag.toLowerCase())) return false;
      if (currentTagDraft.trim()) {
        return tag.toLowerCase().includes(currentTagDraft.trim().toLowerCase());
      }
      return true;
    });
  }, [allPastTags, selected, currentTagDraft]);

  function addTag(rawTag: string) {
    const tag = rawTag.trim();
    if (!tag || !selected) return;
    if (
      !selected.tags.some(
        (existing) => existing.toLowerCase() === tag.toLowerCase(),
      )
    ) {
      patchSelected({ tags: [...selected.tags, tag] });
      setKnownTags((prev) => Array.from(new Set([...prev, tag])));
    }
    setTagDraft({ itemId: selected.id, value: "" });
  }

  function startEditing() {
    if (!selected) return;
    setEditName(selected.name);
    setNameError("");
    setEditing(true);
    setNotice("Editing item");
  }

  function finishEditing() {
    const name = editName.trim();
    if (!name) {
      setNameError("Item name is required");
      setNotice("Add a name before saving");
      return;
    }
    patchSelected({ name });
    setNameError("");
    setEditing(false);
    setNotice(
      storageMode === "saved" ? "Changes saved" : "Changes saved locally",
    );
  }

  function closePlaceForm() {
    setDeletingPlace(false);
    setAddingPlace(false);
    setEditingPlace(null);
    setPlaceName("");
    setPlaceError("");
    setPlaceIcon("MapPin");
    setPlaceColor("blue");
    addPlaceButton.current?.focus();
  }

  function openAddPlace() {
    setIconChoicesOpen(false);
    setEditingPlace(null);
    setPlaceName("");
    setPlaceError("");
    setPlaceIcon("MapPin");
    setPlaceColor("blue");
    setAddingPlace(true);
  }

  function openEditPlace(place: Place) {
    setIconChoicesOpen(false);
    setDeletingPlace(false);
    setMoveDestination(
      locationOptions.find((name) => name !== place.name) ?? "",
    );
    const matchingColor = placeColorOptions.find(
      (option) => option.color === place.color,
    );
    setEditingPlace(place);
    setPlaceName(place.name);
    setPlaceError("");
    setPlaceIcon(place.icon);
    setPlaceColor(matchingColor?.value ?? "blue");
    setAddingPlace(true);
  }

  async function createPlace(event: FormEvent) {
    event.preventDefault();
    if (store.pending) {
      setPlaceError(
        "Wait for your item changes to finish saving, then try again.",
      );
      return;
    }
    const name = placeName.trim();
    if (!name) {
      setPlaceError("Place name is required");
      return;
    }
    const duplicate = locationOptions.find(
      (place) => place.toLowerCase() === name.toLowerCase(),
    );
    if (
      duplicate &&
      duplicate.toLowerCase() !== editingPlace?.name.toLowerCase()
    ) {
      setPlaceError("That place already exists");
      return;
    }
    const selectedIcon = placeIconOptions.find(
      (option) => option.value === placeIcon,
    );
    const selectedColor = placeColorOptions.find(
      (option) => option.value === placeColor,
    );
    if (editingPlace) {
      const previousName = editingPlace.name;
      if (storageMode === "saved") {
        const target = locations.find((place) => place.name === previousName);
        if (!target) return;
        setSavingPlace(true);
        try {
          const updated = await apiRepository.updateLocation(target.id, name);
          const nextLocations = locations.map((place) =>
            place.id === updated.id ? updated : place,
          );
          setLocations(nextLocations);
          store.load(items, nextLocations);
          if (location === previousName) setLocation(name);
          if (section === previousName) setSection(name);
          setNotice(`${name} updated`);
          closePlaceForm();
        } catch (error) {
          setPlaceError(
            error instanceof Error
              ? error.message
              : "Could not update this space.",
          );
        } finally {
          setSavingPlace(false);
        }
        return;
      }
      const updatedPlace: Place = {
        ...editingPlace,
        name,
        icon: placeIcon,
        color: selectedColor?.color ?? placeColorOptions[0].color,
        Icon: selectedIcon?.Icon ?? MapPin,
      };
      setPlaces((current) =>
        current.map((place) =>
          place.name === previousName ? updatedPlace : place,
        ),
      );
      setItems((current) =>
        current.map((item) =>
          item.location_name === previousName
            ? {
                ...item,
                location_name: name,
                version: item.version + 1,
                updated_at: now(),
              }
            : item,
        ),
      );
      if (location === previousName) setLocation(name);
      if (section === previousName) setSection(name);
      setNotice(`${name} updated`);
      closePlaceForm();
      return;
    }
    if (storageMode === "saved") {
      try {
        const createdLocation = await apiRepository.createLocation(name);
        setLocations((current) =>
          [...current, createdLocation].sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        );
        setLocation(name);
        setSection(name);
        setQuery("");
        setKind("all");
        setNotice(`${name} saved`);
        closePlaceForm();
      } catch (error: unknown) {
        setPlaceError(
          error instanceof Error
            ? error.message
            : "Could not save this place. Please try again.",
        );
      }
      return;
    }
    setPlaces((current) => [
      ...current,
      {
        name,
        icon: placeIcon,
        color: selectedColor?.color ?? placeColorOptions[0].color,
        Icon: selectedIcon?.Icon ?? MapPin,
      },
    ]);
    setLocation(name);
    setSection(name);
    setQuery("");
    setKind("all");
    setNotice(`${name} added`);
    closePlaceForm();
  }

  async function deletePlace() {
    if (!editingPlace) return;
    if (store.pending) {
      setPlaceError(
        "Wait for your item changes to finish saving, then try again.",
      );
      return;
    }
    const deletedName = editingPlace.name;
    const hasItems = items.some((item) => item.location_name === deletedName);
    if (hasItems && !moveDestination) {
      setPlaceError(
        "Create another space before deleting this one so your items have somewhere to go.",
      );
      return;
    }
    if (storageMode === "saved") {
      const target = locations.find((place) => place.name === deletedName);
      if (!target) return;
      setSavingPlace(true);
      try {
        await apiRepository.removeLocation(
          target.id,
          locations.find((place) => place.name === moveDestination)?.id ?? null,
        );
        const nextLocations = locations.filter(
          (place) => place.id !== target.id,
        );
        const destination = nextLocations.find(
          (place) => place.name === moveDestination,
        );
        setLocations(nextLocations);
        store.load(
          items.map((item) =>
            item.location_id === target.id
              ? {
                  ...item,
                  location_id: destination?.id ?? null,
                  location_name: destination?.name ?? null,
                  version: item.version + 1,
                  updated_at: now(),
                }
              : item,
          ),
          nextLocations,
        );
      } catch (error) {
        setPlaceError(
          error instanceof Error
            ? error.message
            : "Could not delete this space.",
        );
        setSavingPlace(false);
        return;
      }
      setSavingPlace(false);
    }
    setPlaces((current) =>
      current.filter((place) => place.name !== deletedName),
    );
    if (storageMode === "sample")
      setItems((current) =>
        current.map((item) =>
          item.location_name === deletedName
            ? {
                ...item,
                location_name: moveDestination,
                version: item.version + 1,
                updated_at: now(),
              }
            : item,
        ),
      );
    if (location === deletedName) {
      setLocation("all");
      setSection("Home");
      setOpenedContainer(null);
    }
    setNotice(
      hasItems
        ? `${deletedName} deleted; items moved to ${moveDestination}`
        : `${deletedName} deleted`,
    );
    closePlaceForm();
  }

  function selectItem(item: Item) {
    setSelectedId(item.id);
    setDetailsOpen(true);
    setChatOpen(false);
    setEditing(false);
    setNameError("");
    setShowTagSuggestions(false);
  }

  async function addItem(parentId?: string) {
    const id = crypto.randomUUID();
    const parent = parentId
      ? items.find((item) => item.id === parentId)
      : undefined;
    const locationName =
      parent?.location_name ??
      (location === "all" ? (locations[0]?.name ?? "Home") : location);
    const locationId =
      locations.find(
        (entry) => entry.name.toLowerCase() === locationName.toLowerCase(),
      )?.id ?? null;
    if (storageMode === "saved" && !parent && !locationId) {
      setNotice("Create a place before adding a root item");
      return;
    }
    const created: VisualItem = {
      ...seedItems[7],
      id,
      name: "New item",
      description: "Add a few details so this item is easy to find later.",
      tags: [],
      location_id: parent ? null : locationId,
      parent_container_id: parentId ?? null,
      location_name: locationName,
      created_at: now(),
      updated_at: now(),
      version: 1,
    };
    const result = await createItem(created);
    if (!result) {
      setNotice("Could not save the new item");
      return;
    }
    setSelectedId(result.id);
    setDetailsOpen(true);
    setQuery("");
    setKind("all");
    setEditName(created.name);
    setNameError("");
    setEditing(true);
    setNotice(parent ? `New item added to ${parent.name}` : "New item added");
  }

  async function addContainer(parentId?: string) {
    const id = crypto.randomUUID();
    const parent = parentId
      ? items.find((item) => item.id === parentId)
      : undefined;
    const locationName =
      parent?.location_name ??
      (location === "all" ? (locations[0]?.name ?? "Home") : location);
    const locationId =
      locations.find(
        (entry) => entry.name.toLowerCase() === locationName.toLowerCase(),
      )?.id ?? null;
    if (storageMode === "saved" && !parent && !locationId) {
      setNotice("Create a place before adding a root container");
      return;
    }
    const created: VisualItem = {
      ...seedContainers[0],
      id,
      name: "New container",
      description: "Add a name so this container is easy to find later.",
      tags: [],
      location_id: parent ? null : locationId,
      parent_container_id: parentId ?? null,
      location_name: locationName,
      created_at: now(),
      updated_at: now(),
      version: 1,
    };
    const result = await createItem(created);
    if (!result) {
      setNotice("Could not save the new container");
      return;
    }
    setSelectedId(result.id);
    setDetailsOpen(true);
    setQuery("");
    setKind("all");
    setEditName(created.name);
    setNameError("");
    setEditing(true);
    setNotice(
      parent ? `New container added to ${parent.name}` : "New container added",
    );
  }

  async function removeSelected() {
    if (!selected) return;
    if (
      selected.kind === "container" &&
      items.some((item) => item.parent_container_id === selected.id)
    ) {
      setNotice("Move the contents before deleting this container");
      return;
    }
    const remaining = items.filter((item) => item.id !== selected.id);
    const removed = await removeItem(selected.id);
    if (removed !== true) return;
    setSelectedId(remaining[0]?.id ?? "");
    setEditing(false);
    setNotice(`${selected.name} deleted`);
  }

  async function duplicateSelected() {
    if (!selected) return;
    const id = crypto.randomUUID();
    const duplicate: VisualItem = {
      ...duplicateInventoryItem(selected, id, now()),
      image: selected.image,
    };
    const result = await createItem(duplicate);
    if (!result) {
      setNotice("Could not save the duplicate");
      return;
    }
    setSelectedId(result.id);
    setDetailsOpen(true);
    setEditName(duplicate.name);
    setNameError("");
    setEditing(true);
    setNotice(`${selected.name} duplicated`);
  }

  return (
    <main className={styles.shell}>
      <div className={styles.workspace}>
        <aside
          className={`${styles.rail} ${mobileNav ? styles.mobileNavOpen : ""}`}
        >
          <header className={styles.brand}>
            <span className={styles.brandIcon}>
              <Package weight="bold" />
            </span>
            <span>Inventory</span>
            <button
              className={styles.mobileClose}
              onClick={() => setMobileNav(false)}
              aria-label="Close navigation"
            >
              <X />
            </button>
          </header>
          <nav className={styles.primaryNav} aria-label="Main navigation">
            {[
              { label: "Home", Icon: House },
              { label: "Spaces", Icon: Buildings },
              { label: "All items", Icon: List },
              { label: "Favorites", Icon: Star },
              { label: "Missing", Icon: MagnifyingGlass },
              { label: "Tags", Icon: Tag },
            ].map(({ label, Icon }) => (
              <button
                key={label}
                className={section === label ? styles.activeNav : ""}
                aria-pressed={section === label}
                onClick={() => navigate(label)}
              >
                <Icon
                  weight={
                    section === label && label === "Home" ? "fill" : "regular"
                  }
                />
                <span>{label}</span>
                {label === "All items" && (
                  <small aria-hidden="true">
                    {items.filter((item) => item.kind !== "container").length}
                  </small>
                )}
              </button>
            ))}
          </nav>
          <div className={styles.spaceHeading}>
            <span>Spaces</span>
            <button
              ref={addPlaceButton}
              onClick={openAddPlace}
              aria-label="Add place"
              aria-expanded={addingPlace}
            >
              <Plus />
            </button>
          </div>
          <nav className={styles.spaceNav} aria-label="Inventory locations">
            <button
              className={styles.homeSpace}
              onClick={() => navigate("Home")}
            >
              <CaretDown />
              <House weight="fill" />
              <span>Home</span>
            </button>
            <div className={styles.roomTree}>
              {(storageMode === "saved"
                ? locations.map((place) => place.name)
                : places
                    .filter((place) =>
                      [
                        "Bedroom",
                        "Bathroom",
                        "Kitchen",
                        "Living Room",
                      ].includes(place.name),
                    )
                    .map((place) => place.name)
              ).map((room) => (
                <button
                  key={room}
                  aria-pressed={location === room}
                  className={location === room ? styles.activeRoom : ""}
                  onClick={() => navigate(room, room)}
                >
                  <Folder />
                  <span>{room}</span>
                </button>
              ))}
              {location === "Bedroom" &&
                items
                  .filter(
                    (item) =>
                      item.kind === "container" &&
                      item.location_name === "Bedroom",
                  )
                  .map((container) => (
                    <button
                      key={container.id}
                      className={styles.containerNav}
                      onClick={() => {
                        setOpenedContainer(container.id);
                        setKind("all");
                      }}
                    >
                      <Archive />
                      <span>{container.name}</span>
                    </button>
                  ))}
            </div>
            {navigation
              .filter(
                (entry) => entry.value !== "all" && storageMode !== "saved",
              )
              .map(({ label, value, Icon, icon, color, place }) => (
                <button
                  key={value}
                  className={location === value ? styles.activeNav : ""}
                  data-place-icon={icon}
                  style={
                    color
                      ? ({ "--place-color": color } as CSSProperties)
                      : undefined
                  }
                  onClick={() => navigate(label, value)}
                  onDoubleClick={() => place && openEditPlace(place)}
                  aria-pressed={location === value}
                  title={place ? `Double-click to edit ${label}` : undefined}
                >
                  <Icon />
                  <span>{label}</span>
                  <CaretRight className={styles.navChevron} />
                </button>
              ))}
            {storageMode === "sample" && (
              <button
                onClick={() => {
                  navigate("Travel");
                  setTagFilter("travel");
                }}
              >
                <AirplaneTilt />
                <span>Travel</span>
                <CaretRight className={styles.navChevron} />
              </button>
            )}
          </nav>
          <div className={styles.sidebarBottom}>
            <button
              className={styles.jarvisLauncher}
              onClick={() => {
                setChatOpen(true);
                setDetailsOpen(false);
              }}
              aria-label="Open Jarvis"
            >
              <Sparkle weight="fill" />
              <span>Ask Jarvis</span>
              <kbd>AI</kbd>
            </button>
            <div className={styles.profileRow}>
              <span
                className={styles.profile}
                title={accountEmail ?? "Sample workspace"}
              >
                {accountEmail ? accountEmail.slice(0, 2).toUpperCase() : "JH"}
              </span>
              <details className={styles.settings}>
                <summary>
                  <GearSix />
                  <span>Settings</span>
                </summary>
                <div>
                  {accountControls ?? <span>Sample workspace</span>}
                  <small>
                    {storageMode === "saved"
                      ? "Your private inventory"
                      : "Explore with sample items"}
                  </small>
                </div>
              </details>
            </div>
          </div>
        </aside>
        {mobileNav && (
          <button
            className={styles.mobileScrim}
            aria-label="Dismiss navigation"
            onClick={() => setMobileNav(false)}
          />
        )}

        <section
          className={`${styles.library} ${query ? styles.searching : ""}`}
        >
          {spacesLanding && (
            <button
              className={styles.mobileMenu}
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <List />
            </button>
          )}
          {!spacesLanding && (
            <>
              <div className={styles.toolbar}>
                <button
                  className={styles.mobileMenu}
                  onClick={() => setMobileNav(true)}
                  aria-label="Open navigation"
                >
                  <List />
                </button>
                <label className={styles.search}>
                  <MagnifyingGlass />
                  <input
                    ref={searchInput}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setOpenedContainer(null);
                      setSearchTab("All results");
                    }}
                    placeholder="Search items, locations, or ask Jarvis..."
                    aria-label="Search items"
                  />
                  {query ? (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                    >
                      <X />
                    </button>
                  ) : (
                    <kbd>⌘ K</kbd>
                  )}
                </label>
                <button
                  className={styles.addItem}
                  aria-label="Add item"
                  onClick={() => addItem(openedContainer ?? undefined)}
                >
                  <Plus /> <span>Add item</span>
                </button>
                <button
                  className={styles.filterButton}
                  aria-label="More filters"
                  aria-expanded={filterOpen}
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <SlidersHorizontal />
                </button>
              </div>

              {query && (
                <div className={styles.searchTabs} aria-label="Search views">
                  {[
                    "All results",
                    "Items",
                    "Locations",
                    "Containers",
                    "Ask Jarvis",
                  ].map((label) => (
                    <button
                      key={label}
                      aria-pressed={searchTab === label}
                      onClick={() => {
                        if (label === "Ask Jarvis") {
                          setPromptRequest({ text: query, id: Date.now() });
                          setChatOpen(true);
                          setDetailsOpen(false);
                        } else setSearchTab(label);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <nav
                className={styles.breadcrumb}
                aria-label="Inventory breadcrumb"
              >
                <button onClick={() => navigate("Home")}>
                  <House weight="fill" />
                  <span>Home</span>
                </button>
                {(section !== "Home" || currentContainer) && (
                  <>
                    <CaretRight />
                    <button onClick={() => setOpenedContainer(null)}>
                      {currentContainer?.location_name ?? section}
                    </button>
                  </>
                )}
                {containerChain.map((container) => (
                  <span key={container.id}>
                    <CaretRight />
                    <button onClick={() => setOpenedContainer(container.id)}>
                      {container.name}
                    </button>
                  </span>
                ))}
                {query && (
                  <>
                    <CaretRight />
                    <span>Search results</span>
                  </>
                )}
              </nav>

              <div className={styles.filterbar}>
                <GlassSelect
                  label="Category"
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: "all", label: "Category" },
                    ...categories.map((value) => ({ value, label: value })),
                  ]}
                />
                <GlassSelect
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "all", label: "Status" },
                    { value: "active", label: "Active" },
                    { value: "stored", label: "Stored" },
                    { value: "lent", label: "Lent" },
                    { value: "lost", label: "Missing" },
                  ]}
                />
                {view === "list" && (
                  <GlassSelect
                    label="Location"
                    value={location}
                    onChange={(value) => {
                      setLocation(value);
                      setOpenedContainer(null);
                    }}
                    options={[
                      { value: "all", label: "Location" },
                      ...locationOptions.map((value) => ({
                        value,
                        label: value,
                      })),
                    ]}
                  />
                )}
                <GlassSelect
                  label="Sort"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "recent", label: "Sort: Recently updated" },
                    { value: "name", label: "Sort: Name" },
                    { value: "quantity", label: "Sort: Quantity" },
                  ]}
                />
                <div className={styles.viewToggle} aria-label="View style">
                  <button
                    className={view === "grid" ? styles.selectedToggle : ""}
                    onClick={() => setView("grid")}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                  >
                    <SquaresFour weight="fill" />
                    <span>Grid</span>
                  </button>
                  <button
                    className={view === "list" ? styles.selectedToggle : ""}
                    onClick={() => setView("list")}
                    aria-label="List view"
                    aria-pressed={view === "list"}
                  >
                    <List />
                    <span>List</span>
                  </button>
                </div>
              </div>
              {filterOpen && (
                <div className={styles.extraFilters}>
                  <GlassSelect
                    label="Filter items"
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "all", label: "All items" },
                      { value: "durable", label: "Durable" },
                      { value: "consumable", label: "Consumable" },
                      { value: "container", label: "Containers" },
                      { value: "low", label: "Low stock" },
                    ]}
                  />
                  <button
                    className={styles.addContainer}
                    onClick={() => addContainer(openedContainer ?? undefined)}
                  >
                    <Folder /> Add container
                  </button>
                  <button
                    onClick={() => {
                      setCategory("all");
                      setStatus("all");
                      setKind("all");
                      setTagFilter("");
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
              {kind !== "all" && (
                <button
                  className={styles.activeFilter}
                  onClick={() => setKind("all")}
                  aria-label="Clear item filter"
                >
                  {kind === "low" ? "Low stock" : kind}
                  <X />
                </button>
              )}
              {section === "Tags" && (
                <div className={styles.tagBrowser}>
                  {allPastTags.map((tag) => (
                    <button
                      key={tag}
                      aria-pressed={tagFilter === tag}
                      onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                    >
                      <Tag />
                      {tag}
                      <small>
                        {items.filter((item) => item.tags.includes(tag)).length}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className={query ? styles.searchLayout : undefined}>
            <div className={styles.resultsContent}>
              {spacesLanding && (
                <SpacesBrowser
                  spaces={managedPlaces}
                  items={items}
                  onOpen={(name) => navigate(name, name)}
                  onAdd={openAddPlace}
                  onEdit={(name) => {
                    const place = managedPlaces.find(
                      (place) => place.name === name,
                    );
                    if (place) openEditPlace(place);
                  }}
                  onDelete={(name) => {
                    const place = managedPlaces.find(
                      (place) => place.name === name,
                    );
                    if (place) {
                      openEditPlace(place);
                      setDeletingPlace(true);
                    }
                  }}
                />
              )}
              {spacesLanding && (
                <h2 className={styles.spaceContainersTitle}>Containers</h2>
              )}
              {query && (
                <h2 className={styles.resultsTitle}>
                  {searchTab === "All results" ? "Items" : searchTab}{" "}
                  <span>
                    (
                    {searchTab === "Locations"
                      ? locationOptions.filter((name) =>
                          name.toLowerCase().includes(query.toLowerCase()),
                        ).length
                      : filtered.filter((item) =>
                          searchTab === "Containers"
                            ? item.kind === "container"
                            : item.kind !== "container",
                        ).length}
                    )
                  </span>
                </h2>
              )}
              {query && searchTab === "Locations" ? (
                <div className={styles.locationResults}>
                  {locationOptions
                    .filter((name) =>
                      name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((name) => (
                      <button key={name} onClick={() => navigate(name, name)}>
                        <Folder />
                        <span>{name}</span>
                        <CaretRight />
                      </button>
                    ))}
                </div>
              ) : (
                <ContainerGrid
                  items={items}
                  visible={
                    query && searchTab === "Containers"
                      ? filtered.filter((item) => item.kind === "container")
                      : visibleItems
                  }
                  sort={sort}
                  selectedId={detailsOpen ? selected?.id : undefined}
                  view={query ? "list" : view}
                  opened={openedContainer}
                  onOpen={(id) => {
                    setOpenedContainer(id);
                    if (id) {
                      setKind("all");
                      setQuery("");
                    }
                  }}
                  showContainers={
                    (query && searchTab === "Containers") ||
                    section === "Spaces" ||
                    kind === "container" ||
                    location !== "all"
                  }
                  queryActive={
                    Boolean(query.trim()) ||
                    kind !== "all" ||
                    location !== "all"
                  }
                  onSelect={selectItem}
                  onAddItem={addItem}
                  onAddContainer={addContainer}
                />
              )}
            </div>
            {query && (
              <aside className={styles.searchSuggestions}>
                <h3>Suggested</h3>
                {[
                  "Where are my camera accessories?",
                  "Show the items in my cabinet.",
                  "What do I have for camping?",
                  "Add a camera battery to my backpack.",
                ].map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      setPromptRequest({ text: question, id: Date.now() });
                      setChatOpen(true);
                      setDetailsOpen(false);
                    }}
                  >
                    <Sparkle />
                    <span>{question}</span>
                  </button>
                ))}
              </aside>
            )}
          </div>
          {filtered.length === 0 && searchTab !== "Locations" && (
            <div className={styles.emptyState}>
              <Cube weight="duotone" />
              <strong>
                {storageMode === "saved" && !items.length
                  ? "Your inventory starts here"
                  : "No items found"}
              </strong>
              <span>
                {storageMode === "saved" && !items.length
                  ? "Create a place, then add your first item and photo."
                  : "Try a different search or filter."}
              </span>
              {storageMode === "saved" &&
                !items.length &&
                !locations.length && (
                  <button className={styles.addItem} onClick={openAddPlace}>
                    Create your first place
                  </button>
                )}
            </div>
          )}
          <footer className={styles.libraryFooter}>
            {previewHome &&
              filtered.filter((item) => item.kind !== "container").length >
                17 && (
                <button
                  className={styles.viewAll}
                  onClick={() => navigate("All items")}
                >
                  View all items <CaretRight />
                </button>
              )}
            <span>
              {previewHome &&
              filtered.filter((item) => item.kind !== "container").length > 17
                ? `Showing ${visibleItems.length} of `
                : ""}
              {
                (openedContainer
                  ? filtered.filter(
                      (item) => item.parent_container_id === openedContainer,
                    )
                  : section === "Spaces"
                    ? filtered
                    : filtered.filter((item) => item.kind !== "container")
                ).length
              }{" "}
              items
            </span>
            <span role="status">{storeError || notice}</span>
            <span className={styles.storageLabel}>
              <span className={styles.liveDot} />
              {storageMode === "saved"
                ? "Saved inventory"
                : "Local sample data"}
            </span>
          </footer>
        </section>
        {(detailsOpen || chatOpen) && (
          <button
            className={styles.panelScrim}
            aria-label="Dismiss panel"
            onClick={() => {
              setDetailsOpen(false);
              setChatOpen(false);
            }}
          />
        )}
        <div className={styles.detailColumn}>
          {detailsOpen && (
            <aside
              ref={detailRef}
              className={styles.details}
              aria-label="Item details"
            >
              <button
                className={styles.closeDetails}
                aria-label="Close item details"
                title="Close item details"
                onClick={() => setDetailsOpen(false)}
              >
                ×
              </button>
              {selected ? (
                <>
                  <div className={styles.detailHero}>
                    <div className={styles.detailImage}>
                      <Image
                        src={selected.image}
                        unoptimized={selected.image.startsWith("/api/items/")}
                        alt={selected.name}
                        fill
                        sizes="220px"
                        priority
                      />
                      <label
                        className={`${styles.photoOverlay} ${uploadingPhoto ? styles.photoUploading : ""}`}
                        title="Click to change photo"
                      >
                        <div className={styles.photoOverlayIcon}>
                          <Camera aria-hidden="true" weight="bold" />
                        </div>
                        <span className={styles.photoOverlayText}>
                          {uploadingPhoto ? "Saving…" : "Change photo"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="Upload item photo"
                          disabled={uploadingPhoto}
                          aria-describedby="photo-help"
                          onChange={(event) => {
                            uploadPhoto(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <div className={styles.detailTitle}>
                      <input
                        value={editing ? editName : selected.name}
                        readOnly={!editing}
                        onBlur={finishEditing}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        onFocus={() => {
                          if (!editing) startEditing();
                        }}
                        onChange={(event) => {
                          setEditName(event.target.value);
                          if (nameError) setNameError("");
                        }}
                        aria-label="Item name"
                        aria-invalid={Boolean(nameError)}
                        aria-describedby={
                          nameError ? "item-name-error" : undefined
                        }
                      />
                      {nameError && (
                        <p
                          id="item-name-error"
                          className={styles.nameError}
                          role="alert"
                        >
                          {nameError}
                        </p>
                      )}
                      <span>
                        {selected.kind === "container" ? (
                          <Folder weight="duotone" />
                        ) : (
                          <Cube weight="duotone" />
                        )}{" "}
                        {selected.category ||
                          (selected.kind === "container"
                            ? "Container"
                            : "Uncategorized")}
                      </span>
                    </div>
                    <div className={styles.moreMenuWrap}>
                      <button
                        className={styles.editButton}
                        onClick={editing ? finishEditing : startEditing}
                      >
                        <PencilSimple />
                        {editing ? "Done" : "Edit"}
                      </button>
                      <button
                        className={`${styles.moreButton} ${styles.favoriteButton}`}
                        aria-label="Favorite item"
                        aria-pressed={selected.tags.includes("favorite")}
                        title={
                          selected.tags.includes("favorite")
                            ? "Remove favorite"
                            : "Favorite item"
                        }
                        onClick={() =>
                          patchSelected({
                            tags: selected.tags.includes("favorite")
                              ? selected.tags.filter(
                                  (tag) => tag !== "favorite",
                                )
                              : [...selected.tags, "favorite"],
                          })
                        }
                      >
                        <Star
                          weight={
                            selected.tags.includes("favorite")
                              ? "fill"
                              : "regular"
                          }
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        className={styles.moreButton}
                        aria-label="Duplicate item"
                        title="Duplicate item"
                        onClick={duplicateSelected}
                      >
                        <Copy weight="regular" aria-hidden="true" />
                      </button>
                      <button
                        className={`${styles.moreButton} ${styles.deleteItemButton}`}
                        aria-label="Delete item"
                        title="Delete item"
                        onClick={removeSelected}
                      >
                        <Trash weight="regular" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <p id="photo-help" className={styles.photoHelp}>
                    JPG, PNG, or WebP · Up to 5 MB ·{" "}
                    {storageMode === "saved"
                      ? "Private · Saved to your account"
                      : "Sample photo · Saved for this session"}
                  </p>
                  {photoError?.itemId === selected.id && (
                    <p className={styles.nameError} role="alert">
                      {photoError.message}
                    </p>
                  )}
                  <div className={styles.detailRows}>
                    <div className={`${styles.fieldRow} ${styles.quantityRow}`}>
                      <span className={styles.fieldLabel}>
                        <Package weight="duotone" /> Quantity
                      </span>
                      <div className={styles.stepper}>
                        <button
                          disabled={
                            selected.kind === "container" ||
                            selected.quantity === 0
                          }
                          onClick={() =>
                            patchSelected({
                              quantity: Math.max(0, selected.quantity - 1),
                            })
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus weight="bold" />
                        </button>
                        <span>{selected.quantity}</span>
                        <button
                          disabled={
                            selected.kind === "container" ||
                            selected.quantity === 1_000_000_000
                          }
                          onClick={() =>
                            patchSelected({
                              quantity: Math.min(
                                1_000_000_000,
                                selected.quantity + 1,
                              ),
                            })
                          }
                          aria-label="Increase quantity"
                        >
                          <Plus weight="bold" />
                        </button>
                      </div>
                      <span className={styles.unit}>{selected.unit}</span>
                    </div>

                    <label className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>
                        <Tag weight="duotone" /> Category
                      </span>
                      <input
                        readOnly={!editing}
                        onFocus={() => {
                          if (!editing) startEditing();
                        }}
                        onClick={() => {
                          if (!editing) startEditing();
                        }}
                        value={selected.category}
                        onChange={(event) =>
                          patchSelected({ category: event.target.value })
                        }
                      />
                    </label>

                    <label className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>
                        <MapPin weight="fill" /> Location
                      </span>
                      <GlassSelect
                        label="Item location"
                        value={placementValue}
                        options={placementOptions}
                        icon={
                          selected.parent_container_id ? (
                            <Folder weight="fill" />
                          ) : (
                            <MapPin weight="fill" />
                          )
                        }
                        compact
                        onFocus={() => {
                          if (!editing) startEditing();
                        }}
                        onChange={(value) => {
                          if (value.startsWith("container:")) {
                            patchSelected({
                              parent_container_id: value.slice(
                                "container:".length,
                              ),
                            });
                            return;
                          }
                          const name = value.slice("location:".length);
                          patchSelected({ location_name: name });
                        }}
                      />
                    </label>

                    <div className={styles.tagRow}>
                      <span className={styles.fieldLabel}>
                        <Tag weight="fill" /> Tags
                      </span>
                      <div>
                        {selected.tags.map((tag) => (
                          <button
                            key={tag}
                            onFocus={() => {
                              if (!editing) startEditing();
                            }}
                            onClick={() => {
                              if (!editing) {
                                startEditing();
                                return;
                              }
                              patchSelected({
                                tags: selected.tags.filter(
                                  (entry) => entry !== tag,
                                ),
                              });
                            }}
                          >
                            {tag}
                            {editing && " ×"}
                          </button>
                        ))}
                        <form
                          key={selected.id}
                          ref={tagFormRef}
                          className={styles.addTagForm}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const tag = (
                              tagDraft.itemId === selected.id
                                ? tagDraft.value
                                : ""
                            ).trim();
                            if (!tag) return;
                            addTag(tag);
                            setShowTagSuggestions(false);
                          }}
                        >
                          <input
                            name="tag"
                            value={
                              tagDraft.itemId === selected.id
                                ? tagDraft.value
                                : ""
                            }
                            onFocus={() => {
                              setShowTagSuggestions(true);
                            }}
                            onClick={() => setShowTagSuggestions(true)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                setShowTagSuggestions(false);
                              }
                            }}
                            onChange={(event) => {
                              setTagDraft({
                                itemId: selected.id,
                                value: event.target.value,
                              });
                              setShowTagSuggestions(true);
                            }}
                            aria-label="New tag"
                            placeholder="Add tag…"
                            autoComplete="off"
                          />
                          <button
                            type="submit"
                            aria-label="Add tag"
                            title="Add tag"
                          >
                            <Plus weight="bold" aria-hidden="true" />
                          </button>

                          {showTagSuggestions && (
                            <div
                              className={styles.tagSuggestions}
                              role="region"
                              aria-label="Past tags"
                            >
                              <div className={styles.tagSuggestionsHeader}>
                                <span>
                                  {currentTagDraft.trim()
                                    ? "Matching tags"
                                    : "Past tags"}
                                </span>
                                {availablePastTags.length > 0 && (
                                  <span className={styles.tagSuggestionsCount}>
                                    {availablePastTags.length}
                                  </span>
                                )}
                              </div>
                              {availablePastTags.length > 0 ? (
                                <div className={styles.tagSuggestionsList}>
                                  {availablePastTags.map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      className={styles.tagSuggestionChip}
                                      aria-label={`Select tag ${tag}`}
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                      }}
                                      onClick={() => {
                                        addTag(tag);
                                        setShowTagSuggestions(false);
                                      }}
                                    >
                                      <Tag weight="bold" aria-hidden="true" />
                                      <span>{tag}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className={styles.tagSuggestionsEmpty}>
                                  {currentTagDraft.trim()
                                    ? `No matching past tags — click + to add "${currentTagDraft.trim()}"`
                                    : "No other past tags available"}
                                </p>
                              )}
                            </div>
                          )}
                        </form>
                      </div>
                    </div>

                    <label className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>
                        <CheckCircle />
                        Condition
                      </span>
                      <GlassSelect
                        label="Item condition"
                        compact
                        value={selected.condition}
                        onChange={(value) =>
                          patchSelected({ condition: value })
                        }
                        options={[
                          { value: "new", label: "Like new" },
                          { value: "good", label: "Good" },
                          { value: "fair", label: "Fair" },
                          { value: "poor", label: "Poor" },
                          { value: "unknown", label: "Unknown" },
                        ]}
                      />
                    </label>
                    <label className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>
                        <Archive />
                        Status
                      </span>
                      <GlassSelect
                        label="Item status"
                        compact
                        value={selected.status}
                        onChange={(value) => patchSelected({ status: value })}
                        options={[
                          { value: "active", label: "Active" },
                          { value: "stored", label: "Stored" },
                          { value: "lent", label: "Lent" },
                          { value: "lost", label: "Missing" },
                          { value: "disposed", label: "Disposed" },
                        ]}
                      />
                    </label>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>
                        <CalendarBlank />
                        Added
                      </span>
                      <span className={styles.dateValue}>
                        {new Date(selected.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          },
                        )}
                      </span>
                    </div>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>
                        <Clock />
                        Last updated
                      </span>
                      <span className={styles.dateValue}>
                        {new Date(selected.updated_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          },
                        )}
                      </span>
                    </div>
                    <label className={styles.notesRow}>
                      <span>Notes</span>
                      <textarea
                        placeholder="Add a description…"
                        value={selected.description}
                        onFocus={() => {
                          if (!editing) startEditing();
                        }}
                        onChange={(event) =>
                          patchSelected({ description: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  {relatedItems.length > 0 && (
                    <section className={styles.related}>
                      <h3>Related items</h3>
                      <div>
                        {relatedItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => selectItem(item)}
                          >
                            <Image
                              src={item.image}
                              alt=""
                              width={100}
                              height={80}
                              unoptimized={item.image.startsWith("/api/items/")}
                            />
                            <strong>{item.name}</strong>
                            <span>{item.category}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className={styles.noSelection}>
                  <Package weight="duotone" />
                  <span>Add an item to get started.</span>
                </div>
              )}
            </aside>
          )}
          <div ref={chatRef} className={styles.chatPanel} hidden={!chatOpen}>
            <button
              className={styles.closeChat}
              aria-label="Close Jarvis"
              onClick={() => setChatOpen(false)}
            >
              <X />
            </button>
            <JarvisChat
              promptRequest={promptRequest}
              items={items}
              saved={storageMode === "saved"}
              onApplyChanges={(changes, versions) =>
                store.applyChanges(changes, versions, locationOptions)
              }
              onSelect={(id) => {
                setSelectedId(id);
                setDetailsOpen(true);
                setChatOpen(false);
                setEditing(false);
              }}
            />
          </div>
        </div>
      </div>

      {addingPlace && (
        <div
          className={`${styles.placeOverlay} ${!deletingPlace ? styles.spaceDrawerOverlay : ""}`}
        >
          <div
            className={`${styles.placeDialog} ${!deletingPlace ? styles.spaceDrawer : styles.spaceDeleteDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="place-dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !savingPlace) closePlaceForm();
              if (event.key === "Tab") {
                const controls = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
                  ),
                );
                const first = controls[0],
                  last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <form
              onSubmit={
                deletingPlace
                  ? (event) => {
                      event.preventDefault();
                      void deletePlace();
                    }
                  : createPlace
              }
            >
              <fieldset
                disabled={savingPlace}
                className={styles.spaceFormFields}
              >
                <div className={styles.placeDialogHeader}>
                  <div>
                    <span className={styles.dialogEyebrow}>
                      {editingPlace ? "Edit space" : "New space"}
                    </span>
                    <h2 id="place-dialog-title">
                      {deletingPlace
                        ? `Delete ${editingPlace?.name}?`
                        : editingPlace
                          ? "Edit space"
                          : "Add space"}
                    </h2>
                    <p>
                      {deletingPlace
                        ? "This removes only the space. Its items and containers will be kept."
                        : editingPlace
                          ? "Update this space’s name, icon, or color."
                          : "Give this space a name and a little personality."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.dialogClose}
                    aria-label="Close place dialog"
                    onClick={closePlaceForm}
                  >
                    <X size={18} />
                  </button>
                </div>

                {deletingPlace ? (
                  <label
                    className={styles.placeNameField}
                    htmlFor="move-destination"
                  >
                    <span>Move items to</span>
                    <select
                      autoFocus
                      id="move-destination"
                      value={moveDestination}
                      onChange={(event) =>
                        setMoveDestination(event.target.value)
                      }
                    >
                      <option value="">Choose a space</option>
                      {locationOptions
                        .filter((name) => name !== editingPlace?.name)
                        .map((name) => (
                          <option key={name}>{name}</option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <div className={styles.spaceIconPreview}>
                      <span
                        style={{
                          color: placeColorOptions.find(
                            (option) => option.value === placeColor,
                          )?.color,
                        }}
                      >
                        {(() => {
                          const PreviewIcon =
                            placeIconOptions.find(
                              (option) => option.value === placeIcon,
                            )?.Icon ?? MapPin;
                          return <PreviewIcon weight="duotone" />;
                        })()}
                      </span>
                      {storageMode === "sample" && (
                        <button
                          type="button"
                          aria-expanded={iconChoicesOpen}
                          onClick={() => setIconChoicesOpen(!iconChoicesOpen)}
                        >
                          <GearSix />
                          Change icon
                        </button>
                      )}
                    </div>
                    <label
                      className={styles.placeNameField}
                      htmlFor="place-name"
                    >
                      <span>Place name</span>
                      <input
                        id="place-name"
                        autoFocus
                        maxLength={80}
                        value={placeName}
                        placeholder="e.g. Garage"
                        aria-invalid={Boolean(placeError)}
                        aria-describedby={
                          placeError ? "place-error" : undefined
                        }
                        onChange={(event) => {
                          setPlaceName(event.target.value);
                          setPlaceError("");
                        }}
                      />
                    </label>

                    {storageMode === "sample" && iconChoicesOpen && (
                      <>
                        <fieldset className={styles.placeChoices}>
                          <legend>Choose an icon</legend>
                          <div className={styles.choiceGrid}>
                            {placeIconOptions.map((option) => {
                              const OptionIcon = option.Icon;
                              return (
                                <label
                                  key={option.value}
                                  className={styles.choiceCard}
                                >
                                  <input
                                    type="radio"
                                    name="place-icon"
                                    value={option.value}
                                    aria-label={option.label}
                                    checked={placeIcon === option.value}
                                    onChange={() => setPlaceIcon(option.value)}
                                  />
                                  <OptionIcon
                                    weight="duotone"
                                    aria-hidden="true"
                                  />
                                  <span>{option.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>

                        <fieldset className={styles.placeChoices}>
                          <legend>Highlight color</legend>
                          <div className={styles.colorChoices}>
                            {placeColorOptions.map((option) => (
                              <label
                                key={option.value}
                                className={styles.colorChoice}
                              >
                                <input
                                  type="radio"
                                  name="place-color"
                                  value={option.value}
                                  aria-label={option.label}
                                  checked={placeColor === option.value}
                                  onChange={() => setPlaceColor(option.value)}
                                />
                                <span
                                  className={styles.colorSwatch}
                                  style={
                                    {
                                      "--swatch": option.color,
                                    } as CSSProperties
                                  }
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </>
                    )}
                  </>
                )}
                {placeError && (
                  <p
                    id="place-error"
                    className={styles.placeError}
                    role="alert"
                  >
                    {placeError}
                  </p>
                )}
                <div className={styles.placeDialogActions}>
                  {editingPlace && !deletingPlace && (
                    <button
                      type="button"
                      className={styles.dialogDelete}
                      aria-label="Delete place"
                      onClick={() => setDeletingPlace(true)}
                    >
                      Delete place
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.dialogCancel}
                    aria-label={
                      editingPlace
                        ? "Cancel editing place"
                        : "Cancel adding place"
                    }
                    onClick={closePlaceForm}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.dialogCreate}>
                    {editingPlace ? (
                      <Check weight="bold" />
                    ) : (
                      <Plus weight="bold" />
                    )}
                    {savingPlace
                      ? "Saving…"
                      : deletingPlace
                        ? "Confirm deletion"
                        : editingPlace
                          ? "Save changes"
                          : "Create place"}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
