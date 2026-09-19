# Hướng Dẫn Chi Tiết Xuất File APK Cho Ứng Dụng Azota Quiz Master

Dự án `azota_liquid_glass_app` đã được cấu hình sẵn sàng với **Capacitor Android Native** và **PWA Mobile Offline**. Dưới đây là các phương pháp xuất file `.apk` cài đặt lên điện thoại Android:

---

## 🚀 Phương Pháp 1: Cài Ngay Dạng PWA (Không Cần Chờ Build APK - Khuyên Dùng Trước)

Ứng dụng được thiết kế tương thích hoàn hảo chuẩn **Progressive Web App (PWA)**:
1. Mở file `index.html` trên trình duyệt Chrome điện thoại (hoặc qua link hosting/local server).
2. Bấm vào menu **3 chấm** ở góc trên bên phải Chrome $\rightarrow$ Chọn **"Thêm vào Màn hình chính"** (hoặc **"Cài đặt ứng dụng"**).
3. Biểu tượng app sẽ xuất hiện ngay trên màn hình điện thoại, hoạt động **100% offline**, toàn màn hình không có thanh địa chỉ trình duyệt, mượt mà y hệt như app native.

---

## 📱 Phương Pháp 2: Xuất File APK Bằng Android Studio

Nếu máy tính bạn đã cài **Android Studio** (hoặc có máy phụ có Android Studio):

### Bước 1: Khởi tạo thư mục Android (nếu chưa có)
Mở terminal tại thư mục `d:\UI mod skin ff\azota_liquid_glass_app` và chạy:
```cmd
npm install
npx cap add android
npx cap sync android
```

### Bước 2: Mở dự án trong Android Studio
```cmd
npx cap open android
```
Hoặc mở Android Studio $\rightarrow$ **Open** $\rightarrow$ Trỏ tới thư mục `d:\UI mod skin ff\azota_liquid_glass_app\android`.

### Bước 3: Xuất file APK
1. Chờ Android Studio đồng bộ Gradle xong (khoảng 1-2 phút lần đầu).
2. Vào menu: **Build** $\rightarrow$ **Build Bundle(s) / APK(s)** $\rightarrow$ **Build APK(s)**.
3. Khi hoàn tất, một thông báo sẽ hiện ở góc dưới: bấm **locate** để lấy file `app-debug.apk`.
4. Copy file `.apk` này sang điện thoại Android và bấm cài đặt!

---

## ☁️ Phương Pháp 3: Tự Động Build APK Miễn Phí Qua GitHub Actions (Không Cần Cài Android Studio)

Nếu máy tính của bạn không có sẵn Android SDK / Java JDK, bạn có thể dùng **GitHub Actions** để đám mây của GitHub build file `.apk` hoàn toàn miễn phí:

1. Đẩy thư mục `azota_liquid_glass_app` lên một repository GitHub (Private hoặc Public).
2. Tạo file `.github/workflows/build-apk.yml` với nội dung:
```yaml
name: Build Android APK
on: [push, workflow_dispatch]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'
      - run: npm install
      - run: npx cap add android || true
      - run: npx cap sync android
      - name: Build APK with Gradle
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug
      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: AzotaQuiz-Debug-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk
```
3. Mỗi lần bạn push code, GitHub sẽ tự build và tạo link tải file `app-debug.apk` trong mục **Actions** $\rightarrow$ **Artifacts** để bạn tải thẳng về điện thoại!

---

## 🔒 Danh Sách Quyền Đã Khai Báo Trong `AndroidManifest.xml`

Khi Capacitor tạo thư mục `android`, file `android/app/src/main/AndroidManifest.xml` sẽ được cấp các quyền sau để đọc file `.docx`:
```xml
<!-- Quyền đọc bộ nhớ cho Android 12 trở xuống -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />

<!-- Quyền truy cập tệp tài liệu cho Android 13+ -->
<uses-permission android:name="android.permission.READ_MEDIA_DOCUMENTS" />

<!-- Quyền kết nối mạng (nếu tải font/thư viện CDN lần đầu) -->
<uses-permission android:name="android.permission.INTERNET" />
```
*(Nếu muốn chạy hoàn toàn không cần Internet, toàn bộ CDN Tailwind, Mammoth, Confetti đã có thể tải về local `assets/` bất cứ lúc nào).*
