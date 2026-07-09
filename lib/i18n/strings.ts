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
  save: { th: 'บันทึก', en: 'Save' },

  // Customer-facing
  yourMeasurements: { th: 'ขนาดของคุณ', en: 'Your measurements' },
  checkFit: { th: 'ตรวจสอบความพอดี', en: 'Check fit' },
  overall: { th: 'สรุป', en: 'Overall' },
  verdictTooTight: { th: 'คับเกินไป', en: 'Too tight' },
  verdictSnug: { th: 'พอดีตัว', en: 'Snug' },
  verdictGood: { th: 'พอดี', en: 'Good fit' },
  verdictLoose: { th: 'หลวม', en: 'Loose' },
  verdictUnknown: { th: 'ไม่ได้ระบุ', en: 'Not specified' },
} as const;

export type StringKey = keyof typeof t;
export function th(key: StringKey): string { return t[key].th; }
export function en(key: StringKey): string { return t[key].en; }
