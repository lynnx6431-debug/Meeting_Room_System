export type GuestApiErrorBody = {
  error?: string;
  [key: string]: unknown;
};

export type GuestMeResponse = {
  room: {
    id: string;
    name: string;
    nameEn: string | null;
    nameTc: string | null;
    nameSc: string | null;
  };
  site: {
    id: string;
    name: string;
  };
  branding: {
    primaryColour: string | null;
    welcomeEn: string | null;
    welcomeTc: string | null;
    welcomeSc: string | null;
    wifiSsid: string | null;
  } | null;
};

export type MenuItem = {
  id: string;
  key: string;
  nameEn: string | null;
  nameTc: string | null;
  nameSc: string | null;
  descEn: string | null;
  descTc: string | null;
  descSc: string | null;
  imageUrl: string | null;
};

export type MenuCategory = {
  id: string;
  tenantId: string;
  siteId: string;
  key: string;
  nameEn: string;
  nameTc: string | null;
  nameSc: string | null;
  imageUrl: string | null;
  orderMode: string;
  limitMode: string;
  defaultOperatorId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  items: MenuItem[];
};

export type MenuResponse = {
  categories: MenuCategory[];
};

export type GuestSession = {
  id: string;
  tenantId: string;
  siteId: string;
  roomId: string;
  headcount: number;
  status: string;
  createdAt: string;
  resetAt: string | null;
  resetBy: string | null;
  closedAt: string | null;
};

export type SessionUsage = {
  categoryId: string;
  itemId: string | null;
  quantityUsed: number;
};

export type GuestSessionResponse = {
  session: GuestSession | null;
  usage?: SessionUsage[];
};
