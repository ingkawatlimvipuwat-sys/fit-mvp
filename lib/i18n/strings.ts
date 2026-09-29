/**
 * Thai-first UI strings with English fallback. No runtime switcher — one
 * file, two fields per key. Components import what they need.
 */
export const t = {
  appName: { th: 'Fit MVP', en: 'Fit MVP' },

  // Landing
  tagline: { th: 'หาขนาดที่ใช่สำหรับลูกค้าของคุณ', en: 'Find the right fit for your customers' },
  login: { th: 'เข้าสู่ระบบ', en: 'Log in' },
  signup: { th: 'สมัครสมาชิก', en: 'Sign up' },
  logout: { th: 'ออกจากระบบ', en: 'Log out' },
  howItWorks: { th: 'ใช้งานอย่างไร', en: 'How it works' },
  howStep1: { th: 'ร้านค้าเพิ่มเสื้อผ้าพร้อมขนาด', en: 'Retailer adds garments with measurements' },
  howStep2: { th: 'ลูกค้ากรอกสัดส่วนของตัวเอง', en: 'Customer enters their measurements' },
  howStep3: { th: 'ระบบบอกความพอดีทีละจุด', en: 'Get per-dimension fit results' },

  // Auth forms
  email: { th: 'อีเมล', en: 'Email' },
  password: { th: 'รหัสผ่าน', en: 'Password' },
  shopName: { th: 'ชื่อร้าน', en: 'Shop name' },
  shopSlug: { th: 'ลิงก์ร้าน (ตัวอักษรภาษาอังกฤษและ -)', en: 'Shop URL slug' },
  signupSubmit: { th: 'สร้างบัญชี', en: 'Create account' },
  loginSubmit: { th: 'เข้าสู่ระบบ', en: 'Log in' },
  authError: { th: 'เกิดข้อผิดพลาด กรุณาลองใหม่', en: 'An error occurred. Please try again.' },
  fitError: { th: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', en: 'Something went wrong. Please try again.' },
  needOneMeasurement: { th: 'กรุณากรอกขนาดอย่างน้อย 1 รายการ', en: 'Please enter at least one measurement.' },
  networkError: { th: 'เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', en: 'Connection failed. Check your internet and try again.' },
  garmentNeedsMeasurement: { th: 'กรุณากรอกขนาดเสื้อผ้าอย่างน้อย 1 รายการ', en: 'Please enter at least one garment measurement.' },
  emailTaken: { th: 'อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบแทน', en: 'This email is already registered. Try logging in instead.' },
  shopUnavailable: { th: 'ร้านค้าไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง', en: 'The shop is temporarily unavailable. Please try again later.' },
  retry: { th: 'ลองใหม่', en: 'Retry' },
  backToShop: { th: 'กลับไปหน้าร้าน', en: 'Back to shop' },
  otherGarments: { th: 'สินค้าอื่นของร้าน', en: 'More from this shop' },

  // Dashboard
  dashboardTitle: { th: 'แดชบอร์ดของร้าน', en: 'Shop dashboard' },
  addGarment: { th: 'เพิ่มเสื้อผ้า', en: 'Add garment' },
  noGarments: { th: 'ยังไม่มีเสื้อผ้า เพิ่มชิ้นแรกเลย', en: 'No garments yet. Add your first one.' },
  publicLink: { th: 'ลิงก์สาธารณะของร้าน', en: 'Public shop link' },
  copyLink: { th: 'คัดลอกลิงก์', en: 'Copy link' },
  deleteGarment: { th: 'ลบ', en: 'Delete' },
  confirmDelete: { th: 'ลบเสื้อผ้านี้ใช่ไหม? การลบย้อนกลับไม่ได้', en: 'Delete this garment? This cannot be undone.' },
  previewShop: { th: 'ดูหน้าร้าน', en: 'View shop page' },

  // Garment form
  garmentName: { th: 'ชื่อเสื้อผ้า', en: 'Garment name' },
  category: { th: 'ประเภท', en: 'Category' },
  catTop: { th: 'เสื้อ', en: 'Top' },
  catBottom: { th: 'กางเกง/กระโปรง', en: 'Bottom' },
  catDress: { th: 'เดรส', en: 'Dress' },
  fitProfile: { th: 'ทรงการตัด', en: 'Fit profile' },
  profileRegular: { th: 'ทรงปกติ', en: 'Regular' },
  profileSlim: { th: 'ทรงเข้ารูป', en: 'Slim' },
  profileRelaxed: { th: 'ทรงหลวม', en: 'Relaxed' },
  photo: { th: 'รูปภาพ', en: 'Photo' },
  photoRequired: { th: 'จำเป็นต้องอัปโหลดรูป', en: 'Photo is required' },
  saveFailed: { th: 'บันทึกไม่สำเร็จ กรุณาลองใหม่', en: 'Save failed. Please try again.' },
  photoUploadFailed: { th: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่ หรือใช้รูปที่มีขนาดเล็กลง', en: 'Photo upload failed. Try again, or use a smaller image.' },
  garmentNameRequired: { th: 'กรุณากรอกชื่อเสื้อผ้า', en: 'Please enter a garment name' },
  fitRuleInvalid: { th: 'กฎความพอดีไม่ถูกต้อง กรุณาตรวจสอบตัวเลข', en: 'The fit rule is not valid. Check the numbers.' },
  save: { th: 'บันทึก', en: 'Save' },
  editGarment: { th: 'แก้ไขเสื้อผ้า', en: 'Edit garment' },
  garmentMeasurements: { th: 'ขนาดเสื้อผ้า', en: 'Garment measurements' },
  replacePhoto: { th: 'เปลี่ยนรูป', en: 'Replace photo' },
  currentPhoto: { th: 'รูปปัจจุบัน', en: 'Current photo' },
  photoKeepCurrent: { th: 'ไม่เลือกไฟล์ = ใช้รูปเดิม', en: 'Leave empty to keep the current photo' },
  saving: { th: 'กำลังบันทึก…', en: 'Saving…' },
  confirmDropMeasurements: {
    th: 'เปลี่ยนประเภทแล้ว ขนาดต่อไปนี้จะถูกลบ: {dims} — บันทึกต่อไหม?',
    en: 'Changing category will discard these measurements: {dims} — save anyway?',
  },

  // Customer-facing
  yourMeasurements: { th: 'ขนาดของคุณ', en: 'Your measurements' },
  checkFit: { th: 'ตรวจสอบความพอดี', en: 'Check fit' },
  overall: { th: 'สรุป', en: 'Overall' },
  verdictTooTight: { th: 'คับเกินไป', en: 'Too tight' },
  verdictSnug: { th: 'พอดีตัว', en: 'Snug' },
  verdictGood: { th: 'พอดี', en: 'Good fit' },
  verdictLoose: { th: 'หลวม', en: 'Loose' },
  verdictUnknown: { th: 'ไม่ได้ระบุ', en: 'Not specified' },

  // Fit rules
  fitRules: { th: 'กฎความพอดี', en: 'Fit rules' },
  fitRulesNav: { th: 'กฎของร้าน', en: 'Shop rules' },
  fitRuleNew: { th: 'สร้างกฎใหม่', en: 'New rule' },
  fitRuleName: { th: 'ชื่อกฎ', en: 'Rule name' },
  fitRuleNamePlaceholder: { th: 'เช่น ผ้ายืด', en: 'e.g. Stretchy jersey' },
  fitRuleTightBelow: { th: 'แน่นเกินไป เมื่อแคบกว่าตัวมากกว่า…', en: 'Too tight when narrower than the body by more than…' },
  fitRuleGoodFrom: { th: 'พอดี ตั้งแต่…', en: 'Good fit from…' },
  fitRuleGoodTo: { th: '…ถึง…', en: '…to…' },
  fitRulePreview: { th: 'ตัวอย่าง', en: 'Preview' },
  fitRulePerDimension: { th: 'ปรับเฉพาะบางจุด', en: 'Per-measurement exceptions' },
  fitRuleSameAsAbove: { th: 'เหมือนด้านบน', en: 'Same as above' },
  fitRuleOverride: { th: 'ปรับเฉพาะสินค้านี้', en: 'Custom rule for this garment only' },
  fitRuleGarmentCount: { th: 'สินค้าที่ใช้กฎนี้', en: 'Garments using this rule' },
  fitRuleDeleteConfirm: { th: 'ลบกฎนี้? สินค้าที่ใช้อยู่จะกลับไปใช้ทรงมาตรฐาน', en: 'Delete this rule? Garments using it revert to their built-in profile.' },
  fitRuleNone: { th: 'ยังไม่มีกฎของร้าน', en: 'No shop rules yet' },
  fitRuleBuiltIn: { th: 'ทรงมาตรฐาน', en: 'Built-in profiles' },
  fitRuleShopRules: { th: 'กฎของร้าน', en: 'Shop rules' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  delete: { th: 'ลบ', en: 'Delete' },
  edit: { th: 'แก้ไข', en: 'Edit' },

  // Orientation / navigation (UX audit 2026-08-18)
  dashboardBadge: { th: 'แดชบอร์ดร้านค้า', en: 'Shop dashboard' },
  navGarments: { th: 'เสื้อผ้า', en: 'Garments' },
  backToDashboard: { th: 'กลับไปแดชบอร์ด', en: 'Back to dashboard' },
  backToHome: { th: 'กลับหน้าแรก', en: 'Back to home' },

  // Auth cross-links and errors (UX audit 2026-08-18)
  noAccountYet: { th: 'ยังไม่มีบัญชี?', en: 'Don’t have an account?' },
  haveAccount: { th: 'มีบัญชีแล้ว?', en: 'Already have an account?' },
  authInvalidCredentials: { th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', en: 'Wrong email or password.' },
  loginRequired: { th: 'กรุณาเข้าสู่ระบบก่อน', en: 'Please log in to continue.' },

  // Not-found pages (UX audit 2026-08-18)
  notFoundTitle: { th: 'ไม่พบหน้านี้', en: 'Page not found' },
  notFoundBody: {
    th: 'ลิงก์อาจไม่ถูกต้องหรือถูกลบไปแล้ว กรุณาตรวจสอบลิงก์อีกครั้ง',
    en: 'The link may be wrong, or the page may have been removed. Please check the link.',
  },
  notFoundShopTitle: { th: 'ไม่พบร้านค้านี้', en: 'Shop not found' },
  notFoundShopBody: {
    th: 'ลิงก์ร้านอาจไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบลิงก์ที่ได้รับจากร้านค้าอีกครั้ง',
    en: 'The shop link may be incomplete or incorrect. Please check the link your retailer sent you.',
  },
  notFoundGarmentTitle: { th: 'ไม่พบสินค้านี้', en: 'Item not found' },
  notFoundGarmentBody: {
    th: 'สินค้านี้อาจถูกลบไปแล้ว ดูสินค้าอื่นได้ที่หน้าร้าน',
    en: 'This item may have been removed. Browse the shop to see what else is available.',
  },

  // Landing (UX audit 2026-08-18)
  customerHint: {
    th: 'เป็นลูกค้า? เปิดลิงก์ร้านที่ได้รับจากร้านค้าเพื่อเริ่มใช้งาน',
    en: 'A customer? Open the shop link your retailer sent you.',
  },

  // Fit result wording (UX audit 2026-08-18, C1)
  // diff is customer minus garment: positive means the garment is the smaller
  // of the two. Never show the raw signed number — it reads backwards against
  // the ease convention used everywhere else.
  diffSmaller: { th: 'เล็กกว่าตัว {n} ซม.', en: '{n} cm smaller than you' },
  diffRoomier: { th: 'ใหญ่กว่าตัว {n} ซม.', en: '{n} cm roomier than you' },
  diffExact: { th: 'เท่าตัวพอดี', en: 'same as your measurement' },

  // Prefilled measurements (UX audit 2026-08-18, C5)
  prefilledNotice: { th: 'กรอกไว้ให้จากขนาดล่าสุดของคุณ', en: 'Filled in from your most recent measurements' },
  clearMeasurements: { th: 'ล้างค่า', en: 'Clear' },

  // Fit-rules load failure (UX audit 2026-08-18, C3)
  fitRulesLoadFailed: {
    th: 'โหลดกฎของร้านไม่สำเร็จ กรุณารีเฟรชหน้านี้',
    en: 'Could not load your shop rules. Please refresh the page.',
  },

  // Unsaved-work guard (UX audit 2026-08-18, D2)
  confirmDiscard: {
    th: 'ออกจากหน้านี้? ข้อมูลที่กรอกไว้จะหายไป',
    en: 'Leave this page? Anything you typed will be lost.',
  },
// Dashboard translation (C6, 2026-08-18).
  // summarize() in FitRulesManager had these as inline Thai template literals;
  // they need both languages now. {from}/{to} are always positive magnitudes —
  // the sign is carried by which key is chosen, not by the number.
  ruleSummaryRoomy: {
    th: 'พอดีเมื่อกว้างกว่าตัว {from}–{to} ซม.',
    en: 'Fits when {from}–{to} cm roomier than the body',
  },
  ruleSummaryStraddle: {
    th: 'พอดีตั้งแต่แคบกว่าตัว {from} ซม. ถึงกว้างกว่าตัว {to} ซม.',
    en: 'Fits from {from} cm narrower to {to} cm roomier than the body',
  },
  ruleSummaryNarrow: {
    th: 'พอดีเมื่อแคบกว่าตัว {from}–{to} ซม.',
    en: 'Fits when {from}–{to} cm narrower than the body',
  },
  fitRuleExample: {
    th: 'ลูกค้ารอบอก {body} ซม. + เสื้อ {garment} ซม. →',
    en: 'Customer chest {body} cm + garment {garment} cm →',
  },
  unitCm: { th: 'ซม.', en: 'cm' },

  // --- Colour & fabric: shopper tabs ---
  tabFit:    { th: 'ความพอดี', en: 'Fit' },
  tabColour: { th: 'สี', en: 'Colour' },
  tabFabric: { th: 'เนื้อผ้า', en: 'Fabric' },

  // --- Colour & fabric: retailer form ---
  coloursSection:         { th: 'สีของสินค้า', en: 'Colours' },
  addColour:              { th: 'เพิ่มสี', en: 'Add colour' },
  colourName:             { th: 'ชื่อสี', en: 'Colour name' },
  removeColour:           { th: 'ลบสี', en: 'Remove colour' },
  colourNameRequired:     { th: 'กรุณาใส่ชื่อสีทุกสี', en: 'Every colour needs a name' },
  trueColourPhoto:        { th: 'รูปสีจริง (วางราบ แสงธรรมชาติ)', en: 'True colour photo (laid flat, daylight)' },
  fabricSection:          { th: 'เนื้อผ้า', en: 'Fabric' },
  fabricTechnicalDetails: { th: 'รายละเอียดทางเทคนิค', en: 'Technical details' },
  fabricPhoto:            { th: 'รูปใกล้เนื้อผ้า', en: 'Fabric close-up photo' },
  notSet:                 { th: 'ไม่ระบุ', en: 'Not set' },

  // --- Fabric chips: group labels and values ---
  // The VALUE keys are derived at runtime by chipStringKey() in
  // lib/garment/colour-fabric.ts, which builds e.g. 'finishSlightSheen' from
  // the group 'finish' and the enum value 'slight_sheen'. Renaming a key here
  // without renaming the enum value there renders a blank label, with no error.
  finish:            { th: 'ความเงา', en: 'Finish' },
  finishMatte:       { th: 'ด้าน', en: 'Matte' },
  finishSlightSheen: { th: 'เงาเล็กน้อย', en: 'Slight sheen' },
  finishGlossy:      { th: 'เงา', en: 'Glossy' },
  thickness:         { th: 'ความหนา', en: 'Thickness' },
  thicknessThin:     { th: 'บาง', en: 'Thin' },
  thicknessMedium:   { th: 'ปานกลาง', en: 'Medium' },
  thicknessThick:    { th: 'หนา', en: 'Thick' },
  stretch:           { th: 'ความยืด', en: 'Stretch' },
  stretchNone:       { th: 'ไม่ยืด', en: 'None' },
  stretchSome:       { th: 'ยืดเล็กน้อย', en: 'Some' },
  stretchHigh:       { th: 'ยืดมาก', en: 'High' },
  feel:              { th: 'สัมผัส', en: 'Feel' },
  feelSoft:          { th: 'นุ่ม', en: 'Soft' },
  feelCrisp:         { th: 'แข็งอยู่ทรง', en: 'Crisp' },
  feelRough:         { th: 'หยาบ', en: 'Rough' },

  // --- Fabric chip definitions ---
  // Anchors so "thin" and "stretchy" mean the same thing to every retailer and
  // shopper. Shown under the form's radio groups and under the shopper's chips.
  thicknessHint: {
    th: 'บาง < 150 g/m² · ปานกลาง 150–300 · หนา > 300',
    en: 'Thin < 150 g/m² · Medium 150–300 · Thick > 300',
  },
  stretchHint: {
    th: 'เมื่อดึงผ้า: ไม่ยืด < 5% · ยืดเล็กน้อย 5–15% · ยืดมาก > 15%',
    en: 'When pulled: none < 5% · some 5–15% · high > 15%',
  },

  // --- Fabric technical labels ---
  composition:  { th: 'ส่วนประกอบ', en: 'Composition' },
  weightGsm:    { th: 'น้ำหนัก (g/m²)', en: 'Weight (g/m²)' },
  construction: { th: 'โครงสร้างผ้า (วิธีทอ/ถัก)', en: 'Construction (weave/knit)' },
  constructionHint: { th: 'เช่น ทอลายขัด, เจอร์ซีย์, ลายสอง', en: 'e.g. plain weave, single jersey, twill' },
  threadCount:  { th: 'จำนวนเส้นด้ายต่อตารางนิ้ว', en: 'Thread count (per square inch)' },
  poreSizeMm:   { th: 'ขนาดรูผ้า (มม.)', en: 'Pore size (mm)' },
  notes:        { th: 'หมายเหตุ', en: 'Notes' },

  // --- Colour & fabric: shopper copy ---
  trueColourCaption:      { th: 'ถ่ายวางราบใต้แสงธรรมชาติ', en: 'Photographed flat under daylight' },
  screenColourDisclaimer: { th: 'สีจริงอาจต่างจากหน้าจอเล็กน้อย', en: 'Real colour may differ slightly from your screen' },
  moreColours:            { th: '+{n}', en: '+{n}' },

  // --- Colour & fabric: errors ---
  colourInvalid: { th: 'ข้อมูลสีไม่ถูกต้อง', en: 'Invalid colour data' },
  fabricInvalid: { th: 'ข้อมูลเนื้อผ้าไม่ถูกต้อง', en: 'Invalid fabric data' },

  // --- Virtual try-on (stub: returns a hardcoded result image) ---
  tryOnTitle: { th: 'ลองสวม', en: 'Try on' },
  tryOnHint: {
    th: 'ถ่ายหรืออัปโหลดรูปเต็มตัว เพื่อดูภาพคุณใส่สินค้านี้',
    en: 'Take or upload a full-body photo to see yourself in this item',
  },
  tryOnUpload: { th: 'อัปโหลดรูป', en: 'Upload photo' },
  tryOnCamera: { th: 'ถ่ายรูป', en: 'Take photo' },
  tryOnSubmit: { th: 'ดูว่าใส่แล้วเป็นยังไง', en: 'See how it looks' },
  tryOnWorking: { th: 'กำลังสร้างรูป…', en: 'Creating your photo…' },
  tryOnResult: { th: 'รูปคุณใส่สินค้านี้', en: 'You in this item' },
  tryOnPhotoAlt: { th: 'รูปคุณใส่สินค้านี้', en: 'You wearing this item' },
  tryOnYourPhoto: { th: 'รูปที่อัปโหลด', en: 'Your photo' },
  tryOnAgain: { th: 'ลองรูปอื่น', en: 'Try another photo' },
  tryOnNeedPhoto: { th: 'กรุณาเลือกรูปก่อน', en: 'Please choose a photo first' },
  tryOnChangePhoto: { th: 'เปลี่ยนรูป', en: 'Change photo' },
  // --- Size helper (fit form) ---
  sizeHelperTitle:   { th: 'ไม่แน่ใจขนาดตัวเอง?', en: 'Not sure of your measurements?' },
  sizeHelperIntro:   {
    th: 'เลือกไซซ์เพื่อกรอกให้อัตโนมัติ หรือกรอกที่รู้แล้วให้เราประมาณส่วนที่เหลือ (สำหรับผู้ใหญ่)',
    en: 'Pick a size to fill the fields, or enter what you know and we\'ll estimate the rest (adult sizing).',
  },
  profileWomen:      { th: 'ผู้หญิง', en: "Women's" },
  profileMen:        { th: 'ผู้ชาย', en: "Men's" },
  estimateRest:      { th: 'ประมาณส่วนที่เหลือ', en: 'Estimate the rest' },
  estimatedAs:       {
    th: 'ประมาณว่าเป็นไซซ์ {size} — ปรับค่าที่ไม่ตรงได้',
    en: 'Estimated as size {size} — adjust anything that\'s off.',
  },
  filledFromSize:    {
    th: 'กรอกจากไซซ์ {size} แล้ว — ปรับค่าที่ไม่ตรงได้',
    en: 'Filled from size {size} — adjust anything that\'s off.',
  },
  needMeasurementToEstimate: {
    th: 'กรอกขนาดที่รู้อย่างน้อย 1 รายการก่อน',
    en: 'Enter at least one measurement first.',
  },
} as const;

export type StringKey = keyof typeof t;
export function th(key: StringKey): string { return t[key].th; }
export function en(key: StringKey): string { return t[key].en; }
