import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppLocaleProvider extends ChangeNotifier {
  static const _prefsKey = 'app_locale';

  Locale _locale = const Locale('zh');

  Locale get locale => _locale;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final code = (prefs.getString(_prefsKey) ?? '').trim();
      if (code.isNotEmpty) {
        _locale = _parseLocale(code);
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> setLocale(Locale locale) async {
    _locale = locale;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, _toCode(locale));
    } catch (_) {}
  }

  static Locale _parseLocale(String code) {
    final c = code.trim().toLowerCase();
    if (c == 'en') return const Locale('en');
    if (c == 'zh-hant' || c == 'zh_hant' || c == 'hant') return const Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hant');
    return const Locale('zh');
  }

  static String _toCode(Locale locale) {
    if (locale.languageCode == 'en') return 'en';
    if (locale.languageCode == 'zh' && (locale.scriptCode ?? '').toLowerCase() == 'hant') return 'zh-Hant';
    return 'zh';
  }
}

extension AppLocaleX on Locale {
  String get appCode {
    if (languageCode == 'en') return 'en';
    if (languageCode == 'zh' && (scriptCode ?? '').toLowerCase() == 'hant') return 'zh-Hant';
    return 'zh';
  }
}
