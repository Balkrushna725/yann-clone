import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'YAAN Driver Login',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const LoginPage(),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _identifier = TextEditingController();
  final TextEditingController _otp = TextEditingController();
  String _output = '';
  bool _sending = false;
  bool _verifying = false;

  String get apiBase {
    // For Android emulator use 10.0.2.2; for iOS simulator or web use localhost
    if (kIsWeb) return 'http://127.0.0.1:5000/api/auth';
    // You can change this if testing on a physical device
    return 'http://10.0.2.2:5000/api/auth';
  }



  Future<void> sendOtp() async {
    final value = _identifier.text.trim();
    if (value.isEmpty) return _showAlert('Enter phone number');

    final body = {
      'phone': value,
    };

    setState(() {
      _sending = true;
      _output = 'Sending...';
    });

    try {
      final res = await http.post(Uri.parse('$apiBase/request-otp'),
          headers: {'Content-Type': 'application/json'}, body: jsonEncode(body));

      final data = _safeParse(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setState(() {
          _output = jsonEncode(data);
        });
      } else {
        setState(() {
          _output = 'Error ${res.statusCode}: ${jsonEncode(data)}';
        });
      }
    } catch (e) {
      setState(() {
        _output = 'Request failed: $e';
      });
    } finally {
      setState(() {
        _sending = false;
      });
    }
  }

  Future<void> verifyOtp() async {
    final value = _identifier.text.trim();
    final otpValue = _otp.text.trim();
    if (otpValue.isEmpty) return _showAlert('Enter OTP');

    final body = {
      'otp': otpValue,
      'phone': value,
    };

    setState(() {
      _verifying = true;
      _output = 'Verifying...';
    });

    try {
      final res = await http.post(Uri.parse('$apiBase/verify-otp'),
          headers: {'Content-Type': 'application/json'}, body: jsonEncode(body));

      final data = _safeParse(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setState(() {
          _output = jsonEncode(data);
        });

        final Map<String, dynamic>? user = (data is Map && data['user'] is Map) ? Map<String, dynamic>.from(data['user']) : null;
        final String? token = (data is Map && data['token'] != null) ? data['token'] as String : null;

        // Always prompt for first/last name after OTP verification
        final nameResult = await Navigator.push<Map<String, dynamic>?>(
          context,
          MaterialPageRoute(builder: (_) => const NamePage()),
        );

        // Then always ask for email
        final result = await Navigator.push<Map<String, dynamic>?>(
          context,
          MaterialPageRoute(builder: (_) => const EmailPage()),
        );

        // Build profile payload from collected inputs
        final Map<String, dynamic> payload = {};
        if (nameResult != null) {
          if (nameResult['firstName'] != null) payload['firstName'] = nameResult['firstName'];
          if (nameResult['lastName'] != null) payload['lastName'] = nameResult['lastName'];
        }
        if (result != null) {
          if (result['email'] != null) payload['email'] = result['email'];
        }

        if (payload.isNotEmpty) {
          try {
            if (token != null) {
              final profileRes = await http.post(Uri.parse('$apiBase/update-profile'),
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer $token'
                  },
                  body: jsonEncode(payload));

              final profileData = _safeParse(profileRes.body);
              if (profileRes.statusCode >= 200 && profileRes.statusCode < 300) {
                // Show success message and navigate to home
                _showAlert('Login successful!');
                await Future.delayed(const Duration(seconds: 1)); // Brief delay for user to see message
                if (mounted) {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const HomePage()),
                  );
                }
              } else {
                setState(() {
                  _output = jsonEncode({'verified': data, 'profileUpdate': profileData});
                });
              }
            } else {
              setState(() {
                _output = jsonEncode({'verified': data, 'note': 'No token to save profile', 'payload': payload});
              });
            }
          } catch (e) {
            setState(() {
              _output = jsonEncode({'verified': data, 'profileError': e.toString()});
            });
          }
        } else {
          // No profile update needed, still navigate to home
          _showAlert('Login successful!');
          await Future.delayed(const Duration(seconds: 1));
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const HomePage()),
            );
          }
        }
      } else {
        setState(() {
          _output = 'Error ${res.statusCode}: ${jsonEncode(data)}';
        });
      }
    } catch (e) {
      setState(() {
        _output = 'Request failed: $e';
      });
    } finally {
      setState(() {
        _verifying = false;
      });
    }
  }

  dynamic _safeParse(String s) {
    try {
      return jsonDecode(s);
    } catch (_) {
      return s;
    }
  }

  void _showAlert(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  void dispose() {
    _identifier.dispose();
    _otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('YAAN Driver Login')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              key: const Key('identifier'),
              controller: _identifier,
              decoration: const InputDecoration(labelText: 'Phone Number'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              key: const Key('sendBtn'),
              onPressed: _sending ? null : sendOtp,
              child: _sending ? const CircularProgressIndicator(color: Colors.white) : const Text('Send OTP'),
            ),
            const SizedBox(height: 16),
            TextField(
              key: const Key('otp'),
              controller: _otp,
              decoration: const InputDecoration(labelText: 'OTP'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              key: const Key('verifyBtn'),
              onPressed: _verifying ? null : verifyOtp,
              child: _verifying ? const CircularProgressIndicator(color: Colors.white) : const Text('Verify OTP'),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: SingleChildScrollView(
                child: SelectableText(_formatOutput(_output), key: const Key('output')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatOutput(String raw) {
    try {
      final decoded = jsonDecode(raw);
      final pretty = const JsonEncoder.withIndent('  ').convert(decoded);
      return pretty;
    } catch (_) {
      return raw;
    }
  }
}

class NamePage extends StatefulWidget {
  const NamePage({super.key});

  @override
  State<NamePage> createState() => _NamePageState();
}

class _NamePageState extends State<NamePage> {
  final TextEditingController _first = TextEditingController();
  final TextEditingController _last = TextEditingController();

  bool get _canSubmit => _first.text.trim().isNotEmpty;

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    super.dispose();
  }

  void _submit() {
    Navigator.pop(context, {'firstName': _first.text.trim(), 'lastName': _last.text.trim()});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Name'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              key: const Key('firstName'),
              controller: _first,
              decoration: const InputDecoration(labelText: 'First name'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            TextField(
              key: const Key('lastName'),
              controller: _last,
              decoration: const InputDecoration(labelText: 'Last name (optional)'),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                key: const Key('nameSubmit'),
                onPressed: _canSubmit ? _submit : null,
                child: const Text('Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class EmailPage extends StatefulWidget {
  const EmailPage({super.key});

  @override
  State<EmailPage> createState() => _EmailPageState();
}

class _EmailPageState extends State<EmailPage> {
  final TextEditingController _emailController = TextEditingController();

  bool get _canSubmit => _isValidEmail(_emailController.text.trim());

  bool _isValidEmail(String s) {
    if (s.isEmpty) return false;
    final re = RegExp(r'^[^@]+@[^@]+\.[^@]+$');
    return re.hasMatch(s);
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  void _submit() {
    Navigator.pop(context, {'email': _emailController.text.trim()});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Email'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context, null),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              key: const Key('email'),
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email address'),
              onChanged: (_) => setState(() {}),
            ),
            if (!_isValidEmail(_emailController.text.trim()) && _emailController.text.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8.0),
                child: Text(
                  'Enter a valid email address',
                  style: TextStyle(color: Colors.red[700], fontSize: 12),
                ),
              ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                key: const Key('emailSubmit'),
                onPressed: _canSubmit ? _submit : null,
                child: const Text('Submit'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('YAAN Driver Home'),
      ),
      body: const Center(
        child: Text(
          'Welcome to YAAN Driver App!\n\nYou are now logged in.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 18),
        ),
      ),
    );
  }
}
