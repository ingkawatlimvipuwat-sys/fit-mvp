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

  // Auth forms
  email: { th: 'อีเมล', en: 'Email' },
  password: { th: 'รหัสผ่าน', en: 'Password' },
  shopName: { th: 'ชื่อร้าน', en: 'Shop name' },
  shopSlug: { th: 'ลิงก์ร้าน (ตัวอักษรภาษาอังกฤษและ -)', en: 'Shop URL slug' },
  signupSubmit: { th: 'สร้างบัญชี', en: 'Create account' },
  loginSubmit: { th: 'เข้าสู่ระบบ', en: 'Log in' },
  authError: { th: 'เกิดข้อผิดพลาด กรุณาลองใหม่', en: 'An error occurred. Please try again.' },

  // Dashboard
  dashboardTitle: { th: 'แดชบอร์ดของร้าน', en: 'Shop dashboard' },
  addGarment: { th: 'เพิ่มเสื้อผ้า', en: 'Add garment' },
  noGarments: { th: 'ยังไม่มีเสื้อผ้า เพิ่มชิ้นแรกเลย', en: 'No garments yet. Add your first one.' },
  publicLink: { th: 'ลิงก์สาธารณะของร้าน', en: 'Public shop link' },
  copyLink: { th: 'คัดลอกลิงก์', en: 'Copy link' },

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
};

export type StringKey = keyof typeof t;
export function th(key: StringKey): string { return t[key].th; }
export function en(key: StringKey): string { return t[key].en; }
