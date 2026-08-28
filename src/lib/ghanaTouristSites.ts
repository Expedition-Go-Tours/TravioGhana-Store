/**
 * Tourist sites in Ghana grouped by administrative region.
 * Used for the supplier registration destination picker.
 */

export interface GhanaRegionSites {
  region: string
  sites: string[]
}

export const GHANA_TOURIST_SITES_BY_REGION: GhanaRegionSites[] = [
  {
    region: 'Greater Accra',
    sites: [
      'Kwame Nkrumah Mausoleum',
      'Independence Arch & Black Star Square',
      'Labadi Beach',
      'Jamestown Lighthouse & Old Accra',
      'Makola Market, Accra',
      'Osu Castle (Christiansborg)',
      'National Museum of Ghana',
      'W.E.B. Du Bois Centre',
      'Legon Botanical Gardens',
      'Shai Hills Resource Reserve',
      'Teshie-Nungua Coffin Art Workshops',
      'La Pleasure Beach',
      'Artists Alliance Gallery, Labadi',
      'Tema Community 1 Beach',
    ],
  },
  {
    region: 'Central Region',
    sites: [
      'Cape Coast Castle',
      'Elmina Castle',
      'Kakum National Park',
      'Kakum Canopy Walkway',
      'Fort William, Anomabu',
      'Hans Cottage Botel, Cape Coast',
      'Assin Manso Slave River Site',
      'Brenu Akyinim Beach',
      'International Stingless Bee Centre',
      'Komenda Cave',
      'Elmina Java Hill Museum',
      'Fort Amsterdam, Abandze',
    ],
  },
  {
    region: 'Ashanti Region',
    sites: [
      'Manhyia Palace Museum, Kumasi',
      'Kejetia Market, Kumasi',
      'Bonwire Kente Village',
      'Lake Bosomtwe',
      'Okomfo Anokye Sword Site',
      'Ntonso Adinkra Village',
      'Bobiri Forest & Butterfly Sanctuary',
      'Owabi Wildlife Sanctuary',
      'Kumasi Cultural Centre',
      'Prempeh II Jubilee Museum',
      'Ahwiaa Wood Carving Village',
      'Mamponghene Palace',
    ],
  },
  {
    region: 'Western Region',
    sites: [
      'Busua Beach',
      'Nzulezu Stilt Village',
      'Fort Metal Cross, Dixcove',
      'Axim Beach & Historic Fort',
      'Ankasa Conservation Area',
      'Bia National Park',
      'Tanoboase Sacred Grove',
      'Fort Apollonia, Beyin',
      'Butre Hills & Canopy Walk',
      'Princess Town Beach',
      'Nzulezo Community Tours',
    ],
  },
  {
    region: 'Western North Region',
    sites: [
      'Sefwi Wiawso Palace',
      'Boin Tano Forest Reserve',
      'Fulla Falls',
      'Bia Tano Forest Reserve',
      'Sefwi Wiawso Cocoa Trail',
      'Bodi Falls',
    ],
  },
  {
    region: 'Eastern Region',
    sites: [
      'Aburi Botanical Gardens',
      'Boti Falls',
      'Umbrella Rock, Boti',
      'Akosombo Dam & Volta Lake',
      'Shai Hills Resource Reserve',
      'Akaa Falls',
      'Tetteh Quarshie Cocoa Farm',
      'Bunso Arboretum',
      'Aburi Craft Village',
      'Atewa Range Forest Reserve',
      'Dodi Island (Volta Lake)',
      'Amedzofe Canopy Walk',
    ],
  },
  {
    region: 'Volta Region',
    sites: [
      'Wli Waterfalls',
      'Mount Afadjato',
      'Tafi Atome Monkey Sanctuary',
      'Tagbo Falls',
      'Keta Lagoon & Sand Spit',
      'Fort Prinzenstein, Keta',
      'Xavi Bird Sanctuary',
      'Tafi Abuipe Kente Village',
      'Amedzofe Village & Waterfalls',
      'Mount Gemi',
      'Lake Volta (Volta Estuary)',
      'Agumatsa Wildlife Sanctuary',
    ],
  },
  {
    region: 'Oti Region',
    sites: [
      'Digya National Park',
      'Kyabobo National Park',
      'Nkwanta Waterfalls',
      'Buipe Crocodile Pond',
      'Krachi East Lake Tours',
      'Chilinga Hills',
    ],
  },
  {
    region: 'Northern Region',
    sites: [
      'Mole National Park',
      'Larabanga Mosque',
      'Tamale Cultural Centre',
      'Dakpema Palace, Tamale',
      'Gambaga Escarpment',
      'Mognori Eco-Village',
      'Salaga Slave Market',
      'Gbollahi Community Tours',
      'Wechiau Hippo Sanctuary',
    ],
  },
  {
    region: 'Savannah Region',
    sites: [
      'Mole National Park (Savannah access)',
      'Larabanga Ancient Mosque',
      'Buipe Hippo Sanctuary',
      'Salaga Slave Market',
      'Bui National Park',
      'Damongo Cultural Centre',
    ],
  },
  {
    region: 'North East Region',
    sites: [
      'NaYiri Palace, Nalerigu',
      'Paga Crocodile Pond',
      'Tongo Hills & Whispering Rocks',
      'Widnaba Hippo Sanctuary',
      'Bunkpurugu Cultural Village',
      'Gambaga Escarpment (North East)',
    ],
  },
  {
    region: 'Upper East Region',
    sites: [
      'Bolgatanga Market & Crafts',
      'Paga Crocodile Pond',
      'Tongo Hills',
      "Sirigu Women's Pottery & Art",
      'Navrongo Cathedral',
      'Pikworo Slave Camp',
      'Gbele Resource Reserve',
      'Zuarungu Community Tours',
    ],
  },
  {
    region: 'Upper West Region',
    sites: [
      'Wechiau Hippo Sanctuary',
      "Wa Naa's Palace",
      'Gwollu Slave Defense Wall',
      'Lawra Pottery & Crafts',
      'Gbelle Game Reserve',
      'Hippo Sanctuary, Jalawura',
      'Nandom Traditional Area',
    ],
  },
  {
    region: 'Bono Region',
    sites: [
      'Kintampo Falls',
      'Boabeng-Fiema Monkey Sanctuary',
      'Fuller Falls',
      'Bui National Park',
      'Digya National Park (Bono access)',
      'Bono Manso Slave Market',
    ],
  },
  {
    region: 'Bono East Region',
    sites: [
      'Kintampo Falls',
      'Buoyem Sacred Grove',
      'Tano Sacred Grove',
      'Atebubu Amantin Forest',
      'Digya National Park (Bono East)',
      'Techiman Cultural Centre',
    ],
  },
  {
    region: 'Ahafo Region',
    sites: [
      'Mim Buo Sacred Grove',
      'Asumura Ramsar Site',
      'Bia National Park (Ahafo)',
      'Goaso Palace Museum',
      'Tano River Cultural Tours',
      'Hwidiem Community Ecotourism',
    ],
  },
]

/** Flat list of all sites (region label not included in stored value). */
export const ALL_GHANA_TOURIST_SITES = GHANA_TOURIST_SITES_BY_REGION.flatMap(({ sites }) => sites)

/** @returns The region label for a site, if any. */
export function getRegionForGhanaSite(site: string): string | undefined {
  const match = GHANA_TOURIST_SITES_BY_REGION.find(({ sites }) => sites.includes(site))
  return match?.region
}
