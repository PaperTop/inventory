"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
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
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Item, Location } from "@/lib/inventory";
import { containerDestinations } from "@/lib/containers";
import { apiRepository } from "@/lib/browser-api";
import { validatePhotoFile } from "@/lib/photos";
import {
  duplicateInventoryItem,
  filterInventory,
  type InventoryViewOptions,
} from "@/lib/presentation";
import styles from "./liquid-dashboard.module.css";
import { ContainerGrid } from "./container-grid";
import { JarvisChat } from "./jarvis-chat";
import { GlassSelect } from "./glass-select";
import {
  useInventoryStore,
  visualItem,
  type VisualItem,
} from "./use-inventory-store";

const owner = "11111111-1111-4111-8111-111111111111";
const baseDate = "2026-09-14T07:24:00.000Z";
const persistenceAvailable = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const seedItems: VisualItem[] = [
  {
    id: "backpack",
    user_id: owner,
    name: "Backpack",
    kind: "durable",
    description: "Main backpack for school and travel. Fits a 15-inch laptop.",
    category: "Everyday carry",
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
    image: "/inventory-assets/item.svg",
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
    image: "/inventory-assets/container.svg",
  },
];

const seedAccessories: VisualItem[] = [
  {
    id: "tripod",
    name: "Travel tripod",
    description:
      "Compact tripod for steady camera shots. Check the mount before use.",
  },
  {
    id: "sd-card",
    name: "SD memory card",
    description:
      "Spare 64 GB SD card for photography. Check camera compatibility.",
  },
].map((accessory) => ({
  ...seedItems[0],
  ...accessory,
  category: "Camera accessories",
  location_name: "Bedroom",
  parent_container_id: "drawer",
  tags: ["photography", "camera accessories"],
  attributes: {},
  image: "/inventory-assets/item.svg",
}));

const initialItems = [...seedItems, ...seedContainers, ...seedAccessories];

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

const initialLocationOptions = ["Home", "Bedroom", "College", "Car"] as const;

const placeIconOptions = [
  { value: "MapPin", label: "Pin", Icon: MapPin },
  { value: "Camera", label: "Camera", Icon: Camera },
  { value: "Briefcase", label: "Briefcase", Icon: Briefcase },
  { value: "Archive", label: "Archive", Icon: Archive },
  { value: "Garage", label: "Garage", Icon: Garage },
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

export function LiquidDashboard() {
  const [storageMode, setStorageMode] = useState<
    "sample" | "loading" | "saved"
  >(persistenceAvailable ? "loading" : "sample");
  const [locations, setLocations] = useState<Location[]>([]);
  const store = useInventoryStore(
    initialItems,
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
  const storeRef = useRef(store);
  const [loadingError, setLoadingError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<{
    itemId: string;
    message: string;
  } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
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
      : [...initialLocationOptions, ...places.map((place) => place.name)];
  const navigation = [
    ...navItems,
    ...(storageMode === "saved"
      ? locations
          .filter(
            (location) =>
              !navItems.some((item) => item.label === location.name),
          )
          .map((location) => ({
            label: location.name,
            value: location.name,
            Icon: MapPin,
            color: undefined,
            icon: undefined,
            place: undefined,
          }))
      : []),
    ...places.map((place) => ({
      label: place.name,
      value: place.name,
      Icon: place.Icon,
      color: place.color,
      icon: place.icon,
      place,
    })),
  ];
  const [selectedId, setSelectedId] = useState(seedItems[0].id);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [query, setQuery] = useState("");
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
    persistenceAvailable
      ? "Loading saved inventory…"
      : "Sample inventory is ready",
  );

  useEffect(() => {
    if (!persistenceAvailable) return;
    let cancelled = false;
    Promise.all([apiRepository.list(""), apiRepository.locations()])
      .then(([rows, loadedLocations]) => {
        if (cancelled) return;
        setLocations(loadedLocations);
        storeRef.current.load(rows.map(visualItem));
        setStorageMode("saved");
        setNotice("Saved inventory ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadingError(
          error instanceof Error
            ? `${error.message} Showing sample inventory.`
            : "Saved inventory is unavailable. Showing sample inventory.",
        );
        setStorageMode("sample");
        setNotice("Sample inventory is ready");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => filterInventory(items, { query, kind, location, sort }),
    [items, kind, location, query, sort],
  );
  const selected =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;
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

  async function uploadPhoto(file: File | undefined) {
    if (!file || !selected || uploadingPhoto || storageMode === "loading")
      return;
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
    setAddingPlace(false);
    setEditingPlace(null);
    setPlaceName("");
    setPlaceError("");
    setPlaceIcon("MapPin");
    setPlaceColor("blue");
    addPlaceButton.current?.focus();
  }

  function openAddPlace() {
    setEditingPlace(null);
    setPlaceName("");
    setPlaceError("");
    setPlaceIcon("MapPin");
    setPlaceColor("blue");
    setAddingPlace(true);
  }

  function openEditPlace(place: Place) {
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
    setQuery("");
    setKind("all");
    setNotice(`${name} added`);
    closePlaceForm();
  }

  function deletePlace() {
    if (!editingPlace) return;
    const deletedName = editingPlace.name;
    const hasItems = items.some((item) => item.location_name === deletedName);
    setPlaces((current) =>
      current.filter((place) => place.name !== deletedName),
    );
    setItems((current) =>
      current.map((item) =>
        item.location_name === deletedName
          ? {
              ...item,
              location_name: "Home",
              version: item.version + 1,
              updated_at: now(),
            }
          : item,
      ),
    );
    if (location === deletedName) setLocation("all");
    setNotice(
      hasItems
        ? `${deletedName} deleted; items moved to Home`
        : `${deletedName} deleted`,
    );
    closePlaceForm();
  }

  function selectItem(item: Item) {
    setSelectedId(item.id);
    setDetailsOpen(true);
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
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />

      <header className={styles.brand}>
        <span className={styles.brandIcon}>
          <Package weight="fill" />
        </span>
        <span>Inventory</span>
        <small>Private workspace</small>
      </header>

      <div className={styles.workspace}>
        <aside className={`${styles.glass} ${styles.rail}`}>
          <nav aria-label="Inventory locations">
            {navigation.map(({ label, value, Icon, icon, color, place }) => (
              <button
                key={value}
                className={location === value ? styles.activeNav : ""}
                data-place-icon={icon}
                style={
                  color
                    ? ({ "--place-color": color } as CSSProperties)
                    : undefined
                }
                onClick={() => setLocation(value)}
                onDoubleClick={() => place && openEditPlace(place)}
                aria-pressed={location === value}
                title={place ? `Double-click to edit ${label}` : undefined}
              >
                <Icon weight={location === value ? "fill" : "regular"} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button
            className={styles.addRail}
            ref={addPlaceButton}
            onClick={openAddPlace}
            aria-label="Add place"
            title="Add place"
            aria-expanded={addingPlace}
          >
            <Plus weight="bold" />
          </button>
          <div className={styles.profile} title="Local demo profile">
            JH
          </div>
        </aside>

        <section className={`${styles.glass} ${styles.library}`}>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <MagnifyingGlass weight="bold" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items..."
                aria-label="Search items"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  ×
                </button>
              )}
            </label>

            <GlassSelect
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Recently updated" },
                { value: "name", label: "Name" },
                { value: "quantity", label: "Quantity" },
              ]}
            />
            <GlassSelect
              label="Filter items"
              value={kind}
              onChange={setKind}
              icon={<SlidersHorizontal weight="bold" />}
              options={[
                { value: "all", label: "All items" },
                { value: "durable", label: "Durable" },
                { value: "consumable", label: "Consumable" },
                { value: "container", label: "Containers" },
                { value: "low", label: "Low stock" },
              ]}
            />

            <div className={styles.viewToggle} aria-label="View style">
              <button
                className={view === "grid" ? styles.selectedToggle : ""}
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <SquaresFour weight="fill" />
              </button>
              <button
                className={view === "list" ? styles.selectedToggle : ""}
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <List weight="bold" />
              </button>
            </div>
          </div>

          <div className={styles.libraryMeta}>
            <span>{location === "all" ? "All spaces" : location}</span>
            {kind !== "all" && (
              <button
                className={styles.activeFilter}
                onClick={() => setKind("all")}
                aria-label="Clear item filter"
              >
                {kind === "low" ? "Low stock" : kind} ×
              </button>
            )}
            <span>{filtered.length} items</span>
            <button className={styles.addItem} onClick={() => addItem()}>
              <Plus aria-hidden="true" /> Add item
            </button>
            <button
              className={styles.addContainer}
              onClick={() => addContainer()}
            >
              <Folder aria-hidden="true" /> Add container
            </button>
          </div>

          <ContainerGrid
            items={items}
            visible={filtered}
            sort={sort}
            selectedId={selected?.id}
            view={view}
            queryActive={
              Boolean(query.trim()) || kind !== "all" || location !== "all"
            }
            onSelect={selectItem}
            onAddItem={addItem}
            onAddContainer={addContainer}
          />

          {filtered.length === 0 && (
            <div className={styles.emptyState}>
              <Cube weight="duotone" />
              <strong>No items found</strong>
              <span>Try a different search or filter.</span>
            </div>
          )}

          <footer className={styles.libraryFooter}>
            <span>
              <span className={styles.liveDot} />{" "}
              {storageMode === "saved"
                ? "Saved inventory"
                : storageMode === "loading"
                  ? "Connecting to saved inventory"
                  : "Local sample data"}
            </span>
            <span>{loadingError || storeError || notice}</span>
          </footer>
        </section>

        <div
          className={`${styles.detailColumn} ${!detailsOpen ? styles.detailsClosed : ""}`}
        >
          {detailsOpen && (
            <aside
              className={`${styles.glass} ${styles.details}`}
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
                          disabled={uploadingPhoto || storageMode === "loading"}
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
                        {selected.kind === "container"
                          ? "Container"
                          : selected.kind === "durable"
                            ? "Durable"
                            : "Consumable"}
                      </span>
                    </div>
                    <div className={styles.moreMenuWrap}>
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
                </>
              ) : (
                <div className={styles.noSelection}>
                  <Package weight="duotone" />
                  <span>Add an item to get started.</span>
                </div>
              )}
            </aside>
          )}
          <JarvisChat
            items={items}
            saved={storageMode === "saved"}
            onApplyChanges={(changes, versions) =>
              store.applyChanges(changes, versions, locationOptions)
            }
            onSelect={(id) => {
              setSelectedId(id);
              setDetailsOpen(true);
              setEditing(false);
            }}
          />
        </div>
      </div>

      {addingPlace && (
        <div className={styles.placeOverlay}>
          <div
            className={styles.placeDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="place-dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") closePlaceForm();
            }}
          >
            <form onSubmit={createPlace}>
              <div className={styles.placeDialogHeader}>
                <div>
                  <span className={styles.dialogEyebrow}>
                    {editingPlace ? "Edit space" : "New space"}
                  </span>
                  <h2 id="place-dialog-title">
                    {editingPlace ? "Edit place" : "Add a place"}
                  </h2>
                  <p>
                    {editingPlace
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
                  ×
                </button>
              </div>

              <label className={styles.placeNameField} htmlFor="place-name">
                <span>Place name</span>
                <input
                  id="place-name"
                  autoFocus
                  maxLength={80}
                  value={placeName}
                  placeholder="e.g. Garage"
                  aria-invalid={Boolean(placeError)}
                  aria-describedby={placeError ? "place-error" : undefined}
                  onChange={(event) => {
                    setPlaceName(event.target.value);
                    setPlaceError("");
                  }}
                />
              </label>

              <fieldset className={styles.placeChoices}>
                <legend>Choose an icon</legend>
                <div className={styles.choiceGrid}>
                  {placeIconOptions.map((option) => {
                    const OptionIcon = option.Icon;
                    return (
                      <label key={option.value} className={styles.choiceCard}>
                        <input
                          type="radio"
                          name="place-icon"
                          value={option.value}
                          aria-label={option.label}
                          checked={placeIcon === option.value}
                          onChange={() => setPlaceIcon(option.value)}
                        />
                        <OptionIcon weight="duotone" aria-hidden="true" />
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
                    <label key={option.value} className={styles.colorChoice}>
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
                        style={{ "--swatch": option.color } as CSSProperties}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {placeError && (
                <p id="place-error" className={styles.placeError} role="alert">
                  {placeError}
                </p>
              )}
              <div className={styles.placeDialogActions}>
                {editingPlace && (
                  <button
                    type="button"
                    className={styles.dialogDelete}
                    aria-label="Delete place"
                    onClick={deletePlace}
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
                  {editingPlace ? "Save changes" : "Create place"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
