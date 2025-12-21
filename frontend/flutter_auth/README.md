Flutter YAAN OTP test

Run (requires Flutter SDK):

- For Android emulator:
  1. Start Android emulator.
  2. From project root `frontend/flutter_auth` run:
     ```bash
     flutter pub get
     flutter run -d emulator-5554
     ```
  Note: the app uses `http://10.0.2.2:5000` to reach localhost on the host machine.

- For web (Chrome):
  ```bash
  flutter pub get
  flutter run -d chrome
  ```
  Note: web uses `http://localhost:5000`.

If testing on a physical device, change `apiBase` in `lib/main.dart` to point to your machine's IP (e.g., `http://192.168.x.y:5000/api/auth`).
