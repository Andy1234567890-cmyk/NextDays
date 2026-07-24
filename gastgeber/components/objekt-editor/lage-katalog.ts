// Kataloge der Airbnb „Location"-Sektion. Genau die Einträge aus dem echten
// Airbnb-Editor (Screenshots) — keine erfundenen Zusätze (Wurzel 4). Slugs sind
// stabil (DB-Wert); die Labels/Beschreibungen kommen aus i18n (key = slug).

export interface LagekatalogEintrag {
  slug: string;
  icon: string;
}

// „Location features" — 7 Merkmale (Airbnb-Reihenfolge).
export const LOCATION_FEATURES: LagekatalogEintrag[] = [
  { slug: "beach_access", icon: "ph:umbrella" },
  { slug: "lake_access", icon: "ph:waves" },
  { slug: "laundromat_nearby", icon: "ph:washing-machine" },
  { slug: "private_entrance", icon: "ph:door" },
  { slug: "resort_access", icon: "ph:buildings" },
  { slug: "ski_in_ski_out", icon: "ph:person-simple-ski" },
  { slug: "waterfront", icon: "ph:water" },
];

// „Scenic views" — 21 Aussichten (Airbnb-Reihenfolge).
export const SCENIC_VIEWS: LagekatalogEintrag[] = [
  { slug: "bay_view", icon: "ph:mountains" },
  { slug: "beach_view", icon: "ph:umbrella" },
  { slug: "canal_view", icon: "ph:boat" },
  { slug: "city_skyline_view", icon: "ph:buildings" },
  { slug: "courtyard_view", icon: "ph:tree" },
  { slug: "desert_view", icon: "ph:sun" },
  { slug: "garden_view", icon: "ph:flower" },
  { slug: "golf_course_view", icon: "ph:flag" },
  { slug: "harbor_view", icon: "ph:anchor" },
  { slug: "lake_view", icon: "ph:waves" },
  { slug: "marina_view", icon: "ph:sailboat" },
  { slug: "mountain_view", icon: "ph:mountains" },
  { slug: "ocean_view", icon: "ph:wave-sine" },
  { slug: "park_view", icon: "ph:tree" },
  { slug: "pool_view", icon: "ph:swimming-pool" },
  { slug: "resort_view", icon: "ph:buildings" },
  { slug: "river_view", icon: "ph:waves" },
  { slug: "sea_view", icon: "ph:wave-sine" },
  { slug: "valley_view", icon: "ph:mountains" },
  { slug: "vineyard_view", icon: "ph:plant" },
  { slug: "landmark_view", icon: "ph:map-pin" },
];
