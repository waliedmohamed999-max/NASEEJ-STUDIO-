import type { Course } from '../types/index.ts'

export const courses: Course[] = [
  {
    id: 'crs-fibers', slug: 'fibers-and-behaviour',
    title: { en: 'Fibers & How They Behave', ar: 'الألياف وسلوكها' },
    summary: {
      en: 'From cellulose to keratin: how fiber chemistry decides drape, warmth, moisture handling and care.',
      ar: 'من السليلوز إلى الكيراتين: كيف تحدد كيمياء الألياف الانسدال والدفء وإدارة الرطوبة والعناية.',
    },
    level: 'beginner', topic: 'fibers',
    lessons: [
      { title: { en: 'Natural vs. man-made fibers', ar: 'الألياف الطبيعية مقابل الصناعية' }, minutes: 12 },
      { title: { en: 'Staple length, fineness and crimp', ar: 'طول التيلة والنعومة والتموّج' }, minutes: 15 },
      { title: { en: 'Moisture regain and comfort', ar: 'استعادة الرطوبة والراحة' }, minutes: 10 },
      { title: { en: 'Regenerated cellulose: viscose, modal, lyocell', ar: 'السليلوز المُجدَّد: فيسكوز ومودال وليوسل' }, minutes: 14 },
      { title: { en: 'Reading a composition label', ar: 'قراءة بطاقة التركيب' }, minutes: 8 },
    ],
  },
  {
    id: 'crs-structures', slug: 'weaving-and-knitting',
    title: { en: 'Weaving & Knitting Fundamentals', ar: 'أساسيات النسيج والتريكو' },
    summary: {
      en: 'Plain, twill and satin weaves; weft and warp knits; how structure controls stretch, stability and hand.',
      ar: 'النسيج السادة والتويل والساتان؛ تريكو اللُّحمة والسَّدى؛ وكيف يتحكم التركيب في المطاطية والثبات والملمس.',
    },
    level: 'intermediate', topic: 'weaving',
    lessons: [
      { title: { en: 'Warp, weft and the loom', ar: 'السَّدى واللُّحمة والنول' }, minutes: 11 },
      { title: { en: 'The three basic weaves', ar: 'التراكيب النسجية الثلاثة الأساسية' }, minutes: 18 },
      { title: { en: 'Ends/picks per cm and cover factor', ar: 'عدد الخيوط في السنتيمتر ومعامل التغطية' }, minutes: 16 },
      { title: { en: 'Single jersey, rib and interlock', ar: 'الجيرسيه المفرد والريب والإنترلوك' }, minutes: 14 },
      { title: { en: 'Jacquard and dobby patterning', ar: 'التصميم بالجاكار والدوبي' }, minutes: 12 },
    ],
  },
  {
    id: 'crs-dyeing', slug: 'sustainable-dyeing-finishing',
    title: { en: 'Sustainable Dyeing & Finishing', ar: 'الصباغة والتجهيز المستدام' },
    summary: {
      en: 'Dye classes, colour fastness testing and low-impact finishing routes that cut water, energy and chemistry.',
      ar: 'فئات الأصباغ واختبارات ثبات اللون ومسارات تجهيز منخفضة الأثر تقلل المياه والطاقة والمواد الكيميائية.',
    },
    level: 'advanced', topic: 'sustainability',
    lessons: [
      { title: { en: 'Reactive, disperse, acid and vat dyes', ar: 'الأصباغ التفاعلية والمشتتة والحمضية والأحواض' }, minutes: 17 },
      { title: { en: 'Fastness to washing, light and rubbing', ar: 'الثبات للغسيل والضوء والاحتكاك' }, minutes: 13 },
      { title: { en: 'Dope dyeing and waterless processes', ar: 'الصباغة في المحلول والعمليات بلا ماء' }, minutes: 15 },
      { title: { en: 'Mechanical vs. chemical finishes', ar: 'التجهيز الميكانيكي مقابل الكيميائي' }, minutes: 12 },
      { title: { en: 'Certifications: GOTS, bluesign, OEKO-TEX', ar: 'الشهادات: GOTS وbluesign وOEKO-TEX' }, minutes: 10 },
    ],
  },
]
