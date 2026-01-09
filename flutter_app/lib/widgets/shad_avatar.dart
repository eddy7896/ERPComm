import 'package:flutter/material.dart';
import 'package:ERPComm/theme/shad_theme.dart';

class ShadAvatar extends StatelessWidget {
  final String? url;
  final String name;
  final double size;
  final bool isOnline;

  const ShadAvatar({
    super.key,
    required this.url,
    required this.name,
    this.size = 36,
    this.isOnline = false,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: ShadColors.secondary,
            borderRadius: BorderRadius.circular(size / 4), // Modern slightly rounded corners
            border: Border.all(color: ShadColors.border.withOpacity(0.5)),
            image: url != null ? DecorationImage(
              image: NetworkImage(url!),
              fit: BoxFit.cover,
            ) : null,
          ),
          child: url == null ? Center(
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: TextStyle(
                color: ShadColors.mutedForeground,
                fontWeight: FontWeight.bold,
                fontSize: size * 0.4,
              ),
            ),
          ) : null,
        ),
        if (isOnline)
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.3,
              height: size * 0.3,
              decoration: BoxDecoration(
                color: ShadColors.emeraldText,
                shape: BoxShape.circle,
                border: Border.all(color: ShadColors.background, width: 2),
              ),
            ),
          ),
      ],
    );
  }
}
