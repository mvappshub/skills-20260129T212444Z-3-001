/**
 * Seznam běžných dřevin vysazovaných v České republice
 * Zdroj: Veřejné databáze české dendrologie, Lesy ČR, arboreta
 *
 * Latinské názvy jsou primární, české sekundární (pro vyhledávání)
 */

export interface TreeSpecies {
  id: string
  name_latin: string  // Primární název pro DB
  name_cz: string     // Český název pro UI
  category: 'listnaté' | 'jehličnaté' | 'okrasné'
  common: boolean     // Běžně vysazované (top výběr)
}

export const TREE_SPECIES: TreeSpecies[] = [
  // === LISTNATÉ STROMY (běžné) ===
  {
    id: 'acer-platanoides',
    name_latin: 'Acer platanoides',
    name_cz: 'Javor klen',
    category: 'listnaté',
    common: true
  },
  {
    id: 'acer-pseudoplatanus',
    name_latin: 'Acer pseudoplatanus',
    name_cz: 'Javor mléč',
    category: 'listnaté',
    common: true
  },
  {
    id: 'acer-campestre',
    name_latin: 'Acer campestre',
    name_cz: 'Javor babyka',
    category: 'listnaté',
    common: true
  },
  {
    id: 'acer-negundo',
    name_latin: 'Acer negundo',
    name_cz: 'Javor jasanolistý',
    category: 'listnaté',
    common: true
  },
  {
    id: 'acer-rufinerve',
    name_latin: 'Acer rufinerve',
    name_cz: 'Javor rypoš',
    category: 'listnaté',
    common: true
  },
  {
    id: 'aesculus-hippocastanum',
    name_latin: 'Aesculus hippocastanum',
    name_cz: 'Jírovec maďal',
    category: 'listnaté',
    common: true
  },
  {
    id: 'betula-pendula',
    name_latin: 'Betula pendula',
    name_cz: 'Bříza bradavičnatá',
    category: 'listnaté',
    common: true
  },
  {
    id: 'carpinus-betulus',
    name_latin: 'Carpinus betulus',
    name_cz: 'Habr obecný',
    category: 'listnaté',
    common: true
  },
  {
    id: 'fagus-sylvatica',
    name_latin: 'Fagus sylvatica',
    name_cz: 'Buk lesní',
    category: 'listnaté',
    common: true
  },
  {
    id: 'fraxinus-excelsior',
    name_latin: 'Fraxinus excelsior',
    name_cz: 'Jasan ztepilý',
    category: 'listnaté',
    common: true
  },
  {
    id: 'populus-nigra',
    name_latin: 'Populus nigra',
    name_cz: 'Topol černý',
    category: 'listnaté',
    common: true
  },
  {
    id: 'populus-alba',
    name_latin: 'Populus alba',
    name_cz: 'Topol bílý',
    category: 'listnaté',
    common: true
  },
  {
    id: 'quercus-robur',
    name_latin: 'Quercus robur',
    name_cz: 'Dub letní',
    category: 'listnaté',
    common: true
  },
  {
    id: 'quercus-petraea',
    name_latin: 'Quercus petraea',
    name_cz: 'Dub zimní',
    category: 'listnaté',
    common: true
  },
  {
    id: 'quercus-rubra',
    name_latin: 'Quercus rubra',
    name_cz: 'Dub červený',
    category: 'listnaté',
    common: true
  },
  {
    id: 'tilia-cordata',
    name_latin: 'Tilia cordata',
    name_cz: 'Lípa malolistá',
    category: 'listnaté',
    common: true
  },
  {
    id: 'tilia-platyphyllos',
    name_latin: 'Tilia platyphyllos',
    name_cz: 'Lípa velkolistá',
    category: 'listnaté',
    common: true
  },
  {
    id: 'tilia-europaea',
    name_latin: 'Tilia europaea',
    name_cz: 'Lípa zelená (kříženec)',
    category: 'listnaté',
    common: true
  },
  {
    id: 'ulmus-glabra',
    name_latin: 'Ulmus glabra',
    name_cz: 'Jilm horský',
    category: 'listnaté',
    common: true
  },
  {
    id: 'ulmus-laevvis',
    name_latin: 'Ulmus laevis',
    name_cz: 'Jilm vaz',
    category: 'listnaté',
    common: true
  },
  {
    id: 'ulmus-minor',
    name_latin: 'Ulmus minor',
    name_cz: 'Jilm polní',
    category: 'listnaté',
    common: true
  },
  {
    id: 'alnus-glutinosa',
    name_latin: 'Alnus glutinosa',
    name_cz: 'Olše lepkavá',
    category: 'listnaté',
    common: true
  },
  {
    id: 'salix-alba',
    name_latin: 'Salix alba',
    name_cz: 'Vrba bílá',
    category: 'listnaté',
    common: true
  },
  {
    id: 'sorbus-aucuparia',
    name_latin: 'Sorbus aucuparia',
    name_cz: 'Jeřáb ptačí',
    category: 'listnaté',
    common: true
  },
  {
    id: 'prunus-avium',
    name_latin: 'Prunus avium',
    name_cz: 'Třešeň ptačí',
    category: 'listnaté',
    common: true
  },
  {
    id: 'prunus-padus',
    name_latin: 'Prunus padus',
    name_cz: 'Třešeň ptáčnice',
    category: 'listnaté',
    common: true
  },
  {
    id: 'cerasus-vulgaris',
    name_latin: 'Cerasus vulgaris',
    name_cz: 'Višeň obecná',
    category: 'listnaté',
    common: true
  },

  // === JEHLIČNATÉ STROMY ===
  {
    id: 'picea-abies',
    name_latin: 'Picea abies',
    name_cz: 'Smrk ztepilý',
    category: 'jehličnaté',
    common: true
  },
  {
    id: 'abies-alba',
    name_latin: 'Abies alba',
    name_cz: 'Jedle bělokorá',
    category: 'jehličnaté',
    common: true
  },
  {
    id: 'pinus-sylvestris',
    name_latin: 'Pinus sylvestris',
    name_cz: 'Borovice lesní',
    category: 'jehličnaté',
    common: true
  },
  {
    id: 'pinus-nigra',
    name_latin: 'Pinus nigra',
    name_cz: 'Borovice černá',
    category: 'jehličnaté',
    common: true
  },
  {
    id: 'larix-decidua',
    name_latin: 'Larix decidua',
    name_cz: 'Modřín evropský',
    category: 'jehličnaté',
    common: true
  },
  {
    id: 'pseudotsuga-menziesii',
    name_latin: 'Pseudotsuga menziesii',
    name_cz: 'Douglaska tisolistá',
    category: 'jehličnaté',
    common: true
  },
  {
    id: 'thuja-occidentalis',
    name_latin: 'Thuja occidentalis',
    name_cz: 'Thujová západní',
    category: 'jehličnaté',
    common: true
  },
  {
    id: 'juniperus-communis',
    name_latin: 'Juniperus communis',
    name_cz: 'Tis obecný',
    category: 'jehličnaté',
    common: true
  },

  // === OKRASNÉ STROMY ===
  {
    id: 'platanus-orientalis',
    name_latin: 'Platanus orientalis',
    name_cz: 'Plán východní',
    category: 'okrasné',
    common: true
  },
  {
    id: 'platanus-x-hispanica',
    name_latin: 'Platanus x hispanica',
    name_cz: 'Plán javorolistý',
    category: 'okrasné',
    common: true
  },
  {
    id: 'magnolia-soulangiana',
    name_latin: 'Magnolia soulangiana',
    name_cz: 'Magnolie Soulangeova',
    category: 'okrasné',
    common: true
  },
  {
    id: 'magnolia-kobus',
    name_latin: 'Magnolia kobus',
    name_cz: 'Magnolie kobus',
    category: 'okrasné',
    common: true
  },
  {
    id: 'paulownia-tomentosa',
    name_latin: 'Paulownia tomentosa',
    name_cz: 'Palmutovka dahurická',
    category: 'okrasné',
    common: false
  },
  {
    id: 'catalpa-bignonioides',
    name_latin: 'Catalpa bignonioides',
    name_cz: 'Katalpa trubač',
    category: 'okrasné',
    common: true
  },
  {
    id: 'gleditsia-triacanthos',
    name_latin: 'Gleditsia triacanthos',
    name_cz: 'Trnatec třítvarý',
    category: 'okrasné',
    common: false
  },
  {
    id: 'ailanthus-altissima',
    name_latin: 'Ailanthus altissima',
    name_cz: 'Neštroder vznešený',
    category: 'okrasné',
    common: false
  },
  {
    id: 'cladastris-lutea',
    name_latin: 'Cladastris lutea',
    name_cz: 'Zlatovka úzkolistá',
    category: 'okrasné',
    common: false
  },
  {
    id: 'koelreuteria-paniculata',
    name_latin: 'Koelreuteria paniculata',
    name_cz: 'Lenochod trojčetný',
    category: 'okrasné',
    common: false
  },
  {
    id: 'maclura-pomifera',
    name_latin: 'Maclura pomifera',
    name_cz: 'Jabloň besední (oranžová)',
    category: 'okrasné',
    common: false
  },
  {
    id: 'morus-alba',
    name_latin: 'Morus alba',
    name_cz: 'Moruše bílá',
    category: 'okrasné',
    common: false
  },
  {
    id: 'morus-nigra',
    name_latin: 'Morus nigra',
    name_cz: 'Moruše černá',
    category: 'okrasné',
    common: false
  },
  {
    id: 'juglans-regia',
    name_latin: 'Juglans regia',
    name_cz: 'Ořech královský',
    category: 'okrasné',
    common: false
  },
  {
    id: 'castanea-sativa',
    name_latin: 'Castanea sativa',
    name_cz: 'Kaštan jedlý',
    category: 'okrasné',
    common: false
  },

  // === Další listnaté (méně běžné) ===
  {
    id: 'corylus-avellana',
    name_latin: 'Corylus avellana',
    name_cz: 'Líska obecná',
    category: 'listnaté',
    common: false
  },
  {
    id: 'crataegus-laevigata',
    name_latin: 'Crataegus laevigata',
    name_cz: 'hloh obecný',
    category: 'listnaté',
    common: false
  },
  {
    id: 'crataegus-monnogyna',
    name_latin: 'Crataegus monnogyna',
    name_cz: 'hloh jednosemenný',
    category: 'listnaté',
    common: false
  },
  {
    id: 'amamlanchier-lamarckii',
    name_latin: 'Amamlanchier lamarckii',
    name_cz: 'Mišpule Lamarckova',
    category: 'listnaté',
    common: false
  },
  {
    id: 'laburnum-anagyroides',
    name_latin: 'Laburnum anagyroides',
    name_cz: 'Zlatý déšť',
    category: 'okrasné',
    common: false
  },
  {
    id: 'robinia-pseudoacacia',
    name_latin: 'Robinia pseudoacacia',
    name_cz: 'Akát',
    category: 'listnaté',
    common: true
  },
]

/**
 * Vyhledávací funkce pro autocomplete
 */
export function searchTreeSpecies(query: string): TreeSpecies[] {
  const q = query.toLowerCase().trim()
  if (!q) return TREE_SPECIES.filter(s => s.common).slice(0, 20)

  return TREE_SPECIES
    .filter(species =>
      species.name_latin.toLowerCase().includes(q) ||
      species.name_cz.toLowerCase().includes(q)
    )
    .slice(0, 20)
}

/**
 * Get species by Latin name
 */
export function getSpeciesByLatin(name: string): TreeSpecies | undefined {
  return TREE_SPECIES.find(s => s.name_latin.toLowerCase() === name.toLowerCase())
}

/**
 * Get common species (for default dropdown)
 */
export function getCommonSpecies(): TreeSpecies[] {
  return TREE_SPECIES.filter(s => s.common)
}
