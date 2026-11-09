import type { Supplier } from '../types/index.ts'

/** Fictional suppliers used as seed data. */
export const suppliers: Supplier[] = [
  {
    id: 'sup-lariana',
    name: 'Lariana Seterie',
    country: 'IT',
    city: 'Como',
    type: 'mill',
    specialties: [
      { en: 'Silk satins & crepes', ar: 'ساتان وكريب الحرير' },
      { en: 'Wool crepe & coatings', ar: 'كريب ومعاطف الصوف' },
      { en: 'Digital printing', ar: 'الطباعة الرقمية' },
    ],
    moqMeters: 50,
    leadTimeDays: 28,
    certifications: ['OEKO-TEX 100', 'ISO 9001'],
    founded: 1952,
    rating: 4.9,
    description: {
      en: 'Third-generation silk mill on Lake Como producing charmeuse, crepe de chine and fine wool crepes for couture houses.',
      ar: 'مصنع حرير من الجيل الثالث على بحيرة كومو، ينتج الشارموز وكريب دي شين وكريب الصوف الفاخر لدور الأزياء الراقية.',
    },
  },
  {
    id: 'sup-anatolia',
    name: 'Anatolia Denim Works',
    country: 'TR',
    city: 'Denizli',
    type: 'mill',
    specialties: [
      { en: 'Rigid & stretch denim', ar: 'دنيم صلب ومطاطي' },
      { en: 'Circular knits', ar: 'التريكو الدائري' },
      { en: 'Viscose & lyocell wovens', ar: 'منسوجات الفيسكوز والليوسل' },
    ],
    moqMeters: 300,
    leadTimeDays: 35,
    certifications: ['GOTS', 'OEKO-TEX 100', 'BCI'],
    founded: 1987,
    rating: 4.7,
    description: {
      en: 'Vertically integrated mill — spinning, indigo rope dyeing, weaving and knitting under one roof.',
      ar: 'مصنع متكامل رأسيًا — غزل وصباغة نيلية بالحبال ونسيج وتريكو تحت سقف واحد.',
    },
  },
  {
    id: 'sup-nile',
    name: 'Nile Delta Cotton Mills',
    country: 'EG',
    city: 'El Mahalla El Kubra',
    type: 'mill',
    specialties: [
      { en: 'Extra-long-staple cotton shirtings', ar: 'أقمشة قمصان من القطن طويل التيلة' },
      { en: 'Linen & linen blends', ar: 'الكتان ومخاليطه' },
      { en: 'Cotton twills', ar: 'تويل القطن' },
    ],
    moqMeters: 200,
    leadTimeDays: 30,
    certifications: ['OEKO-TEX 100', 'Cotton Egypt Association'],
    founded: 1964,
    rating: 4.6,
    description: {
      en: 'Shirting specialist weaving extra-long-staple Egyptian cotton into poplins, oxfords and twills.',
      ar: 'متخصص في أقمشة القمصان، ينسج القطن المصري طويل التيلة إلى بوبلين وأكسفورد وتويل.',
    },
  },
  {
    id: 'sup-kyoto',
    name: 'Kamo Orimono',
    country: 'JP',
    city: 'Kyoto',
    type: 'converter',
    specialties: [
      { en: 'Jacquard & brocade', ar: 'الجاكار والبروكار' },
      { en: 'Nida & abaya crepes', ar: 'كريب النِّدا والعبايات' },
      { en: 'Hemp & technical blends', ar: 'القنب والمخاليط التقنية' },
    ],
    moqMeters: 100,
    leadTimeDays: 45,
    certifications: ['bluesign', 'OEKO-TEX 100'],
    founded: 1931,
    rating: 4.8,
    description: {
      en: 'Kyoto converter pairing Nishijin-style jacquard looms with modern high-twist polyester crepes favoured for abayas.',
      ar: 'شركة تحويل في كيوتو تجمع بين أنوال الجاكار التقليدية وأقمشة الكريب عالية البرم المفضلة للعبايات.',
    },
  },
  {
    id: 'sup-highland',
    name: 'Highland Weavers',
    country: 'GB',
    city: 'Galashiels',
    type: 'mill',
    specialties: [
      { en: 'Wool tweed', ar: 'تويد الصوف' },
      { en: 'Worsted gabardine', ar: 'جبردين الصوف المسرّح' },
      { en: 'Woollen coatings', ar: 'أقمشة المعاطف الصوفية' },
    ],
    moqMeters: 60,
    leadTimeDays: 40,
    certifications: ['Woolmark', 'RWS'],
    founded: 1898,
    rating: 4.8,
    description: {
      en: 'Scottish Borders mill weaving tweeds and worsted suitings from responsibly sourced wool.',
      ar: 'مصنع في الحدود الاسكتلندية ينسج التويد وأقمشة البدلات من صوف مسؤول المصدر.',
    },
  },
]

export const supplierById = (id: string) => suppliers.find((s) => s.id === id)
