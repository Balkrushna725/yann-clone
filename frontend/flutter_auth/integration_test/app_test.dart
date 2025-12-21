import 'package:integration_test/integration_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_auth/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('OTP flow (UI + network)', (WidgetTester tester) async {
    app.main();
    await tester.pumpAndSettle();

    final Finder identifier = find.byKey(const Key('identifier'));
    final Finder sendBtn = find.byKey(const Key('sendBtn'));
    final Finder otpField = find.byKey(const Key('otp'));
    final Finder verifyBtn = find.byKey(const Key('verifyBtn'));
    final Finder output = find.byKey(const Key('output'));

    expect(identifier, findsOneWidget);
    expect(sendBtn, findsOneWidget);

    // Enter a test phone and send OTP
    await tester.enterText(identifier, '9876543210');
    await tester.tap(sendBtn);
    await tester.pump();

    // Wait for output to update (either success or error)
    bool outputChanged = false;
    for (int i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      final text = output.evaluate().isNotEmpty
          ? (output.evaluate().first.widget as SelectableText).data ?? ''
          : '';
      if (text.isNotEmpty) {
        outputChanged = true;
        break;
      }
    }

    expect(outputChanged, isTrue, reason: 'Output should update after sending OTP');

    // If OTP was sent, try filling OTP and verifying (best-effort)
    if (otpField.evaluate().isNotEmpty && verifyBtn.evaluate().isNotEmpty) {
      await tester.enterText(otpField, '123456');
      await tester.tap(verifyBtn);
      await tester.pumpAndSettle(const Duration(seconds: 5));
      // Verify that output updated again
      final text = output.evaluate().isNotEmpty
          ? (output.evaluate().first.widget as SelectableText).data ?? ''
          : '';
      expect(text.isNotEmpty, isTrue);
    }
  });
}
