# AMR FILE MANAGER
مدير ملفات احترافي (PWA + Capacitor/Android) — المستخدم داخل التطبيق: **Amr**. يعمل محليًا بالكامل دون خادم ودون إنترنت.
A local-first file manager (PWA + Capacitor/Android). No server, no network needed for the core features.

## الملفات | Structure
| ملف/مجلد | الوظيفة |
|---|---|
| `index.html` `style.css` `script.js` | الواجهة والمنطق (البحث، الفرز، الأقسام، السلة، المفضلة، الإعدادات…) |
| `js/fs.js` | محركا الملفات: **Native** (إضافة Capacitor `AmrFS` عبر Android SAF) و**Web** (File System Access API + OPFS) |
| `js/zip.js` `js/preview.js` | معاينة ZIP / DOCX / XLSX / PPTX / نص / صور / فيديو / صوت / PDF + قراءة EXIF (بدون مكتبات خارجية) |
| `js/db.js` `js/i18n.js` | IndexedDB والترجمة (عربي RTL / English LTR) |
| `manifest.json` `sw.js` `favicon.png` `icons/` | PWA والأيقونات والـ Splash |
| `android/` | مشروع Android كامل + `AmrFSPlugin.java` (الوصول الحقيقي للملفات) |
| `capacitor.config.json` `package.json` | إعدادات Capacitor (`webDir: www`) والسكربتات |
| `scripts/` | `build.js` (ينسخ إلى `www/`) · `serve.js` · `check.js` (فحص) · `make-icons.py` (توليد الشعار) |

## التشغيل كموقع/PWA
```bash
npm start        # http://localhost:8080   (أو أي خادم static)
npm test         # فحص الملفات والأكواد
```
في المتصفح: يصل التطبيق فقط إلى المجلدات التي تختارها (زر «إضافة مجلد») وإلى مساحة التطبيق الخاصة؛ إن لم يدعم المتصفح اختيار المجلدات استخدم «استيراد ملفات». لا يمكن لأي متصفح قراءة كل ذاكرة الجهاز تلقائيًا.

## بناء APK
### 1) عبر Klencod Web — ما يعمل وما لا يعمل
Klencod Web يحوّل **مواقع HTML/CSS/JavaScript الثابتة فقط** إلى APK (يغلّفها داخل WebView ولا يشغّل Node.js)، ولا يضم مجلد `android/` ولا الإضافة الأصلية `AmrFSPlugin`. لذلك في APK الخاص بـ Klencod:
* يعمل كل شيء داخل **مساحة التطبيق**: «استيراد ملفات/مجلد» ينسخ الملفات إلى مساحة التطبيق (OPFS) فتُدار بالكامل (بحث، فرز، نقل، سلة، مفضلة، معاينة…) وتُحفظ بعد إغلاق التطبيق، مع تحديث تلقائي خلال ثوانٍ.
* **محاولة قراءة مباشرة من الجهاز**: يجرّب التطبيق تلقائيًا `file:///storage/emulated/0/` (للقراءة فقط). تنجح فقط إن سمح غلاف Klencod لصفحة الويب بقراءة `file://` ومنح Android صلاحية التخزين (فعّل في Klencod: «قراءة التخزين القديم» + الصور + الفيديو + الصوت). صفحة الإعدادات ← «وصول التطبيق إلى الملفات» تُظهر الوضع الفعلي (أصلي / قراءة مباشرة / ويب). في Android 11+ قد تظهر الوسائط فقط.
* **لا يمكن** من WebView وحده عرض مجلدات الهاتف وتعديلها؛ هذا قيد من Android/WebView وليس خطأً في الكود.
* للحصول على وصول كامل للمجلدات + اكتشاف فوري للملفات الجديدة استخدم الطريقة 2 (بناء `android/`).

### 2) محليًا (Android Studio / Gradle) — الطريقة الموثوقة
المتطلبات: Node 18+، JDK 17، Android SDK 34.
```bash
npm install                 # يثبّت @capacitor/core و android و cli
npm run cap:sync            # يبني www/ ثم npx cap sync android
npm run android:open        # يفتح Android Studio → Build > Build APK(s)
# أو من الطرفية (يلزم Gradle 8.2+ أو gradlew يولّده Android Studio):
cd android && gradle assembleDebug     # الناتج: android/app/build/outputs/apk/debug/
```
ملاحظة: ملف `gradle-wrapper.jar` الثنائي غير مضمّن؛ Android Studio ينشئه تلقائيًا أو نفّذ `gradle wrapper --gradle-version 8.2.1` داخل `android/`.

### 3) بناء APK من الهاتف فقط (بدون كمبيوتر) — GitHub Actions
1. ارفع محتويات هذا المجلد إلى مستودع GitHub جديد (يجب أن يكون الملف `.github/workflows/build-apk.yml` داخله).
2. من تبويب **Actions** اختر **Build AMR APK** ثم **Run workflow**.
3. بعد دقائق نزّل ملف APK من قسم **Artifacts** وثبّته. هذا هو البناء الأصلي الذي يطلب «الوصول إلى جميع الملفات» ويعرض ملفات الجهاز كأي مدير ملفات.

## كيف يصل التطبيق لملفات Android (الوضع الأصلي)
عند أول فتح يظهر طلب «السماح بالوصول إلى الملفات»؛ يفتح النظام شاشة **الوصول إلى جميع الملفات** (Android 11+) أو نافذة صلاحية التخزين (Android 10-). بعد السماح ترجع للتطبيق وتظهر ملفات الذاكرة الداخلية كاملة تلقائيًا كأي مدير ملفات (مسارات حقيقية، نسخ/نقل/حذف/سلة/مشاركة). عند الرفض يبقى تنبيه في الصفحة الرئيسية مع خيارين: السماح لاحقًا أو اختيار مجلد فقط (SAF). المجلدات المخفية (التي تبدأ بنقطة) لا تُعرض.
* **رصد الجديد**: فحص سريع للمجلدات النشطة كل 4 ثوانٍ + فحص كامل كل 45 ث + عند العودة للتطبيق؛ تظهر علامة NEW بدون زر تحديث.
* **المساحة**: `StatFs` (قيم الجهاز الحقيقية).
* **PDF** عبر `PdfRenderer`. صلاحية `MANAGE_EXTERNAL_STORAGE` مناسبة للتثبيت المباشر (APK)؛ متجر Google Play يقيّدها.
* احتياطيًا: اختيار مجلد (SAF) والوسائط الحديثة (MediaStore) للقراءة فقط.

## حدود معروفة (بصدق)
* مجلدات Android الحساسة (`Android/data` وجذر التخزين) لا يسمح النظام باختيارها.
* معاينة Word/Excel/PowerPoint تدعم الصيغ الحديثة (`docx/xlsx/pptx`) نصًا وجداول؛ الصيغ القديمة (`doc/xls/ppt`) والملفات المشفّرة وZIP64 تُفتح بتطبيق خارجي. RAR/7Z تُفتح خارجيًا.
* السلة هي المجلد المخفي `.amr_trash` داخل كل مجلد جذر مضاف؛ الاستعادة تعيد الملف لمجلده الأصلي إن وُجد وإلا للجذر.
* الاستيراد على Android يمرّر الملف عبر Base64 (مناسب للملفات المتوسطة).
* الخط: يستخدم التطبيق Cairo ثم Tajawal ثم IBM Plex Sans Arabic ثم Noto Sans Arabic (متوفر في Android) ثم خطوط النظام، مع DejaVu Sans كاحتياط مضمّن. لم أتمكن من تنزيل ملفات Cairo أثناء الإنشاء (الشبكة محجوبة)، فلتضمينه داخل التطبيق ضع `Cairo-Regular.ttf` و`Cairo-Bold.ttf` (ترخيص OFL) في مجلد `fonts/` — ثم أضف `,url(fonts/Cairo-Regular.ttf)` و`,url(fonts/Cairo-Bold.ttf)` إلى سطري `@font-face` الخاصين بـ Cairo في `style.css` ونفّذ `npm run build`.
* لم يتم بناء APK داخل بيئة التطوير التي أُنشئ فيها المشروع (لا يتوفر Android SDK/الإنترنت)؛ اختُبرت واجهة الويب ومحرك الملفات فعليًا، أما كود Java فروجع نحويًا ويحتاج بناءً أول على جهازك.
