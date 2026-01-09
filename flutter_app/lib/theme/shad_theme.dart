import 'package:flutter/material.dart';

class ShadColors {
  // Light Theme
  static const Color background = Color(0xFFFFFFFF);
  static const Color foreground = Color(0xFF09090b);
  static const Color card = Color(0xFFFFFFFF);
  static const Color cardForeground = Color(0xFF09090b);
  static const Color popover = Color(0xFFFFFFFF);
  static const Color popoverForeground = Color(0xFF09090b);
  static const Color primary = Color(0xFF18181b);
  static const Color primaryForeground = Color(0xFFfafafa);
  static const Color secondary = Color(0xFFf4f4f5);
  static const Color secondaryForeground = Color(0xFF18181b);
  static const Color muted = Color(0xFFf4f4f5);
  static const Color mutedForeground = Color(0xFF71717a);
  static const Color accent = Color(0xFFf4f4f5);
  static const Color accentForeground = Color(0xFF18181b);
  static const Color destructive = Color(0xFFef4444);
  static const Color destructiveForeground = Color(0xFFfafafa);
  static const Color border = Color(0xFFe4e4e7);
  static const Color input = Color(0xFFe4e4e7);
  static const Color ring = Color(0xFF18181b);

  // Badge Colors
  static const Color emeraldBg = Color(0xFFecfdf5);
  static const Color emeraldText = Color(0xFF059669);
  static const Color emeraldBorder = Color(0xFF10b981);

  static const Color indigoBg = Color(0xFFeef2ff);
  static const Color indigoText = Color(0xFF4f46e5);
  static const Color indigoBorder = Color(0xFF6366f1);

  static const Color amberBg = Color(0xFFfffbeb);
  static const Color amberText = Color(0xFFd97706);
  static const Color amberBorder = Color(0xFFf59e0b);

  static const Color cyanBg = Color(0xFFecfeff);
  static const Color cyanText = Color(0xFF0891b2);
  static const Color cyanBorder = Color(0xFF06b6d4);

  static const Color pinkBg = Color(0xFFfdf2f8);
  static const Color pinkText = Color(0xFFdb2777);
  static const Color pinkBorder = Color(0xFFec4899);

  static const Color roseBg = Color(0xFFfff1f2);
  static const Color roseText = Color(0xFFe11d48);
  static const Color roseBorder = Color(0xFFf43f5e);

  static const Color zincBg = Color(0xFFf4f4f5);
  static const Color zincText = Color(0xFF52525b);
  static const Color zincBorder = Color(0xFF71717a);
}

class ShadTheme {
  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: const ColorScheme.light(
      surface: ShadColors.background,
      onSurface: ShadColors.foreground,
      primary: ShadColors.primary,
      onPrimary: ShadColors.primaryForeground,
      secondary: ShadColors.secondary,
      onSecondary: ShadColors.secondaryForeground,
      error: ShadColors.destructive,
      onError: ShadColors.destructiveForeground,
      outline: ShadColors.border,
    ),
    scaffoldBackgroundColor: ShadColors.background,
    dividerTheme: const DividerThemeData(
      color: ShadColors.border,
      thickness: 1,
      space: 1,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: ShadColors.background,
      foregroundColor: ShadColors.foreground,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: ShadColors.foreground,
        fontSize: 18,
        fontWeight: FontWeight.bold,
      ),
      iconTheme: IconThemeData(color: ShadColors.mutedForeground),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: ShadColors.background,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: ShadColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: ShadColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: ShadColors.ring, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      hintStyle: const TextStyle(color: ShadColors.mutedForeground, fontSize: 14),
    ),
    textTheme: const TextTheme(
      bodyLarge: TextStyle(color: ShadColors.foreground, fontSize: 16),
      bodyMedium: TextStyle(color: ShadColors.foreground, fontSize: 14),
      labelLarge: TextStyle(color: ShadColors.mutedForeground, fontSize: 12, fontWeight: FontWeight.bold),
    ),
  );
}
