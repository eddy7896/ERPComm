import 'package:flutter/material.dart';
import 'package:ERPComm/theme/shad_theme.dart';

class ShadBadge extends StatelessWidget {
  final String label;
  final String? variant;

  const ShadBadge({
    super.key,
    required this.label,
    this.variant,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color textColor;
    Color borderColor;

    switch (variant) {
      case 'Founder':
        bgColor = ShadColors.emeraldBg;
        textColor = ShadColors.emeraldText;
        borderColor = ShadColors.emeraldBorder.withOpacity(0.2);
        break;
      case 'Admin':
        bgColor = ShadColors.indigoBg;
        textColor = ShadColors.indigoText;
        borderColor = ShadColors.indigoBorder.withOpacity(0.2);
        break;
      case 'Product':
        bgColor = ShadColors.amberBg;
        textColor = ShadColors.amberText;
        borderColor = ShadColors.amberBorder.withOpacity(0.2);
        break;
      case 'Engineering':
        bgColor = ShadColors.cyanBg;
        textColor = ShadColors.cyanText;
        borderColor = ShadColors.cyanBorder.withOpacity(0.2);
        break;
      case 'Design':
        bgColor = ShadColors.pinkBg;
        textColor = ShadColors.pinkText;
        borderColor = ShadColors.pinkBorder.withOpacity(0.2);
        break;
      case 'Marketing':
        bgColor = ShadColors.roseBg;
        textColor = ShadColors.roseText;
        borderColor = ShadColors.roseBorder.withOpacity(0.2);
        break;
      case 'Intern':
        bgColor = ShadColors.zincBg;
        textColor = ShadColors.zincText;
        borderColor = ShadColors.zincBorder.withOpacity(0.2);
        break;
      default:
        bgColor = ShadColors.primary.withOpacity(0.1);
        textColor = ShadColors.primary;
        borderColor = ShadColors.primary.withOpacity(0.2);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: textColor,
          fontSize: 9,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
